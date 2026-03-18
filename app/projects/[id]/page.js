import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export const revalidate = 0

export default async function ProjectDetail({ params }) {
  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !project) {
    return <p style={{ padding: '2rem', color: 'red' }}>Project not found.</p>
  }

  const { data: reports } = await supabase
    .from('reports')
    .select('*')
    .eq('project_id', project.id)
    .order('report_date', { ascending: false })

  const { data: pourLogs } = await supabase
    .from('pour_logs')
    .select('*')
    .eq('project_id', project.id)
    .order('log_date', { ascending: false })

  return (
    <main style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href="/projects" style={{ color: '#cc3300', textDecoration: 'none', fontSize: '.9rem' }}>
          Back to Projects
        </Link>
      </div>

      <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '2rem' }}>
        <div style={{ background: '#cc3300', padding: '1.5rem 2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 style={{ color: 'white', fontSize: '1.5rem', margin: 0 }}>{project.project_name}</h1>
              <p style={{ color: 'rgba(255,255,255,0.8)', margin: '.4rem 0 0', fontSize: '.9rem' }}>
                {project.location}{project.address ? ' - ' + project.address : ''}
              </p>
            </div>
            <span style={{
              background: 'rgba(255,255,255,0.2)',
              color: 'white',
              padding: '.25rem .75rem',
              borderRadius: '20px',
              fontSize: '.75rem',
              fontWeight: '600',
              textTransform: 'uppercase'
            }}>
              {project.status}
            </span>
          </div>
        </div>

        <div style={{ padding: '1.5rem 2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem' }}>
            <div>
              <div style={{ fontSize: '.75rem', fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '.3rem' }}>
                Owner / Client
              </div>
              <div style={{ fontSize: '1rem', color: '#1a1a1a' }}>{project.client_name}</div>
            </div>
            <div>
              <div style={{ fontSize: '.75rem', fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '.3rem' }}>
                Client Email
              </div>
              <div style={{ fontSize: '1rem', color: '#1a1a1a' }}>{project.client_email}</div>
            </div>
            {project.start_date && (
              <div>
                <div style={{ fontSize: '.75rem', fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '.3rem' }}>
                  Start Date
                </div>
                <div style={{ fontSize: '1rem', color: '#1a1a1a' }}>{project.start_date}</div>
              </div>
            )}
            {project.notes && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: '.75rem', fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '.3rem' }}>
                  Notes
                </div>
                <div style={{ fontSize: '1rem', color: '#1a1a1a', lineHeight: '1.6' }}>{project.notes}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <Link href={'/daily-report?project_id=' + project.id + '&project_name=' + encodeURIComponent(project.project_name)} style={{
          flex: 1,
          minWidth: '140px',
          padding: '.8rem 1rem',
          background: '#cc3300',
          color: 'white',
          borderRadius: '6px',
          textDecoration: 'none',
          fontWeight: '600',
          fontSize: '.9rem',
          textAlign: 'center'
        }}>
          + Daily Report
        </Link>
        <Link href={'/pour-log?project_id=' + project.id + '&project_name=' + encodeURIComponent(project.project_name)} style={{
          flex: 1,
          minWidth: '140px',
          padding: '.8rem 1rem',
          background: '#1a1a1a',
          color: 'white',
          borderRadius: '6px',
          textDecoration: 'none',
          fontWeight: '600',
          fontSize: '.9rem',
          textAlign: 'center'
        }}>
          + Pour Log
        </Link>
        <Link href={'/projects/' + project.id + '/edit'} style={{
          flex: 1,
          minWidth: '140px',
          padding: '.8rem 1rem',
          background: 'white',
          color: '#1a1a1a',
          border: '2px solid #e5e5e5',
          borderRadius: '6px',
          textDecoration: 'none',
          fontWeight: '600',
          fontSize: '.9rem',
          textAlign: 'center'
        }}>
          Edit Project
        </Link>
      </div>

      <h2 style={{ fontSize: '1.2rem', color: '#1a1a1a', marginBottom: '1rem' }}>Daily Reports</h2>

      {(!reports || reports.length === 0) && (
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: '2rem',
          textAlign: 'center',
          color: '#666',
          marginBottom: '1rem'
        }}>
          No daily reports yet for this project.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
        {reports && reports.map((report) => (
          <Link key={report.id} href={'/reports/' + report.id} style={{ textDecoration: 'none' }}>
            <div style={{
              background: 'white',
              border: '1px solid #e5e5e5',
              borderRadius: '8px',
              padding: '1.2rem 1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontWeight: '700', color: '#1a1a1a', fontSize: '1rem', marginBottom: '.25rem' }}>
                  {report.report_date}
                </div>
                <div style={{ color: '#666', fontSize: '.85rem' }}>
                  {report.submitted_by} - {report.crew_count} crew
                </div>
              </div>
              <div style={{ color: '#cc3300', fontSize: '1.2rem' }}>→</div>
            </div>
          </Link>
        ))}
      </div>

      <h2 style={{ fontSize: '1.2rem', color: '#1a1a1a', marginBottom: '1rem' }}>Pour Logs</h2>

      {(!pourLogs || pourLogs.length === 0) && (
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: '2rem',
          textAlign: 'center',
          color: '#666',
          marginBottom: '1rem'
        }}>
          No pour logs yet for this project.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
        {pourLogs && pourLogs.map((log) => (
          <Link key={log.id} href={'/pour-logs/' + log.id} style={{ textDecoration: 'none' }}>
            <div style={{
              background: 'white',
              border: '1px solid #e5e5e5',
              borderRadius: '8px',
              padding: '1.2rem 1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontWeight: '700', color: '#1a1a1a', fontSize: '1rem', marginBottom: '.25rem' }}>
                  {log.log_date}
                </div>
                <div style={{ color: '#666', fontSize: '.85rem' }}>
                  Drilled Shaft - {log.submitted_by}
                </div>
              </div>
              <div style={{ color: '#1a1a1a', fontSize: '1.2rem' }}>→</div>
            </div>
          </Link>
        ))}
      </div>

    </main>
  )
}
