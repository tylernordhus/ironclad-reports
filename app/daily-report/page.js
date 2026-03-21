'use client'

export const dynamic = 'force-dynamic'

import { Suspense, useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

export default function DailyReport() {
  return (
    <Suspense>
      <DailyReportInner />
    </Suspense>
  )
}

function DailyReportInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const project_id = searchParams.get('project_id') || ''
  const project_name_param = searchParams.get('project_name') || ''

  const [fields, setFields] = useState({
    project_name: project_name_param,
    report_date: '',
    crew_count: '',
    work_completed: '',
    equipment_used: '',
    safety_issues: '',
    weather: '',
    submitted_by: '',
  })
  const [copyState, setCopyState] = useState('idle') // idle | loading | copied | none
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [polishState, setPolishState] = useState('idle') // idle | loading | done
  const [photoEntries, setPhotoEntries] = useState([{ id: 1, label: '' }])
  const [submitting, setSubmitting] = useState(false)
  const fileRefs = useRef({})
  const nextPhotoId = useRef(2)

  useEffect(() => {
    if (!project_id) router.replace('/select-project?for=daily-report')
  }, [project_id, router])

  // Auto-fill crew, equipment, submitted_by from last report on load
  useEffect(() => {
    if (!project_id) return
    fetch(`/api/reports/latest/${project_id}`)
      .then(r => r.json())
      .then(({ report }) => {
        if (!report) return
        setFields(f => ({
          ...f,
          crew_count: f.crew_count || String(report.crew_count ?? ''),
          equipment_used: f.equipment_used || report.equipment_used || '',
          submitted_by: f.submitted_by || report.submitted_by || '',
        }))
      })
      .catch(() => {})
  }, [project_id])

  // Auto-fill weather from project location
  useEffect(() => {
    if (!project_id) return
    setWeatherLoading(true)
    fetch(`/api/weather/${project_id}`)
      .then(r => r.json())
      .then(({ weather }) => {
        if (weather) setFields(f => ({ ...f, weather: f.weather || weather }))
        setWeatherLoading(false)
      })
      .catch(() => setWeatherLoading(false))
  }, [project_id])

  function set(field) {
    return (e) => setFields(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleCopy() {
    setCopyState('loading')
    try {
      const res = await fetch(`/api/reports/latest/${project_id}`)
      const { report } = await res.json()
      if (!report) { setCopyState('none'); return }
      setFields(f => ({
        ...f,
        project_name: report.project_name || f.project_name,
        crew_count: String(report.crew_count ?? f.crew_count),
        work_completed: report.work_completed || '',
        equipment_used: report.equipment_used || '',
        safety_issues: report.safety_issues || '',
        weather: report.weather || '',
        submitted_by: report.submitted_by || '',
      }))
      setCopyState('copied')
    } catch {
      setCopyState('idle')
    }
  }

  async function handlePolish() {
    if (!fields.work_completed.trim()) return
    setPolishState('loading')
    try {
      const res = await fetch('/api/reports/polish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: fields.work_completed }),
      })
      const { polished } = await res.json()
      if (polished) {
        setFields(f => ({ ...f, work_completed: polished }))
        setPolishState('done')
        setTimeout(() => setPolishState('idle'), 3000)
      } else {
        setPolishState('idle')
      }
    } catch {
      setPolishState('idle')
    }
  }

  function addPhoto() {
    const id = nextPhotoId.current++
    setPhotoEntries(prev => [...prev, { id, label: '' }])
  }

  function removePhoto(id) {
    setPhotoEntries(prev => prev.filter(e => e.id !== id))
    delete fileRefs.current[id]
  }

  function setPhotoLabel(id, label) {
    setPhotoEntries(prev => prev.map(e => e.id === id ? { ...e, label } : e))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)

    const fd = new FormData()
    fd.append('project_id', project_id)
    fd.append('project_name', fields.project_name)
    fd.append('report_date', fields.report_date)
    fd.append('crew_count', fields.crew_count)
    fd.append('work_completed', fields.work_completed)
    fd.append('equipment_used', fields.equipment_used)
    fd.append('safety_issues', fields.safety_issues)
    fd.append('weather', fields.weather)
    fd.append('submitted_by', fields.submitted_by)

    for (const entry of photoEntries) {
      const fileInput = fileRefs.current[entry.id]
      if (fileInput?.files?.[0]) {
        fd.append('photos', fileInput.files[0])
        fd.append('photo_labels', entry.label || '')
      }
    }

    try {
      await fetch('/api/submit', { method: 'POST', body: fd })
      router.push(`/projects/${project_id}`)
    } catch {
      alert('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ background: 'white', borderRadius: '8px', padding: '2rem', width: '100%', maxWidth: '600px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <a href={project_id ? `/projects/${project_id}` : '/'} style={{ color: '#cc3300', textDecoration: 'none', fontSize: '.9rem' }}>
            ← Back
          </a>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h1 style={{ color: '#1a1a1a', fontSize: '1.8rem', marginBottom: '.5rem' }}>Daily Report</h1>
          {project_name_param && (
            <p style={{ color: '#cc3300', fontSize: '1rem', fontWeight: '600', margin: 0 }}>{project_name_param}</p>
          )}
        </div>

        {/* Copy Previous Report */}
        <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f9f9f9', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: '600', fontSize: '.9rem', color: '#1a1a1a' }}>Copy Previous Report</div>
            <div style={{ fontSize: '.8rem', color: '#888', marginTop: '.1rem' }}>
              {copyState === 'copied' && 'All fields pre-filled — review and edit before submitting.'}
              {copyState === 'none' && 'No previous report found for this project.'}
              {(copyState === 'idle' || copyState === 'loading') && 'Pre-fill all fields from the last report on this project.'}
            </div>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            disabled={copyState === 'loading' || copyState === 'copied'}
            style={{
              padding: '.55rem 1.1rem',
              background: copyState === 'copied' ? '#e6f4ea' : '#1a1a1a',
              color: copyState === 'copied' ? '#2d7a3a' : 'white',
              border: 'none', borderRadius: '6px', fontSize: '.85rem', fontWeight: '600',
              cursor: copyState === 'loading' || copyState === 'copied' ? 'default' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {copyState === 'loading' ? 'Loading...' : copyState === 'copied' ? 'Copied' : 'Copy Previous'}
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Project Name</label>
            <input name="project_name" required style={inputStyle} value={fields.project_name} onChange={set('project_name')} placeholder="e.g. Wichita Substation" />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Report Date</label>
            <input name="report_date" type="date" required style={inputStyle} value={fields.report_date} onChange={set('report_date')} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Crew Count on Site</label>
            <input name="crew_count" type="number" required style={inputStyle} value={fields.crew_count} onChange={set('crew_count')} placeholder="e.g. 8" />
          </div>

          {/* Work Completed — with AI Polish */}
          <div style={fieldStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.4rem' }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Work Completed Today</label>
              <button
                type="button"
                onClick={handlePolish}
                disabled={polishState === 'loading' || !fields.work_completed.trim()}
                style={{
                  padding: '.3rem .75rem',
                  background: polishState === 'done' ? '#e6f4ea' : '#f0f0f0',
                  color: polishState === 'done' ? '#2d7a3a' : '#555',
                  border: 'none', borderRadius: '6px', fontSize: '.75rem', fontWeight: '600',
                  cursor: polishState === 'loading' || !fields.work_completed.trim() ? 'default' : 'pointer',
                  opacity: !fields.work_completed.trim() ? 0.5 : 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {polishState === 'loading' ? 'Polishing...' : polishState === 'done' ? 'Polished' : 'AI Polish'}
              </button>
            </div>
            <textarea
              name="work_completed"
              required
              style={{ ...inputStyle, resize: 'vertical', minHeight: '130px', lineHeight: '1.6' }}
              value={fields.work_completed}
              onChange={set('work_completed')}
              onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
              placeholder="Describe what was accomplished today — e.g. Poured footings on grid lines A1-A4, set rebar cages for columns B2-B6, graded pad area for building 3..."
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Equipment Used</label>
            <input name="equipment_used" required style={inputStyle} value={fields.equipment_used} onChange={set('equipment_used')} placeholder="e.g. Excavator, skid steer, boom truck" />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Safety / Issues</label>
            <input name="safety_issues" required style={inputStyle} value={fields.safety_issues} onChange={set('safety_issues')} placeholder="e.g. None, or describe any incidents" />
          </div>
          <div style={fieldStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.4rem' }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Weather Conditions</label>
              {weatherLoading && <span style={{ fontSize: '.75rem', color: '#aaa' }}>Fetching weather...</span>}
            </div>
            <input name="weather" required style={inputStyle} value={fields.weather} onChange={set('weather')} placeholder="e.g. Clear, 58°F" />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Submitted By</label>
            <input name="submitted_by" required style={inputStyle} value={fields.submitted_by} onChange={set('submitted_by')} placeholder="Your name" />
          </div>

          {/* Photos with labels */}
          <div style={fieldStyle}>
            <label style={labelStyle}>
              Photos <span style={{ fontWeight: '400', color: '#888', fontSize: '.9rem' }}>(optional)</span>
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
              {photoEntries.map((entry, idx) => (
                <div key={entry.id} style={{ background: '#f9f9f9', borderRadius: '6px', padding: '.75rem', display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                    <span style={{ fontSize: '.8rem', color: '#888', minWidth: '55px' }}>Photo {idx + 1}</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      ref={el => { fileRefs.current[entry.id] = el }}
                      style={{ flex: 1, fontSize: '.85rem' }}
                    />
                    {photoEntries.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePhoto(entry.id)}
                        style={{ background: 'none', border: 'none', color: '#cc3300', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1, padding: '0 .25rem' }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Label (optional) — e.g. South wall framing, Footing pour A3"
                    value={entry.label}
                    onChange={e => setPhotoLabel(entry.id, e.target.value)}
                    style={{ ...inputStyle, fontSize: '.85rem', padding: '.45rem .75rem' }}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={addPhoto}
                style={{ padding: '.55rem', background: 'white', border: '1px dashed #ccc', borderRadius: '6px', fontSize: '.85rem', color: '#666', cursor: 'pointer' }}
              >
                + Add Another Photo
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{ width: '100%', padding: '1rem', background: '#cc3300', color: 'white', border: 'none', borderRadius: '6px', fontSize: '1.1rem', fontWeight: '700', cursor: submitting ? 'default' : 'pointer', marginTop: '.5rem', opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? 'Submitting...' : 'Submit Daily Report'}
          </button>
        </form>
      </div>
    </main>
  )
}

const fieldStyle = { marginBottom: '1.2rem' }
const labelStyle = { display: 'block', fontWeight: '600', marginBottom: '.4rem', color: '#333' }
const inputStyle = { width: '100%', padding: '.75rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '1rem', boxSizing: 'border-box' }
