import { createClient } from '@supabase/supabase-js'
import { isMissingColumnError, isMissingRelationError } from '@/lib/supabase-errors'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

function getApprovedEmailSet() {
  return new Set(
    String(process.env.MOBILE_APPROVED_EMAILS || '')
      .split(',')
      .map(email => email.trim().toLowerCase())
      .filter(Boolean)
  )
}

function isApprovedMobileUserByEmailFallback(user) {
  const approvedEmails = getApprovedEmailSet()
  if (!approvedEmails.size) return true

  const email = String(user?.email || '').trim().toLowerCase()
  return !!email && approvedEmails.has(email)
}

async function getMobileApprovalStatus(user) {
  if (!user?.id) {
    return { approved: false, source: 'missing_user' }
  }

  const { data, error } = await supabase
    .from('organization_memberships')
    .select('organization_id, mobile_access_enabled')
    .eq('user_id', user.id)
    .eq('is_active', true)

  if (error) {
    if (!isMissingRelationError(error) && !isMissingColumnError(error)) {
      console.error('mobile approval lookup failed', error)
    }

    return {
      approved: isApprovedMobileUserByEmailFallback(user),
      source: 'legacy_email_fallback',
    }
  }

  const memberships = data || []
  if (memberships.length === 0) {
    return {
      approved: isApprovedMobileUserByEmailFallback(user),
      source: 'legacy_email_fallback',
    }
  }

  return {
    approved: memberships.some(row => row.mobile_access_enabled !== false),
    source: 'organization_membership',
  }
}

export async function getMobileUserByAccessToken(accessToken) {
  if (!accessToken) return { user: null, status: 'unauthorized' }

  const { data, error } = await supabase.auth.getUser(accessToken)
  if (error || !data.user) return { user: null, status: 'unauthorized' }

  const approval = await getMobileApprovalStatus(data.user)
  if (!approval.approved) {
    return { user: data.user, status: 'forbidden', approvalSource: approval.source }
  }

  return { user: data.user, status: 'ok', approvalSource: approval.source }
}

export async function requireMobileUser(request) {
  const authHeader = request.headers.get('authorization') || ''
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  const accessToken = match?.[1] || ''
  const result = await getMobileUserByAccessToken(accessToken)

  if (result.status === 'unauthorized') {
    return { userId: null, user: null, response: unauthorizedMobileResponse() }
  }

  if (result.status === 'forbidden') {
    return { userId: null, user: result.user, response: mobileApprovalDeniedResponse() }
  }

  return { userId: result.user.id, user: result.user, response: null }
}

export async function getMobileUserId(request) {
  const { userId } = await requireMobileUser(request)
  return userId
}

export function unauthorizedMobileResponse() {
  return Response.json(
    { error: 'Unauthorized' },
    {
      status: 401,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    }
  )
}

export function mobileApprovalDeniedResponse() {
  return Response.json(
    { error: 'This account is not approved for mobile access yet.' },
    {
      status: 403,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    }
  )
}
