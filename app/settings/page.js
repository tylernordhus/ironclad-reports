import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { getUserId } from '@/lib/get-user-id'
import {
  canManageOrganizationRole,
  getOrganizationMembers,
  getOrganizationProjects,
  getProjectAssignmentsForOrganization,
  getPrimaryOrganizationMembership,
} from '@/lib/organizations'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export const revalidate = 0

async function getMemberEmails(members) {
  const emailEntries = await Promise.all(
    (members || []).map(async member => {
      try {
        const { data } = await supabase.auth.admin.getUserById(member.user_id)
        return [member.user_id, data?.user?.email || '']
      } catch {
        return [member.user_id, '']
      }
    })
  )

  return Object.fromEntries(emailEntries)
}

function getMembershipNotice(searchParams) {
  const status = searchParams?.membership || ''
  if (status === 'invited') {
    return { tone: 'success', message: 'Invitation sent and membership prepared for the new user.' }
  }
  if (status === 'added') {
    return { tone: 'success', message: 'Member added to the organization.' }
  }
  if (status === 'reactivated') {
    return { tone: 'success', message: 'Existing membership reactivated and updated.' }
  }
  if (status === 'updated') {
    return { tone: 'success', message: 'Member access updated.' }
  }
  if (status === 'blocked_last_owner') {
    return { tone: 'error', message: 'At least one active owner must remain on the organization.' }
  }
  if (status === 'forbidden') {
    return { tone: 'error', message: 'You do not have permission to manage organization members.' }
  }
  if (status === 'not_found') {
    return { tone: 'error', message: 'That organization member could not be found.' }
  }
  if (status === 'user_not_found') {
    return { tone: 'error', message: 'No existing account was found for that email yet.' }
  }
  if (status === 'existing_user') {
    return { tone: 'error', message: 'That email already has an account. Use Add Existing User instead.' }
  }
  if (status === 'invite_failed') {
    return { tone: 'error', message: 'The invitation could not be sent. Check your auth email setup and try again.' }
  }
  if (status === 'invite_accepted') {
    return { tone: 'success', message: 'The invited user accepted access successfully.' }
  }
  return null
}

function getDefaultAssignedProjectIds(member, allProjects, projectAssignments) {
  const assigned = projectAssignments[member.user_id] || []
  if (assigned.length > 0) return assigned
  if ((member.access_role || member.role) === 'viewer' || (member.access_role || member.role) === 'member' || member.role === 'inspector') {
    return allProjects.map(project => project.id)
  }
  return []
}

