import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { getUserId } from '@/lib/get-user-id'
import { getOrganizationInviteByToken, isInviteExpired } from '@/lib/organization-invites'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

function statusCopy(status) {
  if (status === 'accepted') {
    return { tone: 'success', message: 'This invite has already been accepted.' }
  }
  if (status === 'expired') {
    return { tone: 'error', message: 'This invite has expired. Ask the owner to send a fresh one.' }
  }
  if (status === 'wrong_account') {
    return { tone: 'error', message: 'Sign in with the invited email address to accept this invite.' }
  }
  if (status === 'accepted_now') {
    return { tone: 'success', message: 'Invite accepted. Your organization access is ready.' }
  }
  return null
}

export const revalidate = 0

export default async function AcceptInvitePage({ searchParams }) {
  const token = String(searchParams?.token || '').trim()
  const inviteStatus = String(searchParams?.status || '').trim()
  const invite = token ? await getOrganizationInviteByToken(supabase, token) : null
  const userId = await getUserId()
  const authUser = userId
    ? await supabase.auth.admin.getUserById(userId).catch(() => ({ data: { user: null } }))
    : { data: { user: null } }
  const userEmail = String(authUser?.data?.user?.email || '').trim().toLowerCase()
  const notice = statusCopy(inviteStatus)
  const inviteIsExpired = invite ? isInviteExpired(invite) : false
  const inviteIsAccepted = invite?.status === 'accepted'
  const emailMatches = invite && userEmail && userEmail === String(invite.email || '').trim().toLowerCase()
  const nextPath = `/invite/accept?token=${encodeURIComponent(token)}`

  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ marginBottom: '1rem' }}>
          <Link href="/login" style={{ color: '#cc3300', textDecoration: 'none', fontSize: '.9rem' }}>
            Back to Sign In
          </Link>
        </div>

        <h1 style={{ color: '#1a1a1a', marginBottom: '.5rem' }}>Organization Invite</h1>
        <p style={{ color: '#666', marginBottom: '1.25rem' }}>
          Review and accept the access you were invited to.
        </p>

        {notice && (
          <div style={{
            ...noticeStyle,
            background: notice.tone === 'success' ? '#eaf7ed' : '#fff0f0',
            color: notice.tone === 'success' ? '#226236' : '#a32727',
          }}>
            {notice.message}
          </div>
        )}

        {!invite && (
          <div style={noticeStyle}>
            This invitation link is invalid or no longer available.
          </div>
        )}

        {invite && (
          <div style={{ display: 'grid', gap: '.75rem' }}>
            <InviteField label="Organization" value={invite.organizations?.name || 'Organization'} />
            <InviteField label="Invited Email" value={invite.email} />
            <InviteField label="Access" value={invite.access_role} />
            <InviteField label="Project Scope" value={invite.access_role === 'owner' ? 'All organization projects' : `${(invite.project_ids || []).length} assigned project(s)`} />
          </div>
        )}

        {invite && !inviteIsAccepted && !inviteIsExpired && !userId && (
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '.75rem', flexWrap: 'wrap' }}>
            <Link href={`/login?email=${encodeURIComponent(invite.email)}&next=${encodeURIComponent(nextPath)}`} style={primaryLinkStyle}>
              Sign In to Accept
            </Link>
            <Link href={`/signup?email=${encodeURIComponent(invite.email)}&next=${encodeURIComponent(nextPath)}`} style={secondaryLinkStyle}>
              Create Account
            </Link>
          </div>
        )}

        {invite && !inviteIsAccepted && !inviteIsExpired && userId && (
          <div style={{ marginTop: '1.5rem' }}>
            <div style={{ marginBottom: '.85rem', color: '#555', fontSize: '.92rem' }}>
              Signed in as <strong>{authUser?.data?.user?.email || 'Unknown user'}</strong>
            </div>

            {emailMatches ? (
              <form action="/api/invites/accept" method="POST">
                <input type="hidden" name="token" value={token} />
                <button type="submit" style={primaryButtonStyle}>
                  Accept Invitation
                </button>
              </form>
            ) : (
              <div style={{
                ...noticeStyle,
                background: '#fff0f0',
                color: '#a32727',
              }}>
                This invite is for {invite.email}. Sign in with that email to accept it.
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}

function InviteField({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: '.78rem', fontWeight: '700', color: '#888', textTransform: 'uppercase', marginBottom: '.18rem' }}>
        {label}
      </div>
      <div style={{ color: '#1a1a1a', fontWeight: '600' }}>{value || '-'}</div>
    </div>
  )
}

const pageStyle = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '2rem',
  background: '#f5f5f5',
}

const cardStyle = {
  width: '100%',
  maxWidth: '560px',
  background: 'white',
  borderRadius: '12px',
  padding: '2rem',
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
}

const noticeStyle = {
  borderRadius: '8px',
  padding: '.9rem 1rem',
  marginBottom: '1rem',
  fontSize: '.92rem',
  fontWeight: '600',
  background: '#f8f8f8',
  color: '#555',
}

const primaryButtonStyle = {
  padding: '.95rem 1.2rem',
  background: '#cc3300',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  fontSize: '.95rem',
  fontWeight: '700',
  cursor: 'pointer',
}

const primaryLinkStyle = {
  display: 'inline-block',
  padding: '.9rem 1.1rem',
  background: '#cc3300',
  color: 'white',
  borderRadius: '8px',
  textDecoration: 'none',
  fontWeight: '700',
}

const secondaryLinkStyle = {
  display: 'inline-block',
  padding: '.9rem 1.1rem',
  background: '#f4f4f4',
  color: '#1a1a1a',
  borderRadius: '8px',
  textDecoration: 'none',
  fontWeight: '700',
}
