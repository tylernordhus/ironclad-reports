import Link from 'next/link'

export default function NewProject() {
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
          <Link href="/projects" style={{ color: '#cc3300', textDecoration: 'none', fontSize: '.9rem' }}>
            ← Back to Projects
          </Link>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ color: '#1a1a1a', fontSize: '1.8rem', marginBottom: '.5rem' }}>
            New Project
          </h1>
          <p style={{ color: '#666', fontSize: '.95rem' }}>
            Add a new project to track reports and pour logs.
          </p>
        </div>

        <form action="/api/projects/create" method="POST">
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '.4rem', color: '#333' }}>
              Project Name
            </label>
            <input name="project_name" required style={inputStyle} placeholder="e.g. Wichita Substation" />
          </div>

          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '.4rem', color: '#333' }}>
              Location / City
            </label>
            <input name="location" required style={inputStyle} placeholder="e.g. Wichita, KS" />
          </div>

          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '.4rem', color: '#333' }}>
              Owner / Client Name <span style={{ fontWeight: '400', color: '#999' }}>(optional)</span>
            </label>
            <input name="client_name" style={inputStyle} placeholder="e.g. Evergy" />
          </div>

          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '.4rem', color: '#333' }}>
              Owner / Client Email <span style={{ fontWeight: '400', color: '#999' }}>(optional)</span>
            </label>
            <input name="client_email" type="email" style={inputStyle} placeholder="e.g. pm@evergy.com" />
          </div>

          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '.4rem', color: '#333' }}>
              Start Date
            </label>
            <input name="start_date" type="date" style={inputStyle} />
          </div>

          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '.4rem', color: '#333' }}>
              Notes <span style={{ fontWeight: '400', color: '#999' }}>(optional)</span>
            </label>
            <textarea name="notes" rows={3} style={{ ...inputStyle, resize: 'vertical' }}
              placeholder="Any additional project details..." />
          </div>

          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '.4rem', color: '#333' }}>
              Status
            </label>
            <select name="status" style={inputStyle}>
              <option value="active">Active</option>
              <option value="complete">Complete</option>
              <option value="on hold">On Hold</option>
            </select>
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
            Create Project
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
