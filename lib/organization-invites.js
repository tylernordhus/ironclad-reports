import { createHash } from 'crypto'

export function hashInviteToken(token) {
  return createHash('sha256').update(String(token || '')).digest('hex')
}

export async function getOrganizationInviteByToken(supabase, token) {
  const tokenHash = hashInviteToken(token)

  const { data, error } = await supabase
    .from('organization_invites')
    .select('id, organization_id, email, access_role, status, mobile_access_enabled, invited_by_user_id, invited_user_id, project_ids, expires_at, accepted_at, created_at, organizations(name)')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (error) throw error
  return data || null
}

export function isInviteExpired(invite) {
  if (!invite?.expires_at) return false
  return new Date(invite.expires_at).getTime() < Date.now()
}
