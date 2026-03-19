import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getUserId } from '@/lib/get-user-id'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

const FORM_LABELS = {
  'daily-report': 'Daily Report',
  'pour-log': 'Pour Log',
  'pour-log-flatwork': 'Flatwork Log',
  'contractor-eval': 'Contractor Evaluation'
}

const FORM_PATHS = {
  'daily-report': '/daily-report',
  'pour-log': '/pour-log',
  'pour-log-flatwork': '/pour-log-flatwork',
  'contractor-eval': '/contractor-eval'
}

export default async function SelectProjectPage(props) {
  const searchParams = await props.searchParams
  const forForm = searchParams?.for || ''

  if (!forForm || !FORM_PATHS[forForm]) {
    redirect('/')
  }

  const user_id = await getUserId()

  const { data: projects } = await supabase
    .from('projects')
    .select('id, project_name')
    .eq('user_id', user_id)
    .order('project_name', { ascending: true })

  const formLabel = FORM_LABELS[forForm]
  const formPath = FORM_PATHS[forForm]

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: '#f5f5f5' }}>
      <div style={{ width: '100%', maxWidth: '500px' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <Link href="/" style={{ color: '#cc3300', textDecoration: 'none', fontSize: '.9rem' }}>
            ← Back to Home
          </Link>
        </div>

        <div style={{ background: 'white', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <div style={{ background: '#1a1a1a', color: 'white', padding: '1.5rem 2rem' }}>
            <div style={{ fontSize: '.8rem', color: 'rgba(255,255,255,0.6)', marginBottom: '.3rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>{formLabel}</div>
            <div style={{ fontSize: '1.3rem', fontWeight: '700' }}>Select a Project</div>
          </div>

          {(!projects || projects.length === 0) ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>
              <p>No projects found.</p>
              <Link href="/projects" style={{ color: '#cc3300', textDecoration: 'none', fontWeight: '600' }}>Create a project first →</Link>
            </div>
          ) : (
            <div>
              {projects.map((project, i) => (
                <Link
                  key={project.id}
                  href={`${formPath}?project_id=${project.id}&project_name=${encodeURIComponent(project.project_name)}`}
                  style={{ textDecoration: 'none' }}
                >
                  <div style={{
                    padding: '1.2rem 2rem',
                    borderBottom: i < projects.length - 1 ? '1px solid #f0f0f0' : 'none',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    color: '#1a1a1a',
                    background: 'white',
                    transition: 'background .15s'
                  }}>
                    <span style={{ fontWeight: '600', fontSize: '.95rem' }}>{project.project_name}</span>
                    <span style={{ color: '#cc3300', fontSize: '.85rem', fontWeight: '600' }}>Select →</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
