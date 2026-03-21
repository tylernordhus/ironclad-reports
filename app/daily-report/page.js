'use client'

export const dynamic = 'force-dynamic'

import { Suspense, useState, useEffect } from 'react'
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
    crew_count: '',
    work_completed: '',
    equipment_used: '',
    safety_issues: '',
    weather: '',
    submitted_by: '',
  })
  const [copyState, setCopyState] = useState('idle') // idle | loading | copied | none

  useEffect(() => {
    if (!project_id) router.replace('/select-project?for=daily-report')
  }, [project_id, router])

  function set(field) {
    return (e) => setFields(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleCopy() {
    setCopyState('loading')
    try {
      const res = await fetch(`/api/reports/latest/${project_id}`)
      const { report } = await res.json()
      if (!report) {
        setCopyState('none')
        return
      }
      setFields(f => ({
        ...f,
        project_name: report.project_name || f.project_name,
        crew_count: report.crew_count ?? f.crew_count,
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
              {copyState === 'copied' && 'Fields pre-filled — review and edit before submitting.'}
              {copyState === 'none' && 'No previous report found for this project.'}
              {(copyState === 'idle' || copyState === 'loading') && 'Pre-fill form from the last report on this project.'}
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
              border: 'none',
              borderRadius: '6px',
              fontSize: '.85rem',
              fontWeight: '600',
              cursor: copyState === 'loading' || copyState === 'copied' ? 'default' : 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {copyState === 'loading' ? 'Loading...' : copyState === 'copied' ? 'Copied' : 'Copy Previous'}
          </button>
        </div>

        <form action="/api/submit" method="POST" encType="multipart/form-data">
          <input type="hidden" name="project_id" value={project_id} />

          <div style={fieldStyle}>
            <label style={labelStyle}>Project Name</label>
            <input name="project_name" required style={inputStyle} value={fields.project_name} onChange={set('project_name')} placeholder="e.g. Wichita Substation" />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Report Date</label>
            <input name="report_date" type="date" required style={inputStyle} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Crew Count on Site</label>
            <input name="crew_count" type="number" required style={inputStyle} value={fields.crew_count} onChange={set('crew_count')} placeholder="e.g. 8" />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Work Completed Today</label>
            <textarea name="work_completed" required rows={4} style={{ ...inputStyle, resize: 'vertical' }} value={fields.work_completed} onChange={set('work_completed')} placeholder="Describe what was accomplished today..." />
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
            <label style={labelStyle}>Weather Conditions</label>
            <input name="weather" required style={inputStyle} value={fields.weather} onChange={set('weather')} placeholder="e.g. Clear, 58°F" />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Submitted By</label>
            <input name="submitted_by" required style={inputStyle} value={fields.submitted_by} onChange={set('submitted_by')} placeholder="Your name" />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>
              Photos <span style={{ fontWeight: '400', color: '#888', fontSize: '.9rem' }}>(optional)</span>
            </label>
            <input name="photos" type="file" accept="image/*" multiple style={{ ...inputStyle, padding: '.5rem', cursor: 'pointer' }} />
            <p style={{ margin: '.3rem 0 0', fontSize: '.8rem', color: '#888' }}>Select one or more photos to attach to this report.</p>
          </div>

          <button type="submit" style={{ width: '100%', padding: '1rem', background: '#cc3300', color: 'white', border: 'none', borderRadius: '6px', fontSize: '1.1rem', fontWeight: '700', cursor: 'pointer', marginTop: '.5rem' }}>
            Submit Daily Report
          </button>
        </form>
      </div>
    </main>
  )
}

const fieldStyle = { marginBottom: '1.2rem' }
const labelStyle = { display: 'block', fontWeight: '600', marginBottom: '.4rem', color: '#333' }
const inputStyle = { width: '100%', padding: '.75rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '1rem', boxSizing: 'border-box' }
