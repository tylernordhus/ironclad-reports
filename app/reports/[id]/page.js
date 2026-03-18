import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export const revalidate = 0

export default async function ReportDetail({ params }) {
  const { data: report, error } = await supabase
    .from('reports')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !report) {
    return <p style={{ padding: '2rem', color: 'red' }}>Report not found.</p>
  }

  return (
    <main style={{ maxWidth: '700px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href="/reports" style={{ color: '#cc3300', textDecoration: 'none', fontSize: '.9rem' }}>
          ← Back to Reports
        </Link>
      </div>

      <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <div style={{ background: '#cc3300', padding: '1.5rem 2rem' }}>
          <h1 style={{ color: 'white', fontSize: '1.5rem', margin: 0 }}>{report.project_name}</h1>
          <p style={{ color: 'rgba(255,255,255,0.8)', margin: '.4rem 0 0', fontSize: '.9rem' }}>
            {report.report_date} · Submitted by {report.submitted_by}
          </p>
        </div>

        <div style={{ padding: '2rem' }}>
          <Field label="Crew Count on Site" value={report.crew_count} />
          <Field label="Weather Conditions" value={report.weather} />
          <Field label="Work Completed Today" value={report.work_completed} />
          <Field label="Equipment Used" value={report.equipment_used} />
          <Field label="Safety / Issues" value={report.safety_issues} />

          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', flexWrap: 'wrap' }}>
            <a
              href={`/api/pdf/${report.id}`}
              style={{
                flex: 1,
                minWidth: '160px',
                padding: '.8rem 1rem',
                background: '#cc3300',
                color: 'white',
                borderRadius: '6px',
                textDecoration: 'none',
                fontWeight: '600',
                fontSize: '.9rem',
                textAlign: 'center'
              }}
            >
              Download PDF
            </a>
            <a
              href={`/api/resend-email/${report.id}`}
              style={{
                flex: 1,
                minWidth: '160px',
                padding: '.8rem 1rem',
                background: 'white',
                color: '#cc3300',
                border: '2px solid #cc3300',
                borderRadius: '6px',
                textDecoration: 'none',
                fontWeight: '600',
                fontSize: '.9rem',
                textAlign: 'center'
              }}
            >
              Resend Email
            </a>
          </div>
        </div>
      </div>
    </main>
  )
}

function Field({ label, value }) {
  return (
    <div style={{ marginBottom: '1.2rem', paddingBottom: '1.2rem', borderBottom: '1px solid #f0f0f0' }}>
      <div style={{ fontSize: '.75rem', fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '.3rem' }}>
        {label}
      </div>
      <div style={{ fontSize: '1rem', color: '#1a1a1a', lineHeight: '1.6' }}>
        {value || '—'}
      </div>
    </div>
  )
}
