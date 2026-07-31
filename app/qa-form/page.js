import Link from 'next/link'
import QaFormEditor from '@/app/components/QaFormEditor'
import { getQaFormDefinition } from '@/lib/qa-forms'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function QaFormPage({ searchParams }) {
  const projectId = searchParams?.project_id || ''
  const projectName = searchParams?.project_name || ''
  const formType = searchParams?.type || ''
  const definition = getQaFormDefinition(formType)

  if (!projectId || !definition) {
    return (
      <main style={{ maxWidth: '760px', margin: '0 auto', padding: '2rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <Link href="/projects" style={{ color: '#cc3300', textDecoration: 'none' }}>
            Back
          </Link>
        </div>
        <p style={{ color: '#7a1212' }}>Choose a valid project and QA form type before creating a QA form.</p>
      </main>
    )
  }

  return (
    <QaFormEditor
      mode="create"
      projectId={projectId}
      projectName={projectName}
      formType={formType}
    />
  )
}
