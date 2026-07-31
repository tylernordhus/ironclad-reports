'use client'

import { useState } from 'react'
import { formatVolumePlotIssues } from '@/lib/volume-plot'

export default function VolumePlotButton({ logId }) {
  const [checking, setChecking] = useState(false)

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
      status: response.status,
      payload,
    }
  }

  const handleClick = async () => {
    if (checking) return
    setChecking(true)

    try {
      const inputs = {}

      while (true) {
        const result = await requestPlot(inputs)

        if (result.ok && result.blob) {
          const pdfUrl = URL.createObjectURL(result.blob)
          const previewWindow = window.open(pdfUrl, '_blank', 'noopener,noreferrer')
          if (!previewWindow) {
            window.location.href = pdfUrl
          }
          window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 60_000)
          return
        }

        const payload = result.payload || {}
        const pendingInputs = Array.isArray(payload.pendingInputs) ? payload.pendingInputs : []
        const issues = Array.isArray(payload.issues) ? payload.issues : []

        if (!pendingInputs.length) {
          throw new Error(
            issues.length
              ? formatVolumePlotIssues(issues)
              : payload.error || 'Could not create the volume plot.'
          )
        }

        if (issues.length) {
          window.alert(
            'The volume plot needs a few values before it can be generated:\n\n' +
            formatVolumePlotIssues(issues)
          )
        }

        for (const item of pendingInputs) {
          const initialValue = inputs[item.key] ?? item.defaultValue ?? ''
          const answer = window.prompt(item.message, initialValue)
          if (answer === null) {
            return
          }
          inputs[item.key] = answer
        }
      }
    } catch (error) {
      window.alert(error.message || 'Could not create the volume plot.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={checking}
      style={{
        flex: 1,
        minWidth: '160px',
        padding: '.8rem 1rem',
        background: checking ? '#999' : '#24506d',
        color: 'white',
        borderRadius: '6px',
        border: 'none',
        fontWeight: '600',
        fontSize: '.9rem',
        textAlign: 'center',
        cursor: checking ? 'not-allowed' : 'pointer'
      }}
    >
      {checking ? 'Building Volume Plot...' : 'Create Volume Plot'}
    </button>
  )
}
