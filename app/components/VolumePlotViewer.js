'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { formatVolumePlotIssues } from '@/lib/volume-plot'

export default function VolumePlotViewer({ logId, backHref = '/pour-logs' }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pdfUrl, setPdfUrl] = useState('')
  const [pendingInputs, setPendingInputs] = useState([])
  const [inputValues, setInputValues] = useState({})
  const [issuesSummary, setIssuesSummary] = useState('')
  const pdfUrlRef = useRef('')

  async function requestPlot(inputs) {
    const response = await fetch(`/api/pour-log/volume-plot/${logId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ inputs }),
    })

    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/pdf')) {
      return {
        ok: true,
        blob: await response.blob(),
      }
    }

    let payload = null
    try {
      payload = await response.json()
    } catch {
      payload = null
    }

    return {
      ok: response.ok,
      payload,
    }
  }

  async function loadPlot(inputs = {}) {
    setLoading(true)
    setError('')

    try {
      const result = await requestPlot(inputs)

      if (result.ok && result.blob) {
        const nextPdfUrl = URL.createObjectURL(result.blob)
        if (pdfUrlRef.current) {
          URL.revokeObjectURL(pdfUrlRef.current)
        }
        pdfUrlRef.current = nextPdfUrl
        setPdfUrl(nextPdfUrl)
        setPendingInputs([])
        setIssuesSummary('')
        return
      }

      const payload = result.payload || {}
      const nextPendingInputs = Array.isArray(payload.pendingInputs) ? payload.pendingInputs : []
      const issues = Array.isArray(payload.issues) ? payload.issues : []

      if (!nextPendingInputs.length) {
        throw new Error(
          issues.length
            ? formatVolumePlotIssues(issues)
            : payload.error || 'Could not create the volume plot.'
        )
      }

      setPdfUrl('')
      setPendingInputs(nextPendingInputs)
      setIssuesSummary(issues.length ? formatVolumePlotIssues(issues) : '')
      setInputValues(currentValues => {
        const nextValues = { ...currentValues }
        nextPendingInputs.forEach(item => {
          if (!(item.key in nextValues)) {
            nextValues[item.key] = item.defaultValue ?? ''
          }
        })
        return nextValues
      })
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not create the volume plot.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPlot({})

    return () => {
      if (pdfUrlRef.current) {
        URL.revokeObjectURL(pdfUrlRef.current)
        pdfUrlRef.current = ''
      }
    }
  }, [logId])

  function handleInputChange(key, value) {
    setInputValues(currentValues => ({
      ...currentValues,
      [key]: value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    await loadPlot(inputValues)
  }

  return (
    <main style={{ maxWidth: '1120px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        <Link href={backHref} style={{ color: '#cc3300', textDecoration: 'none', fontSize: '.95rem', fontWeight: 600 }}>
          Back to Pour Log
        </Link>
      </div>

      <div style={{
        background: 'white',
        borderRadius: '10px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
        overflow: 'hidden',
      }}>
        <div style={{ background: '#24506d', color: 'white', padding: '1.25rem 1.5rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.4rem' }}>Concrete Volume Plot</h1>
          <p style={{ margin: '.35rem 0 0', color: 'rgba(255,255,255,0.78)', fontSize: '.92rem' }}>
            This view collects missing shaft values inline so it works inside the mobile app and the web app.
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
              Building volume plot...
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

          {!loading && !error && pendingInputs.length > 0 ? (
            <form onSubmit={handleSubmit} style={{
              display: 'grid',
              gap: '1rem',
              padding: '1rem',
              border: '1px solid #d9e1e7',
              borderRadius: '8px',
              background: '#f9fbfc',
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1rem', color: '#17384d' }}>Missing Inputs</h2>
                <p style={{ margin: '.35rem 0 0', color: '#4b6070', lineHeight: 1.5 }}>
                  Enter the missing values below and rebuild the plot.
                </p>
              </div>

              {issuesSummary ? (
                <div style={{
                  padding: '.9rem 1rem',
                  borderRadius: '8px',
                  background: '#fff6f0',
                  border: '1px solid #f2c6a6',
                  color: '#8a4314',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                }}>
                  {issuesSummary}
                </div>
              ) : null}

              {pendingInputs.map(item => (
                <label key={item.key} style={{ display: 'grid', gap: '.4rem' }}>
                  <span style={{ fontWeight: 600, color: '#17384d' }}>{item.message}</span>
                  <input
                    type="text"
                    value={inputValues[item.key] ?? ''}
                    onChange={(event) => handleInputChange(item.key, event.target.value)}
                    style={{
                      width: '100%',
                      padding: '.8rem .9rem',
                      borderRadius: '8px',
                      border: '1px solid #c9d4dc',
                      fontSize: '1rem',
                    }}
                  />
                </label>
              ))}

              <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap' }}>
                <button
                  type="submit"
                  style={{
                    padding: '.8rem 1rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#1a1a1a',
                    color: 'white',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Build Volume Plot
                </button>
              </div>
            </form>
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
                title="Concrete Volume Plot PDF"
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
