import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { getUserId } from '@/lib/get-user-id'
import { getAccessScope, getOwnedProjectById } from '@/lib/organizations'
import { getProjectPhotoGallery } from '@/lib/project-photos'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export const revalidate = 0

function formatDate(dateStr) {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-')
  return month && day && year ? `${month}-${day}-${year}` : dateStr
}

export default async function ProjectPhotosPage({ params }) {
  const userId = await getUserId()
  const accessScope = await getAccessScope(supabase, userId)
  const { data: project } = await getOwnedProjectById(
    supabase,
    userId,
    params.id,
    accessScope.scopedOrganizationIds,
    'id, project_name, location, organization_id',
    accessScope.scopedProjectIds,
    { restrictToAssignedProjects: accessScope.restrictToAssignedProjects }
  )

  if (!project) {
    return <p style={{ padding: '2rem', color: 'red' }}>Project not found.</p>
  }

  const gallery = await getProjectPhotoGallery(
    supabase,
    project.id,
    userId,
    accessScope.scopedOrganizationIds,
    accessScope.scopedProjectIds,
    accessScope.restrictToAssignedProjects
  )

  return (
    <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href={`/projects/${project.id}`} style={{ color: '#cc3300', textDecoration: 'none', fontSize: '.9rem' }}>
          Back to Project
        </Link>
      </div>

      <div style={{ background: 'white', borderRadius: '10px', padding: '1.5rem 1.75rem', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '.8rem', color: '#8a4a00', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '.35rem' }}>
          Project Photo Gallery
        </div>
        <h1 style={{ margin: 0, fontSize: '1.8rem', color: '#1a1a1a' }}>{project.project_name}</h1>
        <p style={{ margin: '.4rem 0 0', color: '#666' }}>
          All project photos currently attached to daily reports, pour logs, and QA forms.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div style={statCard('#143a52', '#d7e5ef')}>
          <div style={statLabel()}>Total Photos</div>
          <div style={statValue()}>{gallery.counts.total}</div>
        </div>
        <div style={statCard('#cc3300', '#fff0ea')}>
          <div style={statLabel()}>Daily Reports</div>
          <div style={statValue()}>{gallery.counts.daily_reports}</div>
        </div>
        <div style={statCard('#1a1a1a', '#ece7e1')}>
          <div style={statLabel()}>Pour Logs</div>
          <div style={statValue()}>{gallery.counts.pour_logs}</div>
        </div>
        <div style={statCard('#24506d', '#e6eef4')}>
          <div style={statLabel()}>QA Forms</div>
          <div style={statValue()}>{gallery.counts.qa_forms}</div>
        </div>
      </div>

      {gallery.photos.length === 0 ? (
        <div style={{ background: 'white', borderRadius: '10px', padding: '2.5rem', textAlign: 'center', color: '#777', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          No project photos yet.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
          {gallery.photos.map(photo => (
            <div key={photo.id} style={{ background: 'white', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              <a href={photo.url} target="_blank" rel="noopener noreferrer">
                <img
                  src={photo.url}
                  alt={photo.label || photo.source_label || 'Project photo'}
                  style={{ width: '100%', height: '180px', objectFit: 'cover', display: 'block' }}
                />
              </a>
              <div style={{ padding: '.85rem .95rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.5rem', marginBottom: '.45rem' }}>
                  <span style={{ background: '#f3f3f3', color: '#444', borderRadius: '999px', padding: '.22rem .55rem', fontSize: '.72rem', fontWeight: '700' }}>
                    {photo.source_label}
                  </span>
                  {photo.source_date ? (
                    <span style={{ fontSize: '.72rem', color: '#888' }}>{formatDate(photo.source_date)}</span>
                  ) : null}
                </div>
                <div style={{ fontSize: '.88rem', color: '#1a1a1a', fontWeight: '600', lineHeight: '1.4', minHeight: '2.4rem' }}>
                  {photo.label || 'No label'}
                </div>
                <div style={{ fontSize: '.76rem', color: '#888', marginTop: '.45rem' }}>
                  {photo.submitted_by || 'Unknown submitter'}
                </div>
                <Link href={photo.detail_path} style={{ display: 'inline-block', marginTop: '.7rem', fontSize: '.8rem', fontWeight: '700', color: '#cc3300', textDecoration: 'none' }}>
                  Open source →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}

function statCard(background, color) {
  return {
    flex: 1,
    minWidth: '150px',
    background,
    color,
    borderRadius: '10px',
    padding: '1rem 1.1rem',
  }
}

function statLabel() {
  return {
    fontSize: '.75rem',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: '.08em',
    opacity: 0.85,
    marginBottom: '.35rem',
  }
}

function statValue() {
  return {
    fontSize: '1.5rem',
    fontWeight: '800',
  }
}
