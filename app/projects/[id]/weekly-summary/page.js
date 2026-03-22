'use client'

export const dynamic = 'force-dynamic'

import { Suspense, useState, useRef } from 'react'
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
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${m}/${d}/${y}`
}

function WeeklySummaryInner() {
  const params = useParams()
  const projectId = params.id

  const [weekOffset, setWeekOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [reportCount, setReportCount] = useState(0)
  const [summary, setSummary] = useState('')
  const [allPhotos, setAllPhotos] = useState([]) // [{ id, url, label, date, isExtra }]
  const [selectedIds, setSelectedIds] = useState(new Set())
  const nextExtraId = useRef(1000)
  const [generated, setGenerated] = useState(false)
  const [copied, setCopied] = useState(false)

  const bounds = getWeekBounds(weekOffset)

  function changeWeek(delta) {
    const next = weekOffset + delta
    if (next > 0) return
    setWeekOffset(next)
    setGenerated(false)
    setSummary('')
    setAllPhotos([])
    setSelectedIds(new Set())
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

      // Collect all photos from all reports
      const photos = []
      let idx = 0
      for (const report of data.reports || []) {
        if (report.photo_urls?.length) {
          for (let i = 0; i < report.photo_urls.length; i++) {
            photos.push({
              id: idx++,
              url: report.photo_urls[i],
              label: report.photo_labels?.[i] || '',
              date: report.report_date,
            })
          }
        }
      }
      setAllPhotos(photos)
      // Select all by default
      setSelectedIds(new Set(photos.map(p => p.id)))
      setGenerated(true)
    } catch {
      alert('Failed to generate summary. Please try again.')
    }
    setLoading(false)
  }

  function togglePhoto(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelectedIds(new Set(allPhotos.map(p => p.id)))
  }

  function deselectAll() {
    setSelectedIds(new Set())
  }

  async function handleExtraPhotos(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return
    try {
      const newPhotos = []
      for (const file of files) {
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = ev => resolve(ev.target.result)
          reader.onerror = () => reject(new Error(`Failed to read ${file.name}`))
          reader.readAsDataURL(file)
        })
        const id = nextExtraId.current++
        newPhotos.push({ id, url: dataUrl, label: file.name, date: '', isExtra: true })
      }
      setAllPhotos(prev => [...prev, ...newPhotos])
      setSelectedIds(prev => {
        const next = new Set(prev)
        newPhotos.forEach(p => next.add(p.id))
        return next
      })
    } catch {
      alert('One or more photos could not be added. Please try again.')
    }
    e.target.value = ''
  }

  function removeExtraPhoto(id) {
    setAllPhotos(prev => prev.filter(p => p.id !== id))
    setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next })
  }

  async function downloadPdf() {
    setPdfLoading(true)
    try {
      const selected = allPhotos.filter(p => selectedIds.has(p.id))
      const res = await fetch(`/api/reports/weekly-summary/${projectId}/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary,
          selectedPhotos: selected,
          startDate: bounds.start,
          endDate: bounds.end,
          projectName,
        }),
      })
      if (!res.ok) { alert('PDF generation failed.'); setPdfLoading(false); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `weekly-summary-${projectName}-${bounds.start}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('PDF generation failed. Please try again.')
    }
    setPdfLoading(false)
  }

  function copyText() {
    navigator.clipboard.writeText(summary)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const allSelected = allPhotos.length > 0 && selectedIds.size === allPhotos.length

  return (
    <main style={{ maxWidth: '700px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href={'/projects/' + projectId} style={{ color: '#cc3300', textDecoration: 'none', fontSize: '.9rem' }}>
          ← Back to Project
        </Link>
      </div>

      <div style={{ background: 'white', borderRadius: '8px', padding: '2rem', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.6rem', color: '#1a1a1a', marginBottom: '.25rem', marginTop: 0 }}>Weekly Summary</h1>
        <p style={{ color: '#888', fontSize: '.9rem', marginBottom: '1.5rem', marginTop: 0 }}>
          AI-generated from daily reports — edit, select photos, then download as PDF.
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
          style={{ width: '100%', padding: '.9rem', background: '#cc3300', color: 'white', border: 'none', borderRadius: '6px', fontSize: '1rem', fontWeight: '700', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'Generating...' : generated ? 'Regenerate' : 'Generate AI Summary'}
        </button>
      </div>

      {generated && (
        <>
          {/* Editable summary */}
          <div style={{ background: 'white', borderRadius: '8px', padding: '2rem', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.75rem' }}>
              <div>
                <div style={{ fontWeight: '700', color: '#1a1a1a' }}>Summary</div>
                <div style={{ fontSize: '.8rem', color: '#999', marginTop: '.1rem' }}>
                  {projectName} · {fmt(bounds.start)} – {fmt(bounds.end)} · {reportCount} report{reportCount !== 1 ? 's' : ''}
                </div>
              </div>
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

          {/* Photo selection */}
          <div style={{ background: 'white', borderRadius: '8px', padding: '2rem', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontWeight: '700', color: '#1a1a1a' }}>Photos</div>
                <div style={{ fontSize: '.8rem', color: '#999', marginTop: '.1rem' }}>
                  {allPhotos.length === 0 ? 'No photos this week' : `${selectedIds.size} of ${allPhotos.length} selected`}
                </div>
                <div style={{ fontSize: '.75rem', color: '#aaa', marginTop: '.2rem' }}>
                  Daily report photos are loaded automatically. Add extra photos if the weekly report needs more coverage.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                {allPhotos.length > 0 && <>
                  <button onClick={selectAll} disabled={allSelected} style={{ ...smallBtn, opacity: allSelected ? 0.4 : 1 }}>Select All</button>
                  <button onClick={deselectAll} disabled={selectedIds.size === 0} style={{ ...smallBtn, opacity: selectedIds.size === 0 ? 0.4 : 1 }}>Deselect All</button>
                </>}
                <label style={{ ...smallBtn, background: '#1a1a1a', color: 'white', cursor: 'pointer' }}>
                  + Add Photos
                  <input type="file" accept="image/*" multiple onChange={handleExtraPhotos} style={{ display: 'none' }} />
                </label>
              </div>
            </div>

            {allPhotos.length === 0 && (
              <div style={{ color: '#aaa', fontSize: '.9rem', textAlign: 'center', padding: '1rem 0' }}>
                No photos were attached to daily reports this week.
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '.75rem' }}>
              {allPhotos.map(photo => {
                const selected = selectedIds.has(photo.id)
                return (
                  <div
                    key={photo.id}
                    onClick={() => togglePhoto(photo.id)}
                    style={{
                      cursor: 'pointer',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      border: selected ? '3px solid #cc3300' : '3px solid transparent',
                      position: 'relative',
                    }}
                  >
                    <img
                      src={photo.url}
                      alt={photo.label || 'Photo'}
                      style={{ width: '100%', height: '130px', objectFit: 'cover', display: 'block' }}
                    />
                    {/* Checkmark overlay */}
                    <div style={{
                      position: 'absolute',
                      top: '6px',
                      right: '6px',
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      background: selected ? '#cc3300' : 'rgba(0,0,0,0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '13px',
                      fontWeight: '700',
                    }}>
                      {selected ? '✓' : ''}
                    </div>
                    {/* Remove button for extra photos */}
                    {photo.isExtra && (
                      <button
                        onClick={ev => { ev.stopPropagation(); removeExtraPhoto(photo.id) }}
                        style={{ position: 'absolute', top: '6px', left: '6px', width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(0,0,0,0.55)', border: 'none', color: 'white', fontSize: '14px', lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        aria-label="Remove added photo"
                      >
                        ×
                      </button>
                    )}
                    <div style={{ position: 'absolute', left: '6px', bottom: photo.label || photo.date ? '42px' : '6px', background: 'rgba(0,0,0,0.6)', color: 'white', borderRadius: '999px', padding: '3px 8px', fontSize: '.65rem', fontWeight: '700', letterSpacing: '.02em' }}>
                      {photo.isExtra ? 'Added' : 'Daily Report'}
                    </div>
                    {(photo.label || photo.date) && (
                      <div style={{ padding: '.3rem .5rem', background: '#f9f9f9' }}>
                        {photo.label && <div style={{ fontSize: '.75rem', fontWeight: '600', color: '#333', lineHeight: '1.3' }}>{photo.label}</div>}
                        {photo.date && <div style={{ fontSize: '.7rem', color: '#999' }}>{fmt(photo.date)}</div>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '.75rem' }}>
            <button
              onClick={downloadPdf}
              disabled={pdfLoading}
              style={{ flex: 2, padding: '.9rem', background: '#cc3300', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '700', fontSize: '1rem', cursor: pdfLoading ? 'default' : 'pointer', opacity: pdfLoading ? 0.7 : 1 }}
            >
              {pdfLoading ? 'Building PDF...' : `Download PDF${selectedIds.size > 0 ? ` (${selectedIds.size} photo${selectedIds.size !== 1 ? 's' : ''})` : ' (no photos)'}`}
            </button>
            <button
              onClick={copyText}
              style={{ flex: 1, padding: '.9rem', background: copied ? '#e6f4ea' : '#1a1a1a', color: copied ? '#2d7a3a' : 'white', border: 'none', borderRadius: '6px', fontWeight: '600', fontSize: '.9rem', cursor: 'pointer' }}
            >
              {copied ? 'Copied' : 'Copy Text'}
            </button>
          </div>
        </>
      )}
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

const smallBtn = {
  padding: '.3rem .7rem',
  background: '#f0f0f0',
  border: 'none',
  borderRadius: '6px',
  fontSize: '.8rem',
  fontWeight: '600',
  cursor: 'pointer',
  color: '#333',
}
