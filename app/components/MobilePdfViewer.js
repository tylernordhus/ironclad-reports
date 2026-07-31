'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

function sanitizeSourcePath(value) {
  const path = typeof value === 'string' ? value.trim() : ''
  if (!path.startsWith('/')) return ''
  if (path.startsWith('//')) return ''
  if (!path.startsWith('/api/')) return ''
  return path
}

export default function MobilePdfViewer({
  title = 'PDF Viewer',
  srcPath,
  backHref = '/',
  backLabel = 'Back',
}) {
  const safeSrcPath = sanitizeSourcePath(srcPath)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pdfUrl, setPdfUrl] = useState('')
  const pdfUrlRef = useRef('')

  useEffect(() => {
    let cancelled = false

    async function loadPdf() {
      if (!safeSrcPath) {
        setError('Invalid PDF route.')
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')

      try {
        const response = await fetch(safeSrcPath, {
          cache: 'no-store',
          credentials: 'include',
        })

        if (!response.ok) {
          throw new Error('Could not load the PDF.')
        }

        const blob = await response.blob()
        const nextPdfUrl = URL.createObjectURL(blob)

        if (pdfUrlRef.current) {
          URL.revokeObjectURL(pdfUrlRef.current)
        }

        pdfUrlRef.current = nextPdfUrl
        if (!cancelled) {
          setPdfUrl(nextPdfUrl)
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : 'Could not load the PDF.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadPdf()

    return () => {
      cancelled = true
      if (pdfUrlRef.current) {
        URL.revokeObjectURL(pdfUrlRef.current)
        pdfUrlRef.current = ''
      }
    }
  }, [safeSrcPath])

  return (
    <main style={{ maxWidth: '1120px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        <Link href={backHref} style={{ color: '#cc3300', textDecoration: 'none', fontSize: '.95rem', fontWeight: 600 }}>
          {backLabel}
        </Link>
      </div>

      <div style={{
        background: 'white',
        borderRadius: '10px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
        overflow: 'hidden',
      }}>
        <div style={{ background: '#24506d', color: 'white', padding: '1.25rem 1.5rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.4rem' }}>{title}</h1>
          <p style={{ margin: '.35rem 0 0', color: 'rgba(255,255,255,0.78)', fontSize: '.92rem' }}>
            This mobile-friendly viewer loads the PDF inside the app instead of sending the raw file response directly to the WebView.
          </p>
        </div>

        <div style={{ padding: '1rem 1.5rem 1.5rem' }}>
          {loading ? (
            <div style={{
              padding: '2rem 1rem',
              border: '1px solid #dfe6ec',
              borderRadius: '8px',
              background: '#f9fbfc',
              color: '#24506d',
              fontWeight: 600,
            }}>
              Loading PDF...
            </div>
          ) : null}

          {!loading && error ? (
            <div style={{
              padding: '1rem',
              border: '1px solid #f0c4c4',
              borderRadius: '8px',
              background: '#fff6f6',
              color: '#7a1212',
              lineHeight: 1.5,
            }}>
              {error}
            </div>
          ) : null}

          {!loading && !error && pdfUrl ? (
            <>
              <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '.7rem 1rem',
                    background: '#1a1a1a',
                    color: 'white',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    fontWeight: 600,
                    fontSize: '.9rem',
                  }}
                >
                  Open in New Tab
                </a>
              </div>

              <iframe
                title={title}
                src={pdfUrl}
                style={{
                  width: '100%',
                  minHeight: '980px',
                  border: '1px solid #d9e1e7',
                  borderRadius: '8px',
                  background: 'white',
                }}
              />
            </>
          ) : null}
        </div>
      </div>
    </main>
  )
}
