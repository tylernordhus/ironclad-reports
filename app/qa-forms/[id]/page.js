import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import QaFormDisplay from '@/app/components/QaFormDisplay'
import { getUserId } from '@/lib/get-user-id'
import { getAccessibleQaFormById } from '@/lib/qa-form-access'
import { getQaFormSummary, normalizeQaFormRecord } from '@/lib/qa-forms'
import { isMissingRelationError } from '@/lib/supabase-errors'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const [year, month, day] = String(dateStr).split('-')
  return `${month}-${day}-${year}`
}

export default async function QaFormDetailPage({ params }) {
  const userId = await getUserId()

  const { qaForm: data, error } = await getAccessibleQaFormById(supabase, { formId: params.id, userId })

  if (isMissingRelationError(error)) {
    return <p style={{ padding: '2rem', color: '#7a1212' }}>QA forms are not available yet. Run the SQL migration first.</p>
  }

  if (error || !data) {
    return <p style={{ padding: '2rem', color: '#7a1212' }}>QA form not found.</p>
  }

  const form = normalizeQaFormRecord(data)
  const summary = getQaFormSummary(form)

  return (
    <main style={{ maxWidth: '980px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href={form.project_id ? `/projects/${form.project_id}` : '/reports'} style={{ color: '#cc3300', textDecoration: 'none', fontSize: '.9rem' }}>
          Back
        </Link>
      </div>

      <div style={{ background: 'white', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '1.5rem' }}>
        <div style={{ background: summary.accent, padding: '1.4rem 1.8rem' }}>
          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '.82rem', letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 700 }}>
            {summary.code}
          </div>
          <h1 style={{ color: 'white', fontSize: '1.45rem', margin: '.3rem 0 0' }}>{summary.title}</h1>
          <p style={{ color: 'rgba(255,255,255,0.82)', margin: '.4rem 0 0', fontSize: '.92rem' }}>
            {form.project_name} · {formatDate(form.work_date)} · Submitted by {form.submitted_by || '-'}
          </p>
        </div>

        <div style={{ padding: '1.4rem 1.8rem' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <a
              href={`/api/qa-form/pdf/${form.id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1,
                minWidth: '160px',
                padding: '.8rem 1rem',
                background: '#1a1a1a',
                color: 'white',
                borderRadius: '6px',
                textDecoration: 'none',
                fontWeight: '600',
                textAlign: 'center',
              }}
            >
              View PDF
            </a>
            <Link
              href={`/qa-forms/${form.id}/edit`}
              style={{
                flex: 1,
                minWidth: '160px',
                padding: '.8rem 1rem',
                background: '#cc3300',
                color: 'white',
                borderRadius: '6px',
                textDecoration: 'none',
                fontWeight: '600',
                textAlign: 'center',
              }}
            >
              Edit QA Form
            </Link>
          </div>
        </div>
      </div>

      <QaFormDisplay record={form} />

      {form.photo_urls?.length ? (
        <div style={{ background: 'white', border: '1px solid #e5eaee', borderRadius: '10px', padding: '1.25rem', marginTop: '1rem' }}>
          <h2 style={{ margin: '0 0 1rem', color: '#1a1a1a', fontSize: '1.1rem' }}>Photos</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '.85rem' }}>
            {form.photo_urls.map((url, index) => (
              <div key={`${url}-${index}`}>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <img src={url} alt={form.photo_labels?.[index] || `Photo ${index + 1}`} style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '8px', display: 'block' }} />
                </a>
                {form.photo_labels?.[index] ? (
                  <div style={{ fontSize: '.8rem', color: '#555', marginTop: '.35rem', lineHeight: '1.4' }}>{form.photo_labels[index]}</div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </main>
  )
}