export default async function SettingsPage({ searchParams }) {
  const userId = await getUserId()
  const [{ data: settings }, currentMembership] = await Promise.all([
    supabase.from('settings').select('*').single(),
    getPrimaryOrganizationMembership(supabase, userId),
  ])

  const canManageMembers = canManageOrganizationRole(currentMembership)
  const [members, allProjects, projectAssignments] = currentMembership?.organization_id
    ? await Promise.all([
        getOrganizationMembers(supabase, currentMembership.organization_id),
        getOrganizationProjects(supabase, currentMembership.organization_id),
        getProjectAssignmentsForOrganization(supabase, currentMembership.organization_id),
      ])
    : [[], [], {}]
  const memberEmails = await getMemberEmails(members)
  const membershipNotice = getMembershipNotice(searchParams)

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      padding: '2rem'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '8px',
        padding: '2rem',
        width: '100%',
        maxWidth: '840px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <Link href="/" style={{ color: '#cc3300', textDecoration: 'none', fontSize: '.9rem' }}>
            ← Back to Home
          </Link>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ color: '#1a1a1a', fontSize: '1.8rem', marginBottom: '.5rem' }}>Settings</h1>
          <p style={{ color: '#666', fontSize: '.95rem' }}>
            Your company info appears on all reports and PDFs.
          </p>
        </div>

        {settings?.logo_url && (
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <p style={{ fontSize: '.8rem', color: '#999', marginBottom: '.5rem' }}>Current Logo</p>
            <img src={settings.logo_url} alt="Company logo" style={{ maxHeight: '80px', maxWidth: '240px', objectFit: 'contain' }} />
          </div>
        )}

        <form action="/api/settings/update" method="POST" encType="multipart/form-data">
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={labelStyle}>Company Name</label>
            <input name="company_name" required style={inputStyle} defaultValue={settings?.company_name || ''} placeholder="e.g. Acme Construction LLC" />
          </div>
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={labelStyle}>Company Email</label>
            <input name="company_email" type="email" style={inputStyle} defaultValue={settings?.company_email || ''} placeholder="e.g. reports@acmeconstruction.com" />
          </div>
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={labelStyle}>Company Phone</label>
            <input name="company_phone" style={inputStyle} defaultValue={settings?.company_phone || ''} placeholder="e.g. (316) 555-0100" />
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={labelStyle}>
              Company Logo <span style={{ fontWeight: '400', color: '#888', fontSize: '.85rem' }}>(optional — shows on pages and PDFs)</span>
            </label>
            <input name="logo" type="file" accept="image/*" style={{ ...inputStyle, padding: '.5rem', cursor: 'pointer' }} />
          </div>
          <button type="submit" style={primaryButtonStyle}>
            Save Settings
          </button>
        </form>

        <section style={sectionCardStyle}>
          <div style={{ marginBottom: '1rem' }}>
            <h2 style={{ margin: '0 0 .35rem', color: '#1a1a1a', fontSize: '1.25rem' }}>Owner Project Admin</h2>
            <p style={{ margin: 0, color: '#666', fontSize: '.92rem' }}>
              Project setup, report toggles, and member assignments are managed from one owner-only area.
            </p>
          </div>

          {canManageMembers ? (
            <div style={ownerAdminCardStyle}>
              <div style={{ flex: '1 1 280px' }}>
                <div style={{ fontWeight: '700', color: '#1a1a1a', marginBottom: '.25rem' }}>
                  Manage Projects
                </div>
                <div style={{ color: '#666', fontSize: '.88rem' }}>
                  Create projects, edit setup details, and review which members are assigned to each job.
                </div>
              </div>
              <div style={controlsWrapStyle}>
                <Link href="/projects/new" style={settingsLinkButtonStyle}>
                  + New Project
                </Link>
                <Link href="/settings/projects" style={settingsLinkButtonStyle}>
                  Open Project Admin
                </Link>
              </div>
            </div>
          ) : (
            <div style={readOnlyNoticeStyle}>
              Owner access is required to create projects, change project setup, or manage project assignments.
            </div>
          )}
        </section>

        <section style={sectionCardStyle}>
          <div style={{ marginBottom: '1rem' }}>
            <h2 style={{ margin: '0 0 .35rem', color: '#1a1a1a', fontSize: '1.25rem' }}>Organization Members</h2>
            <p style={{ margin: 0, color: '#666', fontSize: '.92rem' }}>
              Manage who can use the mobile app and what role they have inside your organization.
            </p>
          </div>

          {membershipNotice && (
            <div style={{
              marginBottom: '1rem',
              padding: '.8rem 1rem',
              borderRadius: '6px',
              background: membershipNotice.tone === 'success' ? '#eaf7ed' : '#fff0f0',
              color: membershipNotice.tone === 'success' ? '#226236' : '#a32727',
              fontSize: '.9rem',
              fontWeight: '600'
            }}>
              {membershipNotice.message}
            </div>
          )}

          {!currentMembership && (
            <p style={{ color: '#666', margin: 0 }}>
              Organization membership is not set up for this account yet.
            </p>
          )}

          {currentMembership && canManageMembers && (
            <>
              <div style={{ marginBottom: '1rem', color: '#444', fontSize: '.92rem' }}>
                <strong>Managing organization:</strong> {currentMembership.organization_name || currentMembership.organization_id}
                <span style={{ marginLeft: '.7rem' }}>
                  <strong>Your access:</strong> {currentMembership.access_role || currentMembership.role}
                </span>
              </div>

              {canManageMembers && (
                <>
                  <form
                    action="/api/settings/members/create"
                    method="POST"
                    style={addMemberCardStyle}
                  >
                    <div style={{ flex: '1 1 260px' }}>
                      <div style={{ fontWeight: '700', color: '#1a1a1a', marginBottom: '.2rem' }}>
                        Add Existing User
                      </div>
                      <div style={{ color: '#666', fontSize: '.85rem', marginBottom: '.8rem' }}>
                        Adds someone who already has an account in the system.
                      </div>
                      <label style={smallLabelStyle}>
                        Email
                        <input
                          type="email"
                          name="email"
                          required
                          placeholder="user@example.com"
                          style={memberInputStyle}
                        />
                      </label>
                    </div>

                    <div style={controlsWrapStyle}>
                      <label style={smallLabelStyle}>
                        Role
                        <select
                          name="role"
                          defaultValue="inspector"
                          style={selectStyle}
                        >
                          <option value="owner">Owner</option>
                          <option value="admin">Admin</option>
                          <option value="inspector">Inspector</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      </label>

                      <label style={toggleLabelStyle}>
                        <input
                          type="checkbox"
                          name="mobile_access_enabled"
                          defaultChecked
                        />
                        Mobile Access
                      </label>

                      <button type="submit" style={secondaryButtonStyle}>
                        Add Member
                      </button>
                    </div>

                    {allProjects.length > 0 && (
                      <div style={projectAssignmentBlockStyle}>
                        <div style={projectAssignmentTitleStyle}>Project Access</div>
                        <div style={projectAssignmentHintStyle}>
                          Used for inspectors and viewers. Owners/admins automatically keep full project access.
                        </div>
                        <div style={projectGridStyle}>
                          {allProjects.map(project => (
                            <label key={project.id} style={projectCheckboxStyle}>
                              <input type="checkbox" name="project_ids" value={project.id} defaultChecked />
                              <span>{project.project_name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </form>

                  <form
                    action="/api/settings/members/invite"
                    method="POST"
                    style={addMemberCardStyle}
                  >
                    <div style={{ flex: '1 1 260px' }}>
                      <div style={{ fontWeight: '700', color: '#1a1a1a', marginBottom: '.2rem' }}>
                        Invite New User
                      </div>
                      <div style={{ color: '#666', fontSize: '.85rem', marginBottom: '.8rem' }}>
                        Sends an auth invite email and pre-attaches the new user to this organization.
                      </div>
                      <label style={smallLabelStyle}>
                        Email
                        <input
                          type="email"
                          name="email"
                          required
                          placeholder="newuser@example.com"
                          style={memberInputStyle}
                        />
                      </label>
                    </div>

                    <div style={controlsWrapStyle}>
                      <label style={smallLabelStyle}>
                        Role
                        <select
                          name="role"
                          defaultValue="inspector"
                          style={selectStyle}
                        >
                          <option value="owner">Owner</option>
                          <option value="admin">Admin</option>
                          <option value="inspector">Inspector</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      </label>

                      <label style={toggleLabelStyle}>
                        <input
                          type="checkbox"
                          name="mobile_access_enabled"
                          defaultChecked
                        />
                        Mobile Access
                      </label>

                      <button type="submit" style={secondaryButtonStyle}>
                        Send Invite
                      </button>
                    </div>

                    {allProjects.length > 0 && (
                      <div style={projectAssignmentBlockStyle}>
                        <div style={projectAssignmentTitleStyle}>Project Access</div>
                        <div style={projectAssignmentHintStyle}>
                          Invitees with inspector or viewer access will only see the checked projects after acceptance.
                        </div>
                        <div style={projectGridStyle}>
                          {allProjects.map(project => (
                            <label key={project.id} style={projectCheckboxStyle}>
                              <input type="checkbox" name="project_ids" value={project.id} defaultChecked />
                              <span>{project.project_name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </form>
                </>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '.9rem' }}>
                {members.map(member => {
                  const email = memberEmails[member.user_id] || ''
                  const isSelf = member.user_id === userId
                  const defaultAssignedProjectIds = getDefaultAssignedProjectIds(member, allProjects, projectAssignments)

                  return (
                    <form
                      key={member.id}
                      action={`/api/settings/members/${member.id}`}
                      method="POST"
                      style={memberCardStyle}
                    >
                      <div style={{ flex: '1 1 280px' }}>
                        <div style={{ fontWeight: '700', color: '#1a1a1a', marginBottom: '.2rem' }}>
                          {email || 'Unknown email'}
                        </div>
                        <div style={{ color: '#777', fontSize: '.82rem', wordBreak: 'break-all' }}>
                          {member.user_id}
                        </div>
                        {isSelf && (
                          <div style={{ marginTop: '.35rem', color: '#cc3300', fontSize: '.8rem', fontWeight: '600' }}>
                            You
                          </div>
                        )}
                      </div>

                      <div style={controlsWrapStyle}>
                        <label style={smallLabelStyle}>
                          Role
                          <select
                            name="role"
                            defaultValue={member.role}
                            disabled={!canManageMembers}
                            style={selectStyle}
                          >
                            <option value="owner">Owner</option>
                            <option value="admin">Admin</option>
                            <option value="inspector">Inspector</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        </label>

                        <label style={toggleLabelStyle}>
                          <input
                            type="checkbox"
                            name="is_active"
                            defaultChecked={member.is_active}
                            disabled={!canManageMembers}
                          />
                          Active
                        </label>

                        <label style={toggleLabelStyle}>
                          <input
                            type="checkbox"
                            name="mobile_access_enabled"
                            defaultChecked={member.mobile_access_enabled !== false}
                            disabled={!canManageMembers}
                          />
                          Mobile Access
                        </label>

                        {canManageMembers ? (
                          <button type="submit" style={secondaryButtonStyle}>
                            Save Member
                          </button>
                        ) : (
                          <div style={{ color: '#888', fontSize: '.84rem' }}>
                            Owner access required
                          </div>
                        )}
                      </div>

                      {allProjects.length > 0 && (
                        <div style={projectAssignmentBlockStyle}>
                          <div style={projectAssignmentTitleStyle}>Project Access</div>
                          <div style={projectAssignmentHintStyle}>
                            Inspectors and viewers only see assigned projects. Leaving a current legacy user unassigned keeps temporary org-wide access until explicit assignments are saved.
                          </div>
                          <div style={projectGridStyle}>
                            {allProjects.map(project => (
                              <label key={project.id} style={projectCheckboxStyle}>
                                <input
                                  type="checkbox"
                                  name="project_ids"
                                  value={project.id}
                                  defaultChecked={defaultAssignedProjectIds.includes(project.id)}
                                  disabled={!canManageMembers}
                                />
                                <span>{project.project_name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </form>
                  )
                })}
              </div>
            </>
          )}

          {currentMembership && !canManageMembers && (
            <div style={readOnlyNoticeStyle}>
              Only owners can manage organization members, project access, and invitations.
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

const sectionCardStyle = {
  marginTop: '2rem',
  paddingTop: '1.5rem',
  borderTop: '1px solid #ececec',
}

const memberCardStyle = {
  border: '1px solid #e5e5e5',
  borderRadius: '8px',
  padding: '1rem',
  display: 'flex',
  gap: '1rem',
  flexWrap: 'wrap',
  alignItems: 'center',
}

const addMemberCardStyle = {
  ...memberCardStyle,
  marginBottom: '1rem',
  background: '#fafafa',
}
const ownerAdminCardStyle = {
  ...memberCardStyle,
  background: '#fafafa',
}
const readOnlyNoticeStyle = {
  padding: '1rem 1.1rem',
  borderRadius: '8px',
  background: '#f7f7f7',
  color: '#666',
  fontSize: '.9rem',
}
const projectAssignmentBlockStyle = {
  width: '100%',
  borderTop: '1px solid #ececec',
  paddingTop: '.85rem',
}
const projectAssignmentTitleStyle = {
  fontWeight: '700',
  color: '#1a1a1a',
  marginBottom: '.25rem',
  fontSize: '.9rem',
}
const projectAssignmentHintStyle = {
  color: '#777',
  fontSize: '.8rem',
  marginBottom: '.65rem',
}
const projectGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '.5rem .8rem',
}
const projectCheckboxStyle = {
  display: 'flex',
  gap: '.45rem',
  alignItems: 'center',
  color: '#333',
  fontSize: '.86rem',
}

const controlsWrapStyle = {
  display: 'flex',
  gap: '.8rem',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'flex-end',
  flex: '1 1 320px',
}

const labelStyle = { display: 'block', fontWeight: '600', marginBottom: '.4rem', color: '#333' }
const smallLabelStyle = { display: 'flex', flexDirection: 'column', gap: '.35rem', fontWeight: '600', color: '#333', fontSize: '.85rem' }
const toggleLabelStyle = { display: 'flex', gap: '.4rem', alignItems: 'center', fontSize: '.9rem', color: '#333', fontWeight: '600' }
const inputStyle = { width: '100%', padding: '.75rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '1rem', boxSizing: 'border-box' }
const memberInputStyle = { width: '100%', padding: '.65rem .75rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '.95rem', boxSizing: 'border-box' }
const selectStyle = { minWidth: '140px', padding: '.65rem .75rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '.95rem', background: 'white' }
const primaryButtonStyle = {
  width: '100%',
  padding: '1rem',
  background: '#cc3300',
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  fontSize: '1.1rem',
  fontWeight: '700',
  cursor: 'pointer'
}
const secondaryButtonStyle = {
  padding: '.75rem 1rem',
  background: '#0d6efd',
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  fontSize: '.9rem',
  fontWeight: '700',
  cursor: 'pointer'
}
const settingsLinkButtonStyle = {
  padding: '.8rem 1rem',
  background: '#cc3300',
  color: 'white',
  borderRadius: '6px',
  textDecoration: 'none',
  fontSize: '.9rem',
  fontWeight: '700',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
}
