import Link from 'next/link'
import { QA_FORM_TYPE_OPTIONS } from '@/lib/qa-forms'
import { createClient } from '@supabase/supabase-js'
import { getProjectReportTypeSettings, getEnabledQaFormTypes } from '@/lib/project-report-types'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export default async function QaFormSelect({ searchParams }) {
  const projectId = searchParams?.project_id || ''
  const projectName = searchParams?.project_name || ''
  const reportTypeSettings = await getProjectReportTypeSettings(supabase, projectId)
  const enabledTypes = projectId
    ? getEnabledQaFormTypes(reportTypeSettings)
    : QA_FORM_TYPE_OPTIONS

  return (
    <main style={{ maxWidth: '920px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href={projectId ? `/projects/${projectId}` : '/projects'} style={{ color: '#cc3300', textDecoration: 'none', fontSize: '.9rem' }}>
          Back
        </Link>
      </div>

      <h1 style={{ fontSize: '1.8rem', color: '#1a1a1a', marginBottom: '.35rem' }}>QA Form Type</h1>
      <p style={{ color: '#666', marginBottom: '1.5rem' }}>
        Choose the QA form template for {projectName || 'this project'}.
      </p>

      {enabledTypes.length === 0 ? (
        <div style={{
          background: 'white',
          border: '1px solid #e5eaee',
          borderRadius: '10px',
          padding: '1.5rem',
          color: '#666',
        }}>
          QA forms are disabled for this project.
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
        {enabledTypes.map(type => (
          <Link
            key={type.key}
            href={`/qa-form?project_id=${projectId}&project_name=${encodeURIComponent(projectName)}&type=${type.key}`}
            style={{
              background: 'white',
              border: '1px solid #e5eaee',
              borderRadius: '10px',
              padding: '1.25rem',
              textDecoration: 'none',
              boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ color: type.accent, fontSize: '.8rem', fontWeight: '700', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '.45rem' }}>
              {type.code}
            </div>
            <div style={{ color: '#1a1a1a', fontWeight: '700', fontSize: '1.02rem', lineHeight: '1.4' }}>
              {type.title}
            </div>
          </Link>
        ))}
      </div>
    </main>
  )
}
