'use client'

export const dynamic = 'force-dynamic'

import { Suspense, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

export default function WeeklySummaryPage() {
  return (
    <Suspense>
      <WeeklySummaryInner />
    </Suspense>
  )
}

function getWeekBounds(offsetWeeks) {
  const now = new Date()
  now.setDate(now.getDate() + offsetWeeks * 7)
  const day = now.getDay()
  const mon = new Date(now)
  mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  return {
    start: mon.toISOString().split('T')[0],
    end: sun.toISOString().split('T')[0],
  }
}

function fmt(dateStr) {
  const [y, m, d] = dateStr.split('-')
  return `${m}/${d}/${y}`
}

function WeeklySummaryInner() {
  const params = useParams()
  const projectId = params.id

  const [weekOffset, setWeekOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [copied, setCopied] = useState(false)

  const bounds = getWeekBounds(weekOffset)

  function changeWeek(delta) {
    const next = weekOffset + delta
    if (next > 0) return
    setWeekOffset(next)
    setResult(null)
  }

  async function generate() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch(
        `/api/reports/weekly-summary/${projectId}?start=${bounds.start}&end=${bounds.end}`
      )
      const data = await res.json()
      setResult(data)
    } catch {
      alert('Failed to generate summary. Please try again.')
    }
    setLoading(false)
  }

  function copyText() {
    if (!result?.summary) return
    navigator.clipboard.writeText(result.summary)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <main style={{ maxWidth: '700px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href={'/projects/' + projectId} style={{ color: '#cc3300', textDecoration: 'none', fontSize: '.9rem' }}>
          Back to Project
        </Link>
      </div>

      <h1 style={{ fontSize: '1.8rem', color: '#1a1a1a', marginBottom: '.25rem' }}>Weekly Summary</h1>
      <p style={{ color: '#666', fontSize: '.9rem', marginBottom: '1.5rem' }}>
        AI-generated summary from daily reports for the selected week.
      </p>

      {/* Week selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', background: 'white', borderRadius: '8px', padding: '1rem 1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <button onClick={() => changeWeek(-1)} style={navBtn}>← Prev</button>
        <div style={{ flex: 1, textAlign: 'center', fontWeight: '600', color: '#1a1a1a', fontSize: '.95rem' }}>
          {fmt(bounds.start)} – {fmt(bounds.end)}
        </div>
        <button onClick={() => changeWeek(1)} disabled={weekOffset >= 0} style={{ ...navBtn, opacity: weekOffset >= 0 ? 0.4 : 1 }}>
          Next →
        </button>
      </div>

      <button
        onClick={generate}
        disabled={loading}
        style={{ width: '100%', padding: '1rem', background: '#cc3300', color: 'white', border: 'none', borderRadius: '6px', fontSize: '1rem', fontWeight: '700', cursor: loading ? 'default' : 'pointer', marginBottom: '1.5rem', opacity: loading ? 0.7 : 1 }}
      >
        {loading ? 'Generating Summary...' : 'Generate AI Weekly Summary'}
      </button>

      {result && !result.summary && (
        <div style={{ background: 'white', borderRadius: '8px', padding: '2rem', textAlign: 'center', color: '#666', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          No daily reports found for this week.
        </div>
      )}

      {result?.summary && (
        <div style={{ background: 'white', borderRadius: '8px', padding: '2rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', gap: '1rem' }}>
            <div>
              <div style={{ fontWeight: '700', color: '#1a1a1a', fontSize: '1rem' }}>{result.project_name}</div>
              <div style={{ fontSize: '.85rem', color: '#888', marginTop: '.2rem' }}>
                {fmt(bounds.start)} – {fmt(bounds.end)} · {result.reports.length} report{result.reports.length !== 1 ? 's' : ''}
              </div>
            </div>
            <button
              onClick={copyText}
              style={{ padding: '.4rem .9rem', background: copied ? '#e6f4ea' : '#f0f0f0', color: copied ? '#2d7a3a' : '#1a1a1a', border: 'none', borderRadius: '6px', fontSize: '.8rem', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              {copied ? 'Copied' : 'Copy Text'}
            </button>
          </div>

          <div style={{ color: '#333', lineHeight: '1.8', fontSize: '.95rem', whiteSpace: 'pre-wrap' }}>
            {result.summary}
          </div>

          <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #f0f0f0' }}>
            <div style={{ fontSize: '.75rem', fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.5rem' }}>
              Source Reports
            </div>
            {result.reports.map(r => (
              <div key={r.report_date} style={{ fontSize: '.85rem', color: '#666', padding: '.2rem 0' }}>
                {fmt(r.report_date)} — {r.submitted_by}, {r.crew_count} crew, {r.weather}
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}

const navBtn = {
  padding: '.4rem .9rem',
  background: '#f0f0f0',
  border: 'none',
  borderRadius: '6px',
  fontSize: '.85rem',
  fontWeight: '600',
  cursor: 'pointer',
  color: '#1a1a1a',
}
