import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserId } from '@/lib/get-user-id'
import {
  canManageOrganizationRole,
  findAuthUserByEmail,
  getOrganizationProjects,
  getOrganizationMembershipByOrgAndUser,
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

export async function POST(request) {
  try {
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.redirect(new URL('/login', request.url), 303)
    }

    const currentMembership = await getPrimaryOrganizationMembership(supabase, userId)
    if (!currentMembership || !canManageOrganizationRole(currentMembership)) {
      return redirectWithStatus(request, 'forbidden')
    }

    const formData = await request.formData()
    const email = String(formData.get('email') || '').trim().toLowerCase()
    const role = String(formData.get('role') || 'inspector').trim()
    const accessRole = normalizeOrganizationAccessRole(role)
    const mobileAccessEnabled = formData.get('mobile_access_enabled') === 'on'
    const requestedProjectIds = formData.getAll('project_ids').map(value => String(value || '').trim()).filter(Boolean)

    if (!email) return redirectWithStatus(request, 'user_not_found')
    if (!['owner', 'admin', 'inspector', 'viewer'].includes(role)) {
      return redirectWithStatus(request, 'forbidden')
    }

    const targetUser = await findAuthUserByEmail(supabase, email)
    if (!targetUser?.id) {
      return redirectWithStatus(request, 'user_not_found')
    }

    const existingMembership = await getOrganizationMembershipByOrgAndUser(
      supabase,
      currentMembership.organization_id,
      targetUser.id
    )
    const organizationProjects = await getOrganizationProjects(supabase, currentMembership.organization_id)
    const validProjectIds = organizationProjects
      .map(project => project.id)
      .filter(projectId => requestedProjectIds.includes(projectId))
    const assignedProjectIds = accessRole === 'owner'
      ? []
      : (validProjectIds.length > 0 ? validProjectIds : organizationProjects.map(project => project.id))

    if (existingMembership) {
      const updatePayload = {
        role,
        access_role: accessRole,
        is_active: true,
        mobile_access_enabled: mobileAccessEnabled,
        invited_by_user_id: userId,
      }

      let { error: updateError } = await supabase
        .from('organization_memberships')
        .update(updatePayload)
        .eq('id', existingMembership.id)

      if (updateError && isMissingColumnError(updateError)) {
        ;({ error: updateError } = await supabase
          .from('organization_memberships')
          .update({
            role,
            is_active: true,
            mobile_access_enabled: mobileAccessEnabled,
            invited_by_user_id: userId,
          })
          .eq('id', existingMembership.id))
      }

      if (updateError) throw updateError
      await replaceProjectAssignmentsForUser(supabase, {
        organizationId: currentMembership.organization_id,
        userId: targetUser.id,
        accessRole,
        projectIds: assignedProjectIds,
        assignedByUserId: userId,
      })
      return redirectWithStatus(request, 'reactivated')
    }

    const insertPayload = {
      organization_id: currentMembership.organization_id,
      user_id: targetUser.id,
      role,
      access_role: accessRole,
      is_active: true,
      mobile_access_enabled: mobileAccessEnabled,
      invited_by_user_id: userId,
    }

    let { error: insertError } = await supabase
      .from('organization_memberships')
      .insert(insertPayload)

    if (insertError && isMissingColumnError(insertError)) {
      ;({ error: insertError } = await supabase
        .from('organization_memberships')
        .insert({
          organization_id: currentMembership.organization_id,
          user_id: targetUser.id,
          role,
          is_active: true,
          mobile_access_enabled: mobileAccessEnabled,
          invited_by_user_id: userId,
        }))
    }

    if (insertError) throw insertError

    await replaceProjectAssignmentsForUser(supabase, {
      organizationId: currentMembership.organization_id,
      userId: targetUser.id,
      accessRole,
      projectIds: assignedProjectIds,
      assignedByUserId: userId,
    })

    return redirectWithStatus(request, 'added')
  } catch (error) {
    console.error('Organization membership create failed:', error)
    return redirectWithStatus(request, 'forbidden')
  }
}
