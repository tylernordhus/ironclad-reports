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
  const [projectName, setProjectName] = useState('')
  const [reportCount, setReportCount] = useState(0)
  const [summary, setSummary] = useState('')
  const [generated, setGenerated] = useState(false)
  const [copied, setCopied] = useState(false)

  const bounds = getWeekBounds(weekOffset)

  function changeWeek(delta) {
    const next = weekOffset + delta
    if (next > 0) return
    setWeekOffset(next)
    setGenerated(false)
    setSummary('')
  }

  async function generate() {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/reports/weekly-summary/${projectId}?start=${bounds.start}&end=${bounds.end}`
      )
      const data = await res.json()
      if (!data.summary) {
        alert('No daily reports found for this week.')
        setLoading(false)
        return
      }
      setSummary(data.summary)
      setProjectName(data.project_name || '')
      setReportCount(data.reports?.length || 0)
      setGenerated(true)
    } catch {
      alert('Failed to generate summary. Please try again.')
    }
    setLoading(false)
  }

  function copyText() {
    navigator.clipboard.writeText(summary)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <main style={{ maxWidth: '700px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href={'/projects/' + projectId} style={{ color: '#cc3300', textDecoration: 'none', fontSize: '.9rem' }}>
          ← Back to Project
        </Link>
      </div>

      <div style={{ background: 'white', borderRadius: '8px', padding: '2rem', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <h1 style={{ fontSize: '1.6rem', color: '#1a1a1a', marginBottom: '.25rem', marginTop: 0 }}>Weekly Summary</h1>
        <p style={{ color: '#888', fontSize: '.9rem', marginBottom: '1.5rem', marginTop: 0 }}>
          AI-generated from daily reports — edit before copying or saving.
        </p>

        {/* Week selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', background: '#f9f9f9', borderRadius: '8px', padding: '.75rem 1rem' }}>
          <button onClick={() => changeWeek(-1)} style={navBtn}>← Prev</button>
          <div style={{ flex: 1, textAlign: 'center', fontWeight: '600', color: '#1a1a1a', fontSize: '.95rem' }}>
            {fmt(bounds.start)} – {fmt(bounds.end)}
          </div>
          <button onClick={() => changeWeek(1)} disabled={weekOffset >= 0} style={{ ...navBtn, opacity: weekOffset >= 0 ? 0.35 : 1 }}>
            Next →
          </button>
        </div>

        <button
          onClick={generate}
          disabled={loading}
          style={{ width: '100%', padding: '.9rem', background: '#cc3300', color: 'white', border: 'none', borderRadius: '6px', fontSize: '1rem', fontWeight: '700', cursor: loading ? 'default' : 'pointer', marginBottom: '1.5rem', opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'Generating...' : generated ? 'Regenerate' : 'Generate AI Summary'}
        </button>

        {generated && (
          <>
            {/* Meta */}
            <div style={{ fontSize: '.8rem', color: '#999', marginBottom: '.75rem' }}>
              {projectName} · {fmt(bounds.start)} – {fmt(bounds.end)} · based on {reportCount} report{reportCount !== 1 ? 's' : ''}
            </div>

            {/* Editable summary */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.4rem' }}>
                <label style={{ fontWeight: '600', fontSize: '.9rem', color: '#333' }}>Summary</label>
                <span style={{ fontSize: '.75rem', color: '#aaa' }}>Edit as needed</span>
              </div>
              <textarea
                value={summary}
                onChange={e => setSummary(e.target.value)}
                rows={12}
                style={{
                  width: '100%',
                  padding: '.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '.95rem',
                  lineHeight: '1.7',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  color: '#1a1a1a',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '.75rem' }}>
              <button
                onClick={copyText}
                style={{
                  flex: 1,
                  padding: '.75rem',
                  background: copied ? '#e6f4ea' : '#1a1a1a',
                  color: copied ? '#2d7a3a' : 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: '600',
                  fontSize: '.9rem',
                  cursor: 'pointer',
                }}
              >
                {copied ? 'Copied' : 'Copy Text'}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  )
}

const navBtn = {
  padding: '.4rem .85rem',
  background: 'white',
  border: '1px solid #e5e5e5',
  borderRadius: '6px',
  fontSize: '.85rem',
  fontWeight: '600',
  cursor: 'pointer',
  color: '#1a1a1a',
}
