'use client'

import { useState } from 'react'
import { formatVolumePlotIssues } from '@/lib/volume-plot'

export default function PourLogPdfButton({ logId }) {
  const [loading, setLoading] = useState(false)

  async function requestPdf(inputs, skipVolumePlot) {
    const response = await fetch(`/api/pour-log/pdf/${logId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ inputs, skipVolumePlot }),
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
      status: response.status,
      payload,
    }
  }

  function openPdfBlob(blob) {
    const pdfUrl = URL.createObjectURL(blob)
    const previewWindow = window.open(pdfUrl, '_blank', 'noopener,noreferrer')
    if (!previewWindow) {
      window.location.href = pdfUrl
    }
    window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 60_000)
  }

  const handleClick = async () => {
    if (loading) return
    setLoading(true)

    try {
      const inputs = {}

      while (true) {
        const result = await requestPdf(inputs, false)

        if (result.ok && result.blob) {
          openPdfBlob(result.blob)
          return
        }

        const payload = result.payload || {}
        const pendingInputs = Array.isArray(payload.pendingInputs) ? payload.pendingInputs : []
        const issues = Array.isArray(payload.issues) ? payload.issues : []

        if (result.status !== 409) {
          throw new Error(
            issues.length
              ? formatVolumePlotIssues(issues)
              : payload.error || 'Could not create the PDF.'
          )
        }

        const summary = issues.length
          ? formatVolumePlotIssues(issues)
          : payload.summary || 'The volume plot needs a few more values.'

        const continueWithPlot = window.confirm(
          `${summary}\n\nPress OK to enter the missing values and include the volume plot.\nPress Cancel to create the PDF without the volume plot.`
        )

        if (!continueWithPlot) {
          const plainPdf = await requestPdf({}, true)
          if (plainPdf.ok && plainPdf.blob) {
            openPdfBlob(plainPdf.blob)
            return
          }

          const plainPayload = plainPdf.payload || {}
          throw new Error(plainPayload.error || 'Could not create the PDF without the volume plot.')
        }

        for (const item of pendingInputs) {
          const initialValue = inputs[item.key] ?? item.defaultValue ?? ''
          const answer = window.prompt(item.message, initialValue)
          if (answer === null) {
            return
          }
          inputs[item.key] = answer
        }

        if (!pendingInputs.length && issues.length) {
          window.alert(summary)
          return
        }
      }
    } catch (error) {
      window.alert(error.message || 'Could not create the PDF.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      style={{
        flex: 1,
        minWidth: '140px',
        padding: '.8rem 1rem',
        background: loading ? '#666' : '#1a1a1a',
        color: 'white',
        borderRadius: '6px',
        border: 'none',
        fontWeight: '600',
        fontSize: '.9rem',
        textAlign: 'center',
        cursor: loading ? 'not-allowed' : 'pointer'
      }}
    >
      {loading ? 'Building PDF...' : 'View PDF'}
    </button>
  )
}
