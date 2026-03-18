import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export const revalidate = 0

export default async function ReportsPage() {
  const { data: reports, error } = await supabase
    .from('reports')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return <p style={{ padding: '2rem', color: 'red' }}>Error loading reports: {error.message}</p>
  }

  return (
    <main style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.8rem', color: '#1a1a1a' }}>All Reports</h1>
        <Link href="/" style={{
          padding: '.6rem 1.2rem',
          background: '#cc3300',
          color: 'white',
          borderRadius: '6px',
          textDecoration: 'none',
          fontWeight: '600',
          fontSize: '.9rem'
        }}>
          + New Report
        </Link>
      </div>

      {reports.length === 0 && (
        <p style={{ color: '#666' }}>No reports submitted yet.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {reports.map((report) => (
          <Link key={report.id} href={`/reports/${report.id}`} style={{ textDecoration: 'none' }}>
            <div style={{
              background: 'white',
              border: '1px solid #e5e5e5',
              borderRadius: '8px',
              padding: '1.2rem 1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
              transition: 'box-shadow 0.15s'
            }}>
              <div>
                <div style={{ fontWeight: '700', color: '#1a1a1a', fontSize: '1rem', marginBottom: '.25rem' }}>
                  {report.project_name}
                </div>
                <div style={{ color: '#666', fontSize: '.85rem' }}>
                  {report.report_date} &nbsp;·&nbsp; {report.submitted_by} &nbsp;·&nbsp; {report.crew_count} crew
                </div>
              </div>
              <div style={{ color: '#cc3300', fontSize: '1.2rem' }}>→</div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  )
}
