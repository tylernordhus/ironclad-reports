import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserId } from '@/lib/get-user-id'
import { getOrganizationInviteByToken, isInviteExpired } from '@/lib/organization-invites'
import {
  getLegacyMembershipRole,
  getOrganizationMembershipByOrgAndUser,
  replaceProjectAssignmentsForUser,
} from '@/lib/organizations'
import { isMissingColumnError } from '@/lib/supabase-errors'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

function redirectToInvite(request, token, status) {
  return NextResponse.redirect(
    new URL(`/invite/accept?token=${encodeURIComponent(token)}&status=${encodeURIComponent(status)}`, request.url),
    303
  )
}

export async function POST(request) {
  try {
    const userId = await getUserId()
    const formData = await request.formData()
    const token = String(formData.get('token') || '').trim()

    if (!userId || !token) {
      return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(`/invite/accept?token=${token}`)}`, request.url), 303)
    }

    const invite = await getOrganizationInviteByToken(supabase, token)
    if (!invite) {
      return redirectToInvite(request, token, 'invalid')
    }

    if (invite.status === 'accepted') {
      return redirectToInvite(request, token, 'accepted')
    }

    if (invite.status !== 'pending' || isInviteExpired(invite)) {
      await supabase
        .from('organization_invites')
        .update({ status: 'expired' })
        .eq('id', invite.id)
        .eq('status', 'pending')
      return redirectToInvite(request, token, 'expired')
    }

    const { data: authUserData, error: authUserError } = await supabase.auth.admin.getUserById(userId)
    if (authUserError) throw authUserError

    const currentEmail = String(authUserData?.user?.email || '').trim().toLowerCase()
    const invitedEmail = String(invite.email || '').trim().toLowerCase()

    if (!currentEmail || currentEmail !== invitedEmail) {
      return redirectToInvite(request, token, 'wrong_account')
    }

    const legacyRole = getLegacyMembershipRole(invite.access_role)
    const existingMembership = await getOrganizationMembershipByOrgAndUser(
      supabase,
      invite.organization_id,
      userId
    )

    if (existingMembership) {
      let { error: updateError } = await supabase
        .from('organization_memberships')
        .update({
          role: legacyRole,
          access_role: invite.access_role,
          is_active: true,
          mobile_access_enabled: invite.mobile_access_enabled !== false,
          invited_by_user_id: invite.invited_by_user_id,
        })
        .eq('id', existingMembership.id)

      if (updateError && isMissingColumnError(updateError)) {
        ;({ error: updateError } = await supabase
          .from('organization_memberships')
          .update({
            role: legacyRole,
            is_active: true,
            mobile_access_enabled: invite.mobile_access_enabled !== false,
            invited_by_user_id: invite.invited_by_user_id,
          })
          .eq('id', existingMembership.id))
      }

      if (updateError) throw updateError
    } else {
      let { error: insertError } = await supabase
        .from('organization_memberships')
        .insert({
          organization_id: invite.organization_id,
          user_id: userId,
          role: legacyRole,
          access_role: invite.access_role,
          is_active: true,
          mobile_access_enabled: invite.mobile_access_enabled !== false,
          invited_by_user_id: invite.invited_by_user_id,
        })

      if (insertError && isMissingColumnError(insertError)) {
        ;({ error: insertError } = await supabase
          .from('organization_memberships')
          .insert({
            organization_id: invite.organization_id,
            user_id: userId,
            role: legacyRole,
            is_active: true,
            mobile_access_enabled: invite.mobile_access_enabled !== false,
            invited_by_user_id: invite.invited_by_user_id,
          }))
      }

      if (insertError) throw insertError
    }

    await replaceProjectAssignmentsForUser(supabase, {
      organizationId: invite.organization_id,
      userId,
      accessRole: invite.access_role,
      projectIds: invite.project_ids || [],
      assignedByUserId: invite.invited_by_user_id,
    })

    await supabase
      .from('user_profiles')
      .upsert({
        user_id: userId,
        active_organization_id: invite.organization_id,
      }, { onConflict: 'user_id' })

    await supabase
      .from('organization_invites')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        invited_user_id: userId,
      })
      .eq('id', invite.id)

    return redirectToInvite(request, token, 'accepted_now')
  } catch (error) {
    console.error('Accept organization invite failed:', error)
    return NextResponse.redirect(new URL('/login', request.url), 303)
  }
}
