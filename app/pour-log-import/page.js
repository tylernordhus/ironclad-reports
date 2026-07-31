'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { preparePhotoFileForUpload } from '@/lib/client-photo-upload'
import { HANDWRITTEN_IMPORT_STORAGE_KEY } from '@/lib/pour-log-handwritten-import'

function InfoList({ title, items, tone = 'default' }) {
  if (!items?.length) return null

  const colors = tone === 'warning'
    ? { bg: '#fff7e8', border: '#f0c36d', text: '#7a5410' }
    : { bg: '#f6f8fb', border: '#d7dee8', text: '#334155' }

  return (
    <div style={{
      background: colors.bg,
      border: `1px solid ${colors.border}`,
      borderRadius: '10px',
      padding: '1rem',
    }}>
      <div style={{ fontWeight: '700', color: '#1a1a1a', marginBottom: '.6rem' }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '.45rem' }}>
        {items.map((item, index) => (
          <div key={`${title}-${index}`} style={{ color: colors.text, fontSize: '.92rem' }}>
            {item}
          </div>
        ))}
      </div>
    </div>
  )
}

function HandwrittenPourLogImportContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('project_id') || ''
  const projectName = searchParams.get('project_name') || ''

  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [truckCount, setTruckCount] = useState('10')

  useEffect(() => {
    if (!projectId) {
      router.replace('/select-project?for=pour-log')
    }
  }, [projectId, router])

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setError('')
    setResult(null)

    try {
      const normalizedFile = String(file.type || '').toLowerCase() === 'application/pdf'
        ? file
        : await preparePhotoFileForUpload(file)

      if (previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl)
      }

      setSelectedFile(normalizedFile)
      setPreviewUrl(normalizedFile.type === 'application/pdf' ? '' : URL.createObjectURL(normalizedFile))
    } catch (nextError) {
      setSelectedFile(null)
      setPreviewUrl('')
      setError(nextError.message || 'Could not prepare that file for import.')
    }
  }

  const handleExtract = async () => {
    if (!selectedFile) return

    setSubmitting(true)
    setError('')
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('files', selectedFile)

      const response = await fetch('/api/pour-log/handwritten-import', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.error || 'Handwritten import failed.')
      }

      setResult(data)
    } catch (nextError) {
      setError(nextError.message || 'Handwritten import failed.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReviewInForm = () => {
    if (!result?.draft || typeof window === 'undefined') return

    const nextDraft = {
      ...result.draft,
      project_id: projectId,
      project_name: result.draft.project_name || projectName,
    }

    window.localStorage.setItem(HANDWRITTEN_IMPORT_STORAGE_KEY, JSON.stringify(nextDraft))
    router.push(`/pour-log?project_id=${encodeURIComponent(projectId)}&project_name=${encodeURIComponent(projectName)}&import_draft=1`)
  }

  const draft = result?.draft

  return (
    <main style={{ maxWidth: '760px', margin: '0 auto', padding: '1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <a
          href={projectId ? `/pour-log-select?project_id=${projectId}&project_name=${encodeURIComponent(projectName)}` : '/'}
          style={{ color: '#cc3300', textDecoration: 'none', fontSize: '.9rem' }}
        >
          Back
        </a>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
        <h1 style={{ color: '#1a1a1a', fontSize: '1.9rem', marginBottom: '.45rem' }}>
          Import Handwritten Pour Log
        </h1>
        {projectName && (
          <p style={{ color: '#cc3300', fontWeight: '700', margin: 0 }}>{projectName}</p>
        )}
      </div>

      <div style={{
        background: '#f6f8fb',
        border: '1px solid #d7dee8',
        borderRadius: '12px',
        padding: '1.2rem',
        marginBottom: '1.25rem',
      }}>
        <div style={{ fontWeight: '700', color: '#1a1a1a', marginBottom: '.5rem' }}>
          Recommended Workflow
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem', color: '#475569', fontSize: '.95rem' }}>
          <div>1. Print the blank drilled shaft form from the app.</div>
          <div>2. Fill out one form page by hand.</div>
          <div>3. Upload one straight-on photo or one scanned PDF.</div>
          <div>4. Review every imported field before saving.</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '.8rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <form
          action="/api/pour-log/blank-form"
          method="GET"
          target="_blank"
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '.65rem',
            background: '#1f3d59',
            color: 'white',
            padding: '.75rem .9rem',
            borderRadius: '10px',
          }}
        >
          <input type="hidden" name="project_name" value={projectName} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
            <label style={{ fontSize: '.76rem', fontWeight: '700' }}>Trucks On Paper Copy</label>
            <input
              type="number"
              name="truck_count"
              min="1"
              max="40"
              value={truckCount}
              onChange={event => setTruckCount(event.target.value)}
              style={{
                width: '72px',
                padding: '.45rem .5rem',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,.28)',
                background: 'white',
                color: '#1a1a1a',
                fontWeight: '700',
              }}
            />
          </div>
          <button
            type="submit"
            style={{
              border: 'none',
              background: 'transparent',
              color: 'white',
              padding: '.6rem 0',
              fontWeight: '700',
              cursor: 'pointer',
            }}
          >
            Print Blank Form
          </button>
        </form>
        <a
          href={projectId ? `/pour-log?project_id=${projectId}&project_name=${encodeURIComponent(projectName)}` : '/pour-log'}
          style={{
            textDecoration: 'none',
            background: '#f3f4f6',
            color: '#1a1a1a',
            padding: '.85rem 1rem',
            borderRadius: '10px',
            fontWeight: '700',
            border: '1px solid #d1d5db',
          }}
        >
          Start Manually Instead
        </a>
      </div>

      <div style={{
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '1.25rem',
        marginBottom: '1.5rem',
      }}>
        <label style={{ display: 'block', fontWeight: '700', color: '#1a1a1a', marginBottom: '.6rem' }}>
          Upload One Photo or PDF Scan
        </label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
          onChange={handleFileChange}
          style={{ marginBottom: '.8rem' }}
        />
        <div style={{ color: '#64748b', fontSize: '.9rem', marginBottom: '1rem' }}>
          Best results come from one flat, well-lit page photo or one scanned PDF of the printed form.
        </div>

        {selectedFile && (
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '1rem',
            marginBottom: '1rem',
          }}>
            <div style={{ fontWeight: '700', marginBottom: '.5rem', color: '#1a1a1a' }}>
              Selected File
            </div>
            <div style={{ color: '#475569', fontSize: '.92rem', marginBottom: previewUrl ? '.75rem' : 0 }}>
              {selectedFile.name}
            </div>
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Handwritten pour log preview"
                style={{ width: '100%', maxHeight: '420px', objectFit: 'contain', borderRadius: '8px', background: '#fff' }}
              />
            )}
          </div>
        )}

        {error && (
          <div style={{
            background: '#fff1f2',
            border: '1px solid #f5c2c7',
            borderRadius: '10px',
            padding: '1rem',
            color: '#8a2230',
            marginBottom: '1rem',
          }}>
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleExtract}
          disabled={!selectedFile || submitting}
          style={{
            padding: '.9rem 1.1rem',
            borderRadius: '10px',
            border: 'none',
            background: submitting ? '#94a3b8' : '#cc3300',
            color: 'white',
            fontWeight: '700',
            cursor: !selectedFile || submitting ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? 'Reading Handwritten Form…' : 'Extract Handwritten Form'}
        </button>
      </div>

      {draft && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{
            background: '#fff7e8',
            border: '1px solid #f0c36d',
            borderRadius: '12px',
            padding: '1rem 1.1rem',
          }}>
            <div style={{ fontWeight: '800', color: '#7a5410', marginBottom: '.4rem' }}>
              Check Import For Accuracy
            </div>
            <div style={{ color: '#7a5410', fontSize: '.94rem' }}>
              This import is only a draft. Review every field against the handwritten sheet before saving it into the website.
            </div>
          </div>

          <div style={{
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '1.25rem',
          }}>
            <div style={{ fontWeight: '700', color: '#1a1a1a', marginBottom: '.8rem' }}>Imported Summary</div>
            <div style={{ display: 'grid', gap: '.55rem', color: '#334155', fontSize: '.94rem' }}>
              <div><strong>Project:</strong> {draft.project_name || projectName || '-'}</div>
              <div><strong>Date:</strong> {draft.log_date || '-'}</div>
              <div><strong>Supplier:</strong> {draft.concrete_supplier || '-'}</div>
              <div><strong>Submitted By:</strong> {draft.submitted_by || '-'}</div>
              <div><strong>Foundations:</strong> {draft.foundations?.filter(f => f.foundation_id).length || 0}</div>
              <div><strong>Trucks:</strong> {draft.trucks?.filter(t => t.truck_number || t.yards).length || 0}</div>
            </div>
          </div>

          <InfoList title="Review Notes" items={draft.review_notes} tone="warning" />
          <InfoList title="Low Confidence Fields" items={draft.low_confidence_fields} tone="warning" />
          <InfoList title="Missing Fields" items={draft.missing_fields} />
          {draft.remarks_issues && (
            <div style={{
              background: '#f8fafc',
              border: '1px solid #dbe2ea',
              borderRadius: '10px',
              padding: '1rem',
              color: '#334155',
            }}>
              <div style={{ fontWeight: '700', color: '#1a1a1a', marginBottom: '.4rem' }}>
                Handwritten Remarks / Issues
              </div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{draft.remarks_issues}</div>
            </div>
          )}

          <button
            type="button"
            onClick={handleReviewInForm}
            style={{
              alignSelf: 'flex-start',
              padding: '1rem 1.2rem',
              borderRadius: '10px',
              border: 'none',
              background: '#1f3d59',
              color: 'white',
              fontWeight: '800',
              cursor: 'pointer',
            }}
          >
            Review In Pour Log Form
          </button>
        </div>
      )}
    </main>
  )
}

function ImportPageFallback() {
  return (
    <main style={{ maxWidth: '760px', margin: '0 auto', padding: '1.5rem' }}>
      <div style={{ textAlign: 'center', marginTop: '3rem', color: '#475569' }}>
        Loading import page...
      </div>
    </main>
  )
}

export default function HandwrittenPourLogImportPage() {
  return (
    <Suspense fallback={<ImportPageFallback />}>
      <HandwrittenPourLogImportContent />
    </Suspense>
  )
}
