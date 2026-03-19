import { redirect } from 'next/navigation'

export default async function DailyReport(props) {
  const searchParams = await props.searchParams
  const project_name = searchParams?.project_name || ''
  const project_id = searchParams?.project_id || ''

  if (!project_id) redirect('/select-project?for=daily-report')

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
          <a href={project_id ? `/projects/${project_id}` : '/'} style={{ color: '#cc3300', textDecoration: 'none', fontSize: '.9rem' }}>
            ← Back
          </a>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ color: '#1a1a1a', fontSize: '1.8rem', marginBottom: '.5rem' }}>
            Daily Report
          </h1>
          {project_name && (
            <p style={{ color: '#cc3300', fontSize: '1rem', fontWeight: '600' }}>
              {project_name}
            </p>
          )}
          <p style={{ color: '#666', fontSize: '.95rem' }}>
            Fill out the form below. Save and send PDF when ready.
          </p>
        </div>

        <form action="/api/submit" method="POST" encType="multipart/form-data">
          <input type="hidden" name="project_id" value={project_id} />

          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '.4rem', color: '#333' }}>
              Project Name
            </label>
            <input
              name="project_name"
              required
              style={inputStyle}
              defaultValue={project_name}
              placeholder="e.g. Wichita Substation"
            />
          </div>
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '.4rem', color: '#333' }}>
              Report Date
            </label>
            <input name="report_date" type="date" required style={inputStyle} />
          </div>
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '.4rem', color: '#333' }}>
              Crew Count on Site
            </label>
            <input name="crew_count" type="number" required style={inputStyle} placeholder="e.g. 8" />
          </div>
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '.4rem', color: '#333' }}>
              Work Completed Today
            </label>
            <textarea name="work_completed" required rows={4} style={{ ...inputStyle, resize: 'vertical' }}
              placeholder="Describe what was accomplished today..." />
          </div>
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '.4rem', color: '#333' }}>
              Equipment Used
            </label>
            <input name="equipment_used" required style={inputStyle} placeholder="e.g. Excavator, skid steer, boom truck" />
          </div>
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '.4rem', color: '#333' }}>
              Safety / Issues
            </label>
            <input name="safety_issues" required style={inputStyle} placeholder="e.g. None, or describe any incidents" />
          </div>
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '.4rem', color: '#333' }}>
              Weather Conditions
            </label>
            <input name="weather" required style={inputStyle} placeholder="e.g. Clear, 58°F" />
          </div>
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '.4rem', color: '#333' }}>
              Submitted By
            </label>
            <input name="submitted_by" required style={inputStyle} placeholder="Your name" />
          </div>
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '.4rem', color: '#333' }}>
              Photos <span style={{ fontWeight: '400', color: '#888', fontSize: '.9rem' }}>(optional)</span>
            </label>
            <input
              name="photos"
              type="file"
              accept="image/*"
              multiple
              style={{ ...inputStyle, padding: '.5rem', cursor: 'pointer' }}
            />
            <p style={{ margin: '.3rem 0 0', fontSize: '.8rem', color: '#888' }}>
              Select one or more photos to attach to this report.
            </p>
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
            Submit Daily Report
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
