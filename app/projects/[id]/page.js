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
    .eq('project_name', project.project_name)
    .order('report_date', { ascending: false })

  return (
    <main style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href="/projects" style={{ color: '#cc3300', textDecoration: 'none', fontSize: '.9rem' }}>
          ← Back to Projects
        </Link>
      </div>

      <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '2rem' }}>
        <div style={{ background: '#cc3300', padding: '1.5rem 2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 style={{ color: 'white', fontSize: '1.5rem', margin: 0 }}>{project.project_name}</h1>
              <p style={{ color: 'rgba(255,255,255,0.8)', margin: '.4rem 0 0', fontSize: '.9rem' }}>
                {project.location}{project.address ? ` · ${project.address}` : ''}
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
              <div style={{ fontSize: '.75rem', fontWeight: '700', color: '#999', textTransform: 'uppercase', letter​​​​​​​​​​​​​​​​
