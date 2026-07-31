'use client'

export const dynamic = 'force-dynamic'

import { Suspense, useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  FormBackLink,
  FormHero,
  FormPage,
  formFieldStyle as fieldStyle,
  formInputStyle as inputStyle,
  formLabelStyle as labelStyle,
  formSectionStyle,
  formSubmitButtonStyle,
  formTextAreaStyle,
} from '@/app/components/FormUi'

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
  const quickMode = searchParams.get('mode') === 'quick'

  const today = new Date().toISOString().split('T')[0]
  const [fields, setFields] = useState({
    project_name: project_name_param,
    report_date: today,
    crew_count: '',
    work_completed: '',
    equipment_used: '',
    safety_issues: quickMode ? 'None reported.' : '',
    weather: '',
    submitted_by: '',
    weather_delay: false,
    weather_delay_hours: '',
    on_schedule: true,
  })
  const [copyState, setCopyState] = useState('idle') // idle | loading | copied | none
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [weatherSource, setWeatherSource] = useState('')
  const [prefillLoading, setPrefillLoading] = useState(false)
  const [prefillNote, setPrefillNote] = useState('')
  const [polishState, setPolishState] = useState('idle') // idle | loading | done
  const [equipmentList, setEquipmentList] = useState([])
  const [newEquipment, setNewEquipment] = useState('')
  const [addingEquipment, setAddingEquipment] = useState(false)
  const [photoEntries, setPhotoEntries] = useState([{ id: 1, label: '' }])
  const [submitting, setSubmitting] = useState(false)
  const [showOptionalFields, setShowOptionalFields] = useState(!quickMode)
  const fileRefs = useRef({})
  const nextPhotoId = useRef(2)

  useEffect(() => {
    if (!project_id) router.replace('/select-project?for=daily-report')
  }, [project_id, router])

  async function fetchSmartPrefill() {
    if (!project_id || !fields.report_date) return

    setPrefillLoading(true)
    setWeatherLoading(true)
    setPrefillNote('')

    try {
      const reportQuery = new URLSearchParams({ before: fields.report_date }).toString()
      const previousReportPromise = fetch(`/api/reports/latest/${project_id}?${reportQuery}`)
        .then(r => r.json())
        .catch(() => ({ report: null }))

      const weatherPromise = new Promise((resolve) => {
        const fetchProjectWeather = () => {
          fetch(`/api/weather/${project_id}?date=${fields.report_date}`)
            .then(r => r.json())
            .then(data => resolve(data))
            .catch(() => resolve({ weather: null, source: null }))
        }

        if (typeof navigator === 'undefined' || !navigator.geolocation) {
          fetchProjectWeather()
          return
        }

        navigator.geolocation.getCurrentPosition(
          position => {
            const params = new URLSearchParams({
              date: fields.report_date,
              lat: String(position.coords.latitude),
              lon: String(position.coords.longitude),
            }).toString()

            fetch(`/api/weather/${project_id}?${params}`)
              .then(r => r.json())
              .then(data => resolve(data))
              .catch(() => fetchProjectWeather())
          },
          () => fetchProjectWeather(),
          {
            enableHighAccuracy: false,
            timeout: 5000,
            maximumAge: 10 * 60 * 1000,
          }
        )
      })

      const [{ report }, weatherData] = await Promise.all([previousReportPromise, weatherPromise])

      setFields(f => ({
        ...f,
        crew_count: f.crew_count || String(report?.crew_count ?? ''),
        equipment_used: f.equipment_used || report?.equipment_used || '',
        submitted_by: f.submitted_by || report?.submitted_by || '',
        weather: f.weather || weatherData?.weather || '',
      }))

      setWeatherSource(
        weatherData?.source === 'device'
          ? 'GPS weather'
          : weatherData?.source === 'project'
            ? 'Project weather'
            : ''
      )

      if (report?.report_date || weatherData?.weather) {
        const parts = []
        if (report?.report_date) parts.push(`Crew and submitter pulled from ${report.report_date}`)
        if (weatherData?.weather) parts.push(`Weather loaded from ${weatherData?.source === 'device' ? 'your location' : 'the project location'}`)
        setPrefillNote(parts.join(' · '))
      } else {
        setPrefillNote('No prior report or weather prefill was available for this date.')
      }
    } finally {
      setPrefillLoading(false)
      setWeatherLoading(false)
    }
  }

  useEffect(() => {
    if (!project_id || !fields.report_date) return
    fetchSmartPrefill()
  }, [project_id, fields.report_date])

  // Load project equipment list
  useEffect(() => {
    if (!project_id) return
    fetch(`/api/projects/${project_id}/equipment`)
      .then(r => r.json())
      .then(({ equipment_list }) => setEquipmentList(equipment_list || []))
      .catch(() => {})
  }, [project_id])

  async function handleAddEquipment() {
    if (!newEquipment.trim()) return
    setAddingEquipment(true)
    try {
      const res = await fetch(`/api/projects/${project_id}/equipment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: newEquipment.trim() }),
      })
      const { equipment_list } = await res.json()
      setEquipmentList(equipment_list || [])
      setNewEquipment('')
    } catch {}
    setAddingEquipment(false)
  }

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
      const data = await res.json()
      if (data.polished) {
        setFields(f => ({ ...f, work_completed: data.polished }))
        setPolishState('done')
        setTimeout(() => setPolishState('idle'), 3000)
      } else {
        alert('AI Polish failed. Make sure ANTHROPIC_API_KEY is set in Vercel and redeploy.')
        setPolishState('idle')
      }
    } catch {
      alert('AI Polish failed. Check your network connection.')
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

  function toggleEquipment(item) {
    setFields(f => {
      const current = f.equipment_used ? f.equipment_used.split(', ').filter(Boolean) : []
      const next = current.includes(item)
        ? current.filter(e => e !== item)
        : [...current, item]
      return { ...f, equipment_used: next.join(', ') }
    })
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
    fd.append('weather_delay', fields.weather_delay ? 'true' : 'false')
    fd.append('weather_delay_hours', fields.weather_delay ? fields.weather_delay_hours : '')
    fd.append('on_schedule', fields.on_schedule ? 'true' : 'false')

    for (const entry of photoEntries) {
      const fileInput = fileRefs.current[entry.id]
      if (fileInput?.files?.[0]) {
        fd.append('photos', fileInput.files[0])
        fd.append('photo_labels', entry.label || '')
      }
    }

    try {
      const res = await fetch('/api/submit', { method: 'POST', body: fd })
      if (!res.ok) throw new Error()
      const data = await res.json()
      router.push(`/reports/${data.id}`)
    } catch {
      alert('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <FormPage maxWidth="760px">
      <FormBackLink href={project_id ? `/projects/${project_id}` : '/'}>
        Back
      </FormBackLink>

      <FormHero
        eyebrow={quickMode ? 'Quick Submit' : 'Daily Report'}
        title={quickMode ? 'Quick Daily Report' : 'Daily Report'}
        subtitle={project_name_param || (quickMode
          ? 'Fast field entry with the required details up front.'
          : 'Capture daily work completed, conditions, schedule, and photos.')}
        accent="#cc3300"
      />

        <div style={{ ...formSectionStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: '700', fontSize: '.95rem', color: '#1a1a1a' }}>
              {quickMode ? 'Quick Submit Mode' : 'Standard Mode'}
            </div>
            <div style={{ fontSize: '.82rem', color: '#888', marginTop: '.1rem' }}>
              {quickMode
                ? 'Large tap targets with optional fields tucked away until needed.'
                : 'Full daily report layout with every field visible.'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const params = new URLSearchParams({
                project_id,
                project_name: fields.project_name || project_name_param,
              })
              if (!quickMode) params.set('mode', 'quick')
              router.push(`/daily-report?${params.toString()}`)
            }}
            style={{
              padding: '.6rem 1rem',
              background: quickMode ? '#f3f3f3' : '#1a1a1a',
              color: quickMode ? '#1a1a1a' : 'white',
              border: quickMode ? '1px solid #ddd' : 'none',
              borderRadius: '8px',
              fontWeight: '700',
              fontSize: '.85rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {quickMode ? 'Open Full Form' : 'Open Quick Submit'}
          </button>
        </div>

        <div style={{ ...formSectionStyle, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: '600', fontSize: '.9rem', color: '#1a1a1a' }}>Smart Prefill</div>
            <div style={{ fontSize: '.8rem', color: '#888', marginTop: '.1rem' }}>
              {prefillLoading ? 'Loading yesterday crew and current weather…' : prefillNote || 'This report will try to prefill crew size, submitter, and weather for the selected date.'}
            </div>
            {weatherSource ? (
              <div style={{ fontSize: '.75rem', color: '#999', marginTop: '.35rem' }}>
                Weather source: {weatherSource}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={fetchSmartPrefill}
            disabled={prefillLoading || !project_id || !fields.report_date}
            style={{
              padding: '.55rem 1.1rem',
              background: '#f3f3f3',
              color: '#1a1a1a',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '.85rem',
              fontWeight: '600',
              cursor: prefillLoading ? 'default' : 'pointer',
              whiteSpace: 'nowrap',
              opacity: prefillLoading ? 0.7 : 1,
            }}
          >
            {prefillLoading ? 'Refreshing…' : 'Refresh Prefill'}
          </button>
        </div>

        {/* Copy Previous Report */}
        <div style={{ ...formSectionStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: '600', fontSize: '.9rem', color: '#1a1a1a' }}>Copy Previous Report</div>
            <div style={{ fontSize: '.8rem', color: '#888', marginTop: '.1rem' }}>
              {copyState === 'copied' && 'All fields pre-filled — review and edit before submitting.'}
              {copyState === 'none' && 'No previous report found for this project.'}
              {(copyState === 'idle' || copyState === 'loading') && 'Pre-fill all fields from your last report on this project.'}
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
          {quickMode ? (
            <input name="project_name" type="hidden" value={fields.project_name} />
          ) : (
            <div style={fieldStyle}>
              <label style={labelStyle}>Project Name</label>
              <input name="project_name" required style={inputStyle} value={fields.project_name} onChange={set('project_name')} placeholder="e.g. Wichita Substation" />
            </div>
          )}
          <div style={fieldStyle}>
            <label style={labelStyle}>Report Date</label>
            <input name="report_date" type="date" required style={{ ...inputStyle, padding: quickMode ? '1rem .95rem' : inputStyle.padding, fontSize: quickMode ? '1rem' : inputStyle.fontSize }} value={fields.report_date} onChange={set('report_date')} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Crew Count on Site</label>
            <input name="crew_count" type="number" required style={{ ...inputStyle, padding: quickMode ? '1rem .95rem' : inputStyle.padding, fontSize: quickMode ? '1rem' : inputStyle.fontSize }} value={fields.crew_count} onChange={set('crew_count')} placeholder="e.g. 8" />
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
              style={{ ...formTextAreaStyle, minHeight: quickMode ? '180px' : '150px', padding: quickMode ? '1rem' : formTextAreaStyle.padding, fontSize: quickMode ? '1rem' : formTextAreaStyle.fontSize }}
              value={fields.work_completed}
              onChange={set('work_completed')}
              onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
              placeholder={quickMode
                ? 'What got done today?'
                : 'Describe what was accomplished today — e.g. Poured footings on grid lines A1-A4, set rebar cages for columns B2-B6, graded pad area for building 3...'}
            />
          </div>

          {showOptionalFields ? (
          <div style={fieldStyle}>
            <label style={labelStyle}>Equipment Used</label>

            {equipmentList.length === 0 && (
              <p style={{ fontSize: '.85rem', color: '#888', marginBottom: '.6rem', marginTop: 0 }}>
                No equipment added yet — add items below to build this project's equipment list.
              </p>
            )}

            {equipmentList.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem', marginBottom: '.75rem' }}>
                {equipmentList.map(item => {
                  const selected = fields.equipment_used.split(', ').filter(Boolean).includes(item)
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleEquipment(item)}
                      style={{
                        padding: '.35rem .85rem',
                        borderRadius: '20px',
                        border: selected ? 'none' : '1px solid #ddd',
                        background: selected ? '#cc3300' : 'white',
                        color: selected ? 'white' : '#333',
                        fontSize: '.85rem',
                        fontWeight: selected ? '600' : '400',
                        cursor: 'pointer',
                      }}
                    >
                      {item}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Add new equipment to project */}
            <div style={{ display: 'flex', gap: '.5rem', marginBottom: '.5rem' }}>
              <input
                type="text"
                value={newEquipment}
                onChange={e => setNewEquipment(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddEquipment())}
                placeholder="Add equipment to this project..."
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                type="button"
                onClick={handleAddEquipment}
                disabled={addingEquipment || !newEquipment.trim()}
                style={{ padding: '.75rem 1rem', background: '#1a1a1a', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', fontSize: '.85rem', cursor: 'pointer', whiteSpace: 'nowrap', opacity: !newEquipment.trim() ? 0.5 : 1 }}
              >
                {addingEquipment ? '...' : '+ Add'}
              </button>
            </div>

            <input
              name="equipment_used"
              style={{ ...inputStyle, color: '#555', fontSize: '.9rem' }}
              value={fields.equipment_used}
              onChange={set('equipment_used')}
              placeholder="Selected equipment appears here..."
            />
          </div>
          ) : null}
          <div style={fieldStyle}>
            <label style={labelStyle}>Safety / Issues</label>
            <input name="safety_issues" required style={{ ...inputStyle, padding: quickMode ? '1rem .95rem' : inputStyle.padding, fontSize: quickMode ? '1rem' : inputStyle.fontSize }} value={fields.safety_issues} onChange={set('safety_issues')} placeholder="e.g. None, or describe any incidents" />
          </div>
          <div style={fieldStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.4rem' }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Weather Conditions</label>
              {weatherLoading && <span style={{ fontSize: '.75rem', color: '#aaa' }}>Fetching weather...</span>}
            </div>
            <input name="weather" required style={{ ...inputStyle, padding: quickMode ? '1rem .95rem' : inputStyle.padding, fontSize: quickMode ? '1rem' : inputStyle.fontSize }} value={fields.weather} onChange={set('weather')} placeholder="e.g. Clear, 58°F" />
          </div>
          {/* Weather Delay */}
          <div style={fieldStyle}>
            <label style={labelStyle}>Weather Delay</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', cursor: 'pointer', fontWeight: '400', color: '#333' }}>
                <input
                  type="checkbox"
                  checked={fields.weather_delay}
                  onChange={e => setFields(f => ({ ...f, weather_delay: e.target.checked, weather_delay_hours: e.target.checked ? f.weather_delay_hours : '' }))}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                Work delayed due to weather
              </label>
              {fields.weather_delay && (
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={fields.weather_delay_hours}
                  onChange={e => setFields(f => ({ ...f, weather_delay_hours: e.target.value }))}
                  placeholder="Hours lost"
                  style={{ ...inputStyle, width: '130px' }}
                />
              )}
            </div>
          </div>

          {/* On Schedule */}
          <div style={fieldStyle}>
            <label style={labelStyle}>Project Schedule</label>
            <div style={{ display: 'flex', gap: '.75rem' }}>
              {[{ label: 'On Schedule', value: true }, { label: 'Behind Schedule', value: false }].map(opt => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => setFields(f => ({ ...f, on_schedule: opt.value }))}
                  style={{
                    flex: 1,
                    padding: quickMode ? '.95rem' : '.65rem',
                    borderRadius: '8px',
                    border: fields.on_schedule === opt.value ? 'none' : '1px solid #ddd',
                    background: fields.on_schedule === opt.value ? (opt.value ? '#2a7a2a' : '#cc3300') : 'white',
                    color: fields.on_schedule === opt.value ? 'white' : '#555',
                    fontWeight: '600',
                    fontSize: quickMode ? '1rem' : '.9rem',
                    cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Submitted By</label>
            <input name="submitted_by" required style={{ ...inputStyle, padding: quickMode ? '1rem .95rem' : inputStyle.padding, fontSize: quickMode ? '1rem' : inputStyle.fontSize }} value={fields.submitted_by} onChange={set('submitted_by')} placeholder="Your name" />
          </div>

          {quickMode ? (
            <div style={{ ...formSectionStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: '700', fontSize: '.9rem', color: '#1a1a1a' }}>Optional Details</div>
                <div style={{ fontSize: '.8rem', color: '#888', marginTop: '.1rem' }}>
                  Equipment and photos stay hidden until you need them.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowOptionalFields(value => !value)}
                style={{
                  padding: '.6rem 1rem',
                  background: showOptionalFields ? '#1a1a1a' : '#f3f3f3',
                  color: showOptionalFields ? 'white' : '#1a1a1a',
                  border: showOptionalFields ? 'none' : '1px solid #ddd',
                  borderRadius: '8px',
                  fontWeight: '700',
                  fontSize: '.85rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {showOptionalFields ? 'Hide Optional Fields' : 'Show Optional Fields'}
              </button>
            </div>
          ) : null}

          {/* Photos with labels */}
          {showOptionalFields ? (
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
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            style={{
              ...formSubmitButtonStyle,
              opacity: submitting ? 0.7 : 1,
              padding: quickMode ? '1.05rem 1.2rem' : formSubmitButtonStyle.padding,
              fontSize: quickMode ? '1.05rem' : formSubmitButtonStyle.fontSize,
              borderRadius: quickMode ? '10px' : formSubmitButtonStyle.borderRadius,
            }}
          >
            {submitting ? 'Submitting...' : quickMode ? 'Quick Submit Daily Report' : 'Submit Daily Report'}
          </button>
        </form>
    </FormPage>
  )
}
