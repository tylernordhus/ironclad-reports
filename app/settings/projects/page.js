import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getUserId } from '@/lib/get-user-id'
import {
  canManageOrganizationRole,
  getOrganizationProjects,
  getPrimaryOrganizationMembership,
  getProjectAssignmentsForOrganization,
} from '@/lib/organizations'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export const revalidate = 0

export default async function SettingsProjectsPage() {
  const userId = await getUserId()
  const currentMembership = await getPrimaryOrganizationMembership(supabase, userId)

  if (!currentMembership || !canManageOrganizationRole(currentMembership)) {
    redirect('/settings')
  }

  const [projects, projectAssignments] = await Promise.all([
    getOrganizationProjects(supabase, currentMembership.organization_id),
    getProjectAssignmentsForOrganization(supabase, currentMembership.organization_id),
  ])

  const assignmentCounts = Object.values(projectAssignments).reduce((counts, projectIds) => {
    for (const projectId of projectIds || []) {
      counts[projectId] = (counts[projectId] || 0) + 1
    }
    return counts
  }, {})

  return (
    <main style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href="/settings" style={{ color: '#cc3300', textDecoration: 'none', fontSize: '.9rem' }}>
          ← Back to Settings
        </Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', color: '#1a1a1a', margin: '0 0 .4rem' }}>Project Admin</h1>
          <p style={{ color: '#666', margin: 0, fontSize: '.95rem' }}>
            Owner-only area for project setup, report toggles, and assignment oversight.
          </p>
        </div>
        <Link href="/projects/new" style={{
          padding: '.75rem 1.1rem',
          background: '#cc3300',
          color: 'white',
          borderRadius: '6px',
          textDecoration: 'none',
          fontWeight: '700',
          fontSize: '.9rem'
        }}>
          + New Project
        </Link>
      </div>

      {projects.length === 0 ? (
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: '2rem',
          color: '#666',
          border: '1px solid #e5e5e5',
        }}>
          No projects yet. Create the first project to start assigning crews and configuring report access.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {projects.map(project => (
            <div key={project.id} style={{
              background: 'white',
              border: '1px solid #e5e5e5',
              borderRadius: '8px',
              padding: '1.2rem 1.4rem',
              display: 'flex',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}>
              <div style={{ flex: '1 1 260px' }}>
                <div style={{ fontWeight: '700', color: '#1a1a1a', marginBottom: '.25rem' }}>
                  {project.project_name}
                </div>
                <div style={{ color: '#666', fontSize: '.88rem' }}>
                  Status: {project.status || 'Not set'}
                </div>
                <div style={{ color: '#666', fontSize: '.88rem', marginTop: '.15rem' }}>
                  Assigned members: {assignmentCounts[project.id] || 0}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap' }}>
                <Link href={`/projects/${project.id}`} style={secondaryLinkStyle}>
                  View Project
                </Link>
                <Link href={`/projects/${project.id}/edit`} style={primaryLinkStyle}>
                  Edit Setup
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}

const primaryLinkStyle = {
  padding: '.7rem 1rem',
  background: '#cc3300',
  color: 'white',
  borderRadius: '6px',
  textDecoration: 'none',
  fontWeight: '700',
  fontSize: '.88rem',
}

const secondaryLinkStyle = {
  padding: '.7rem 1rem',
  background: '#f7f7f7',
  color: '#1a1a1a',
  border: '1px solid #e0e0e0',
  borderRadius: '6px',
  textDecoration: 'none',
  fontWeight: '600',
  fontSize: '.88rem',
}
