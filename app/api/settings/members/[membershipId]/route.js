import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserId } from '@/lib/get-user-id'
import {
  canManageOrganizationRole,
  getMembershipAccessRole,
  getOrganizationMembers,
  getOrganizationMembershipById,
  getOrganizationProjects,
  getPrimaryOrganizationMembership,
  normalizeOrganizationAccessRole,
  replaceProjectAssignmentsForUser,
} from '@/lib/organizations'
import { isMissingColumnError } from '@/lib/supabase-errors'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

function redirectWithStatus(request, status) {
  return NextResponse.redirect(new URL(`/settings?membership=${status}`, request.url), 303)
}

export async function POST(request, { params }) {
  try {
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.redirect(new URL('/login', request.url), 303)
    }

    const currentMembership = await getPrimaryOrganizationMembership(supabase, userId)
    if (!currentMembership || !canManageOrganizationRole(currentMembership)) {
      return redirectWithStatus(request, 'forbidden')
    }

    const targetMembership = await getOrganizationMembershipById(supabase, params.membershipId)
    if (!targetMembership || targetMembership.organization_id !== currentMembership.organization_id) {
      return redirectWithStatus(request, 'not_found')
    }

    const formData = await request.formData()
    const nextRole = String(formData.get('role') || '').trim()
    const nextAccessRole = normalizeOrganizationAccessRole(nextRole)
    const nextIsActive = formData.get('is_active') === 'on'
    const nextMobileAccess = formData.get('mobile_access_enabled') === 'on'
    const requestedProjectIds = formData.getAll('project_ids').map(value => String(value || '').trim()).filter(Boolean)

    if (!['owner', 'admin', 'inspector', 'viewer'].includes(nextRole)) {
      return redirectWithStatus(request, 'forbidden')
    }

    const targetCurrentAccessRole = getMembershipAccessRole(targetMembership)
    const ownerWillRemainOwner = targetCurrentAccessRole === 'owner' && nextAccessRole === 'owner' && nextIsActive
    if (!ownerWillRemainOwner && targetCurrentAccessRole === 'owner') {
      const organizationMembers = await getOrganizationMembers(supabase, currentMembership.organization_id)
      const activeOwnerCount = organizationMembers.filter(member =>
        member.is_active && getMembershipAccessRole(member) === 'owner'
      ).length

      if ((activeOwnerCount || 0) <= 1) {
        return redirectWithStatus(request, 'blocked_last_owner')
      }
    }

    const updatePayload = {
      role: nextRole,
      access_role: nextAccessRole,
      is_active: nextIsActive,
      mobile_access_enabled: nextMobileAccess,
    }

    let { error: updateError } = await supabase
      .from('organization_memberships')
      .update(updatePayload)
      .eq('id', targetMembership.id)

    if (updateError && isMissingColumnError(updateError)) {
      ;({ error: updateError } = await supabase
        .from('organization_memberships')
        .update({
          role: nextRole,
          is_active: nextIsActive,
          mobile_access_enabled: nextMobileAccess,
        })
        .eq('id', targetMembership.id))
    }

    if (updateError) throw updateError

    const organizationProjects = await getOrganizationProjects(supabase, currentMembership.organization_id)
    const validProjectIds = organizationProjects
      .map(project => project.id)
      .filter(projectId => requestedProjectIds.includes(projectId))

    await replaceProjectAssignmentsForUser(supabase, {
      organizationId: currentMembership.organization_id,
      userId: targetMembership.user_id,
      accessRole: nextAccessRole,
      projectIds: validProjectIds,
      assignedByUserId: userId,
    })

    return redirectWithStatus(request, 'updated')
  } catch (error) {
    console.error('Organization membership update failed:', error)
    return redirectWithStatus(request, 'forbidden')
  }
}
