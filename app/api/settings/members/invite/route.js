import { NextResponse } from 'next/server'
import { createHash, randomBytes } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { getUserId } from '@/lib/get-user-id'
import {
  canManageOrganizationRole,
  getOrganizationProjects,
  getPrimaryOrganizationMembership,
  findAuthUserByEmail,
  normalizeOrganizationAccessRole,
} from '@/lib/organizations'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

function redirectWithStatus(request, status) {
  return NextResponse.redirect(new URL(`/settings?membership=${status}`, request.url), 303)
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

async function sendInviteEmail({ to, inviteLink, organizationName, accessRole }) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error('Missing RESEND_API_KEY')
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Field Reports <onboarding@resend.dev>',
      to,
      subject: `You have been invited to ${organizationName || 'Ironclad Reports'}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1a1a1a;">
          <h2 style="margin-bottom: 12px;">You are invited to Ironclad Reports</h2>
          <p>You have been invited with <strong>${accessRole}</strong> access.</p>
          <p>Use the button below to accept the invitation and finish account setup.</p>
          <p style="margin: 24px 0;">
            <a href="${inviteLink}" style="background: #cc3300; color: white; text-decoration: none; padding: 12px 18px; border-radius: 6px; font-weight: 700;">
              Accept Invitation
            </a>
          </p>
          <p style="font-size: 13px; color: #666;">If the button does not work, open this link:</p>
          <p style="font-size: 13px; word-break: break-all; color: #666;">${inviteLink}</p>
        </div>
      `,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || 'Failed to send invite email.')
  }
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

    if (!email) return redirectWithStatus(request, 'invite_failed')
    if (!['owner', 'admin', 'inspector', 'viewer'].includes(role)) {
      return redirectWithStatus(request, 'forbidden')
    }

    const existingUser = await findAuthUserByEmail(supabase, email)
    if (existingUser?.id) {
      return redirectWithStatus(request, 'existing_user')
    }

    const organizationProjects = await getOrganizationProjects(supabase, currentMembership.organization_id)
    const validProjectIds = organizationProjects
      .map(project => project.id)
      .filter(projectId => requestedProjectIds.includes(projectId))
    const assignedProjectIds = accessRole === 'owner'
      ? []
      : (validProjectIds.length > 0 ? validProjectIds : organizationProjects.map(project => project.id))

    const token = randomBytes(24).toString('hex')
    const tokenHash = sha256(token)

    const { error: inviteInsertError } = await supabase
      .from('organization_invites')
      .insert({
        organization_id: currentMembership.organization_id,
        email,
        access_role: accessRole,
        token_hash: tokenHash,
        status: 'pending',
        mobile_access_enabled: mobileAccessEnabled,
        invited_by_user_id: userId,
        project_ids: assignedProjectIds,
      })

    if (inviteInsertError) throw inviteInsertError

    const inviteLink = new URL(`/invite/accept?token=${encodeURIComponent(token)}`, request.url).toString()
    await sendInviteEmail({
      to: email,
      inviteLink,
      organizationName: currentMembership.organization_name,
      accessRole,
    })

    return redirectWithStatus(request, 'invited')
  } catch (error) {
    console.error('Organization invite failed:', error)
    return redirectWithStatus(request, 'invite_failed')
  }
}
