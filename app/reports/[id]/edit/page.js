import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export const revalidate = 0

export default async function EditReport({ params }) {
  const { data: report, error } = await supabase
    .from('reports')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !report) {
    return <p style={{ padding: '2rem', color: 'red' }}>Report not found.</p>
  }

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '8px',
        padding: '2rem',
        width: '100%',
        maxWidth: '600px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <Link href={`/reports/${report.id}`} style={{ color: '#cc3300', textDecoration: 'none', fontSize: '.9rem' }}>
            ← Back to Report
          </Link>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ color: '#1a1a1a', fontSize: '1.8rem', marginBottom: '.5rem' }}>
            Edit Report
          </h1>
          <p style={{ color: '#666', fontSize: '.95rem' }}>
            {report.project_name} · {report.report_date}
          </p>
        </div>

        <form action={`/api/update/${report.id}`} method="POST" encType="multipart/form-data">
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '.4rem', color: '#333' }}>
              Project Name
            </label>
            <input name="project_name" required style={inputStyle} defaultValue={report.project_name} />
          </div>
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '.4rem', color: '#333' }}>
              Report Date
            </label>
            <input name="report_date" type="date" required style={inputStyle} defaultValue={report.report_date} />
          </div>
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '.4rem', color: '#333' }}>
              Crew Count on Site
            </label>
            <input name="crew_count" type="number" required style={inputStyle} defaultValue={report.crew_count} />
          </div>
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '.4rem', color: '#333' }}>
              Work Completed Today
            </label>
            <textarea name="work_completed" required rows={4} style={{ ...inputStyle, resize: 'vertical' }}
              defaultValue={report.work_completed} />
          </div>
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '.4rem', color: '#333' }}>
              Equipment Used
            </label>
            <input name="equipment_used" required style={inputStyle} defaultValue={report.equipment_used} />
          </div>
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '.4rem', color: '#333' }}>
              Safety / Issues
            </label>
            <input name="safety_issues" required style={inputStyle} defaultValue={report.safety_issues} />
          </div>
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '.4rem', color: '#333' }}>
              Weather Conditions
            </label>
            <input name="weather" required style={inputStyle} defaultValue={report.weather} />
          </div>
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '.4rem', color: '#333' }}>
              Submitted By
            </label>
            <input name="submitted_by" required style={inputStyle} defaultValue={report.submitted_by} />
          </div>
          {report.photo_urls && report.photo_urls.length > 0 && (
            <div style={{ marginBottom: '1.2rem' }}>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '.6rem', color: '#333' }}>
                Existing Photos
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '.75rem' }}>
                {report.photo_urls.map((url, i) => (
                  <div key={i}>
                    <img src={url} alt={report.photo_labels?.[i] || `Photo ${i + 1}`} style={{ width: '100%', height: '110px', objectFit: 'cover', borderRadius: '6px', display: 'block' }} />
                    {report.photo_labels?.[i] && (
                      <div style={{ fontSize: '.75rem', color: '#666', marginTop: '.25rem' }}>{report.photo_labels[i]}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '.4rem', color: '#333' }}>
              Add Photos
            </label>
            <input name="add_photos" type="file" accept="image/*" multiple style={inputStyle} />
            <div style={{ fontSize: '.8rem', color: '#888', marginTop: '.35rem' }}>
              New photos will be added to the report. Existing photos stay attached.
            </div>
          </div>
          <button type="submit" style={{
            width: '100%',
            padding: '1rem',
            background: '#cc3300',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '1.1rem',
            fontWeight: '700',
            cursor: 'pointer',
            marginTop: '.5rem'
          }}>
            Save Changes
          </button>
        </form>
      </div>
    </main>
  )
}

const inputStyle = {
  width: '100%',
  padding: '.75rem',
  border: '1px solid #ddd',
  borderRadius: '6px',
  fontSize: '1rem',
  boxSizing: 'border-box'
}
