import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { getUserId } from '@/lib/get-user-id'
import {
  applyAccessScope,
  canManageOrganizationRole,
  getAccessScope,
} from '@/lib/organizations'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export const revalidate = 0

export default async function ProjectsPage() {
  const user_id = await getUserId()
  const accessScope = await getAccessScope(supabase, user_id)
  const canManageProjects = !accessScope.currentMembership || canManageOrganizationRole(accessScope.currentMembership)

  let projectsQuery = supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })

  projectsQuery = applyAccessScope(
    projectsQuery,
    user_id,
    accessScope.scopedOrganizationIds,
    accessScope.scopedProjectIds,
    {
      projectIdColumn: 'id',
      restrictToAssignedProjects: accessScope.restrictToAssignedProjects,
    }
  )

  const { data: projects, error } = await projectsQuery

  if (error) {
    return <p style={{ padding: '2rem', color: 'red' }}>Error loading projects: {error.message}</p>
  }

  return (
    <main style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href="/" style={{ color: '#cc3300', textDecoration: 'none', fontSize: '.9rem' }}>
          Back to Home
        </Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.8rem', color: '#1a1a1a' }}>Projects</h1>
        {canManageProjects ? (
          <Link href="/projects/new" style={{
            padding: '.6rem 1.2rem',
            background: '#cc3300',
            color: 'white',
            borderRadius: '6px',
            textDecoration: 'none',
            fontWeight: '600',
            fontSize: '.9rem'
          }}>
            + New Project
          </Link>
        ) : null}
      </div>

      {!canManageProjects ? (
        <div style={{
          background: '#fff7f3',
          border: '1px solid #f1d3c6',
          color: '#8a3d1a',
          borderRadius: '8px',
          padding: '1rem 1.2rem',
          marginBottom: '1.5rem',
          fontSize: '.9rem'
        }}>
          Project setup and edits are owner-only. Ask an owner to manage projects or assignments from Settings.
        </div>
      ) : null}

      {projects.length === 0 && (
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: '3rem',
          textAlign: 'center',
          color: '#666'
        }}>
          <p>No projects yet. Create your first project to get started.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {projects.map((project) => (
          <Link key={project.id} href={'/projects/' + project.id} style={{ textDecoration: 'none' }}>
            <div style={{
              background: 'white',
              border: '1px solid #e5e5e5',
              borderRadius: '8px',
              padding: '1.2rem 1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer'
            }}>
              <div>
                <div style={{ fontWeight: '700', color: '#1a1a1a', fontSize: '1rem', marginBottom: '.25rem' }}>
                  {project.project_name}
                </div>
                <div style={{ color: '#666', fontSize: '.85rem' }}>
                  {project.location} · Owner/Client: {project.client_name || 'Not set'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{
                  background: project.status === 'active' ? '#e6f4ea' : '#f5f5f5',
                  color: project.status === 'active' ? '#2d7a3a' : '#999',
                  padding: '.25rem .75rem',
                  borderRadius: '20px',
                  fontSize: '.75rem',
                  fontWeight: '600',
                  textTransform: 'uppercase'
                }}>
                  {project.status}
                </span>
                <div style={{ color: '#cc3300', fontSize: '1.2rem' }}>→</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  )
}
