import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export const revalidate = 0

export default async function EditProject({ params }) {
  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !project) {
    return <p style={{ padding: '2rem', color: 'red' }}>Project not found.</p>
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
          <Link href={`/projects/${project.id}`} style={{ color: '#cc3300', textDecoration: 'none', fontSize: '.9rem' }}>
            ← Back to Project
          </Link>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ color: '#1a1a1a', fontSize: '1.8rem', marginBottom: '.5rem' }}>
            Edit Project
          </h1>
          <p style={{ color: '#666', fontSize: '.95rem' }}>
            {project.project_name}
          </p>
        </div>

        <form action={`/api/projects/update/${project.id}`} method="POST">
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '.4rem', color: '#333' }}>
              Project Name
            </label>
            <input name="project_name" required style={inputStyle} defaultValue={project.project_name} />
          </div>
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '.4rem', color: '#333' }}>
              Location / City
            </label>
            <input name="location" required style={inputStyle} defaultValue={project.location} />
          </div>
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '.4rem', color: '#333' }}>
              Exact Address <span style={{ fontWeight: '400', color: '#999' }}>(optional)</span>
            </label>
            <input name="address" style={inputStyle} defaultValue={project.address || ''} />
          </div>
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '.4rem', color: '#333' }}>
              Owner / Client Name
            </label>
            <input name="client_name" required style={inputStyle} defaultValue={project.client_name} />
          </div>
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '.4rem', color: '#333' }}>
              Owner / Client Email
            </label>
            <input name="client_email" type="email" required style={inputStyle} defaultValue={project.client_email} />
          </div>
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '.4rem', color: '#333' }}>
              Start Date
            </label>
            <input name="start_date" type="date" style={inputStyle} defaultValue={project.start_date || ''} />
          </div>
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '.4rem', color: '#333' }}>
              Notes <span style={{ fontWeight: '400', color: '#999' }}>(optional)</span>
            </label>
            <textarea name="notes" rows={3} style={{ ...inputStyle, resize: 'vertical' }}
              defaultValue={project.notes || ''} />
          </div>
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '.4rem', color: '#333' }}>
              Status
            </label>
            <select name="status" style={inputStyle} defaultValue={project.status}>
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
