'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  FormBackLink,
  FormHero,
  FormPage,
  formCardStyle as cardStyle,
  formDashedAddButtonStyle as addBtnStyle,
  formFieldStyle as fieldStyle,
  formInlineNowButtonStyle as nowInlineBtnStyle,
  formInputStyle as inputStyle,
  formLabelStyle as labelStyle,
  formRemoveButtonStyle as removeBtnStyle,
  formSectionStyle as sectionStyle,
  formSectionHeaderStyle as sectionHeaderStyle,
  formTimeControlStyle as timeControlStyle,
  formTimeFieldStyle as timeFieldStyle,
  formTimeGridStyle as timeGridStyle,
  formTimeInputStyle as timeInputStyle,
  formTimePanelHeaderStyle as timePanelHeaderStyle,
  formTimePanelStyle as timePanelStyle,
} from '@/app/components/FormUi'

export default function PourLogFlatwork() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const project_name = searchParams.get('project_name') || ''
  const project_id = searchParams.get('project_id') || ''
  const [projectName, setProjectName] = useState(project_name)

  useEffect(() => {
    if (!project_id) router.replace('/select-project?for=pour-log-flatwork')
  }, [project_id, router])

  const [logDate, setLogDate] = useState('')
  const [weather, setWeather] = useState('')
  const [ambientTemp, setAmbientTemp] = useState('')
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [concreteSupplier, setConcreteSupplier] = useState('')
  const [submittedBy, setSubmittedBy] = useState('')

  const [sections, setSections] = useState([
    { section_type: 'Slab', foundation_id: '', square_footage: '', total_depth: '', estimated_yards: '', notes: '' }
  ])

  const [trucks, setTrucks] = useState([
    {
      truck_number: '',
      batch_time: '',
      arrival_time: '',
      pour_start: '',
      pour_complete: '',
      yards: '',
      concrete_temp: '',
      slump: '',
      air_content: '',
      water_added: '',
      cylinders_cast: '',
      notes: ''
    }
  ])

  const [submitting, setSubmitting] = useState(false)
  const [photoFiles, setPhotoFiles] = useState([])
  const [draftReady, setDraftReady] = useState(false)
  const [draftStatus, setDraftStatus] = useState('Saved')
  const [activeTruckIndex, setActiveTruckIndex] = useState(null)
  const draftKey = `pour-log-new-draft:${project_id || 'no-project'}:flatwork`
  const skipNextDraftSave = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !project_id) {
      setDraftReady(true)
      return
    }

    const rawDraft = window.localStorage.getItem(draftKey)
    if (!rawDraft) {
      setDraftReady(true)
      return
    }

    try {
      const draft = JSON.parse(rawDraft)
      if (draft.project_id && draft.project_id !== project_id) {
        setDraftReady(true)
        return
      }

      if (draft.project_name) setProjectName(draft.project_name)
      if (draft.log_date) setLogDate(draft.log_date)
      if (draft.weather) setWeather(draft.weather)
      if (draft.ambient_temp) setAmbientTemp(draft.ambient_temp)
      if (draft.concrete_supplier) setConcreteSupplier(draft.concrete_supplier)
      if (draft.submitted_by) setSubmittedBy(draft.submitted_by)
      if (Array.isArray(draft.sections) && draft.sections.length) setSections(draft.sections)
      if (Array.isArray(draft.trucks) && draft.trucks.length) setTrucks(draft.trucks)
      if (draft.activeTruckIndex == null) {
        setActiveTruckIndex(null)
      } else if (Number.isFinite(Number(draft.activeTruckIndex))) {
        setActiveTruckIndex(Number(draft.activeTruckIndex))
      }
      setDraftStatus('Draft saved')
      skipNextDraftSave.current = true
    } catch {
      window.localStorage.removeItem(draftKey)
    } finally {
      setDraftReady(true)
    }
  }, [draftKey, project_id])

  const saveDraftNow = useCallback(() => {
    if (typeof window === 'undefined' || !draftReady || !project_id || submitting) return false

    try {
      window.localStorage.setItem(draftKey, JSON.stringify({
        project_id,
        project_name: projectName,
        log_date: logDate,
        weather,
        ambient_temp: ambientTemp,
        concrete_supplier: concreteSupplier,
        submitted_by: submittedBy,
        sections,
        trucks,
        activeTruckIndex,
        savedAt: Date.now(),
      }))
      setDraftStatus('Draft saved')
      return true
    } catch {
      setDraftStatus('Unsaved changes')
      return false
    }
  }, [activeTruckIndex, ambientTemp, concreteSupplier, draftKey, draftReady, logDate, projectName, project_id, sections, submittedBy, submitting, trucks, weather])

  useEffect(() => {
    if (typeof window === 'undefined' || !draftReady || !project_id || submitting) return
    if (skipNextDraftSave.current) {
      skipNextDraftSave.current = false
      return
    }

    setDraftStatus('Unsaved changes')
    const timeoutId = window.setTimeout(() => {
      setDraftStatus('Saving')
      saveDraftNow()
    }, 350)

    return () => window.clearTimeout(timeoutId)
  }, [activeTruckIndex, ambientTemp, concreteSupplier, draftKey, draftReady, logDate, projectName, project_id, saveDraftNow, sections, submittedBy, submitting, trucks, weather])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const saveBeforeLeaving = () => {
      saveDraftNow()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') saveDraftNow()
    }

    window.addEventListener('pagehide', saveBeforeLeaving)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('pagehide', saveBeforeLeaving)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [saveDraftNow])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleBeforeUnload = (event) => {
      if (draftStatus !== 'Unsaved changes' && draftStatus !== 'Saving') return
      saveDraftNow()
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [draftStatus, saveDraftNow])

  useEffect(() => {
    setActiveTruckIndex(current => {
      if (current == null || trucks.length === 0) return null
      return Math.max(0, Math.min(current, trucks.length - 1))
    })
  }, [trucks.length])

  // Auto-fill weather when date is selected
  useEffect(() => {
    if (!project_id || !logDate) return
    setWeatherLoading(true)
    fetch(`/api/weather/${project_id}?date=${logDate}`)
      .then(r => r.json())
      .then(({ weather: w }) => {
        if (w) setWeather(prev => prev || w)
        setWeatherLoading(false)
      })
      .catch(() => setWeatherLoading(false))
  }, [project_id, logDate])

  const addSection = () => {
    setSections([...sections, { section_type: 'Slab', foundation_id: '', square_footage: '', total_depth: '', estimated_yards: '', notes: '' }])
  }

  const updateSection = (index, field, value) => {
    const updated = [...sections]
    updated[index][field] = value
    setSections(updated)
  }

  const removeSection = (index) => {
    setSections(sections.filter((_, i) => i !== index))
  }

  const addTruck = () => {
    setTrucks([...trucks, {
      truck_number: '',
      batch_time: '',
      arrival_time: '',
      pour_start: '',
      pour_complete: '',
      yards: '',
      concrete_temp: '',
      slump: '',
      air_content: '',
      water_added: '',
      cylinders_cast: '',
      notes: ''
    }])
    setActiveTruckIndex(trucks.length)
  }

  const duplicateActiveTruck = () => {
    const source = trucks[activeTruckIndex] || trucks[trucks.length - 1]
    setTrucks([...trucks, {
      truck_number: '',
      batch_time: '',
      arrival_time: '',
      pour_start: '',
      pour_complete: '',
      yards: '',
      concrete_temp: source?.concrete_temp || '',
      slump: source?.slump || '',
      air_content: source?.air_content || '',
      water_added: source?.water_added || '',
      cylinders_cast: source?.cylinders_cast || '',
      notes: ''
    }])
    setActiveTruckIndex(trucks.length)
  }

  const updateTruck = (index, field, value) => {
    const updated = [...trucks]
    updated[index][field] = value
    setTrucks(updated)
  }

  const setNow = (truckIndex, field) => {
    const now = new Date()
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    updateTruck(truckIndex, field, `${hh}:${mm}`)
  }

  const removeTruck = (index) => {
    setTrucks(trucks.filter((_, i) => i !== index))
    setActiveTruckIndex(current => {
      if (current == null || current === index) return null
      return current > index ? current - 1 : current
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)

    const formData = new FormData(e.target)

    let photo_urls = []
    if (photoFiles.length > 0) {
      const fd = new FormData()
      fd.append('folder', 'pour-logs')
      fd.append('project_id', project_id)
      photoFiles.forEach(f => fd.append('files', f))
      const uploadRes = await fetch('/api/upload-photos', { method: 'POST', body: fd })
      if (uploadRes.ok) {
        const uploadData = await uploadRes.json()
        photo_urls = uploadData.urls
      }
    }

    const payload = {
      project_id,
      project_name: projectName,
      log_date: logDate,
      log_type: 'flatwork',
      weather,
      ambient_temp: ambientTemp,
      concrete_supplier: concreteSupplier,
      submitted_by: submittedBy,
      photo_urls,
      sections,
      trucks
    }

    const res = await fetch('/api/pour-log/create-flatwork', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (res.ok) {
      const data = await res.json()
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(draftKey)
      }
      setDraftStatus('Saved')
      router.push('/pour-logs/' + data.id)
    } else {
      alert('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <FormPage maxWidth="900px">
      <FormBackLink href={project_id ? '/pour-log-select?project_id=' + project_id + '&project_name=' + encodeURIComponent(project_name) : '/'}>
        Back
      </FormBackLink>

      <FormHero
        eyebrow="Pour Log"
        title="Flatwork Pour Log"
        subtitle={projectName || 'Track slabs, sections, truck times, and concrete test data.'}
        accent="#cc3300"
      />

      <div style={draftStatusStyle}>
        {draftStatus}
      </div>

      <form onSubmit={handleSubmit}>

        {/* JOB INFO */}
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>Job Info</div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Project Name</label>
            <input
              name="project_name"
              required
              style={inputStyle}
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
            />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Date</label>
            <input
              type="date"
              required
              style={inputStyle}
              value={logDate}
              onChange={e => setLogDate(e.target.value)}
            />
          </div>
          <div style={rowStyle}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>
                Weather {weatherLoading && <span style={{ fontWeight: '400', color: '#888' }}>— fetching…</span>}
              </label>
              <input
                style={inputStyle}
                placeholder="Auto-filled from date"
                value={weather}
                onChange={e => setWeather(e.target.value)}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Ambient Temp</label>
              <input
                style={inputStyle}
                placeholder="e.g. 75°F"
                value={ambientTemp}
                onChange={e => setAmbientTemp(e.target.value)}
              />
            </div>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Concrete Supplier</label>
            <input
              style={inputStyle}
              placeholder="e.g. Central Concrete"
              value={concreteSupplier}
              onChange={e => setConcreteSupplier(e.target.value)}
            />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Submitted By</label>
            <input
              required
              style={inputStyle}
              placeholder="Your name"
              value={submittedBy}
              onChange={e => setSubmittedBy(e.target.value)}
            />
          </div>
        </div>

        {/* FOUNDATION INFO */}
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>Foundation Info</div>

          {sections.map((s, i) => (
            <div key={i} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ fontWeight: '700', color: '#1a1a1a' }}>Section {i + 1}</div>
                {sections.length > 1 && (
                  <button type="button" onClick={() => removeSection(i)} style={removeBtnStyle}>
                    Remove
                  </button>
                )}
              </div>

              {/* Slab / Spread Footer toggle */}
              <div style={fieldStyle}>
                <label style={labelStyle}>Type</label>
                <div style={{ display: 'flex', gap: '.5rem' }}>
                  {['Slab', 'Spread Footer'].map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => updateSection(i, 'section_type', type)}
                      style={{
                        flex: 1,
                        padding: '.65rem',
                        borderRadius: '6px',
                        border: '2px solid',
                        borderColor: s.section_type === type ? '#cc3300' : '#ddd',
                        background: s.section_type === type ? '#cc3300' : 'white',
                        color: s.section_type === type ? 'white' : '#666',
                        fontWeight: '700',
                        fontSize: '.9rem',
                        cursor: 'pointer'
                      }}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Section / Area Name</label>
                <input
                  style={inputStyle}
                  placeholder="e.g. Building Pad A, Grid A–D"
                  value={s.foundation_id}
                  onChange={e => updateSection(i, 'foundation_id', e.target.value)}
                  required
                />
              </div>

              <div style={rowStyle}>
                {s.section_type === 'Slab' && (
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Square Footage</label>
                    <input
                      style={inputStyle}
                      placeholder="e.g. 2400"
                      value={s.square_footage}
                      onChange={e => updateSection(i, 'square_footage', e.target.value)}
                    />
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Thickness (in)</label>
                  <input
                    style={inputStyle}
                    placeholder='e.g. 6"'
                    value={s.total_depth}
                    onChange={e => updateSection(i, 'total_depth', e.target.value)}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Est. Yards</label>
                  <input
                    style={inputStyle}
                    placeholder="e.g. 45"
                    value={s.estimated_yards}
                    onChange={e => updateSection(i, 'estimated_yards', e.target.value)}
                  />
                </div>
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Notes</label>
                <textarea
                  style={{ ...inputStyle, resize: 'vertical' }}
                  rows={2}
                  placeholder="Any notes about this section"
                  value={s.notes}
                  onChange={e => updateSection(i, 'notes', e.target.value)}
                />
              </div>
            </div>
          ))}

          <button type="button" onClick={addSection} style={addBtnStyle}>
            + Add Section
          </button>
        </div>

        {/* CONCRETE TRUCKS */}
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>Concrete Trucks</div>

          <div style={truckSwitcherStyle}>
            {trucks.map((t, i) => {
              const active = activeTruckIndex === i
              return (
                <button
                  key={`truck-jump-${i}`}
                  type="button"
                  onClick={() => setActiveTruckIndex(current => current === i ? null : i)}
                  style={{
                    ...truckJumpButtonStyle,
                    borderColor: active ? '#cc3300' : '#d6dde3',
                    background: active ? '#fff4ef' : '#fff',
                  }}
                >
                  <span style={truckJumpTitleStyle}>Truck {i + 1}</span>
                  <span style={truckJumpMetaStyle}>
                    {t.truck_number ? `ID ${t.truck_number}` : 'No truck ID'}
                    {t.pour_complete ? ` · Done ${t.pour_complete}` : t.arrival_time ? ` · Arr ${t.arrival_time}` : ''}
                  </span>
                </button>
              )
            })}
          </div>

          {trucks.map((t, i) => {
            if (activeTruckIndex !== i) return null

            return (
            <div key={i} style={{ ...cardStyle, borderColor: '#cc3300', background: '#fffdfb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <div style={{ fontWeight: '800', color: '#1a1a1a', fontSize: '1.15rem' }}>Truck {i + 1}</div>
                  <div style={{ color: '#60717d', fontSize: '.84rem', marginTop: '.15rem' }}>
                    {t.truck_number ? `Truck ID / Unit # ${t.truck_number}` : 'Truck ID / Unit # not entered'}
                  </div>
                </div>
                {trucks.length > 1 && (
                  <button type="button" onClick={() => removeTruck(i)} style={removeBtnStyle}>
                    Remove
                  </button>
                )}
              </div>

              <div style={timePanelStyle}>
                <div style={timePanelHeaderStyle}>Truck Time Log</div>
                <div style={rowStyle}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Truck ID / Unit #</label>
                    <input
                      style={inputStyle}
                      placeholder="e.g. 8412"
                      value={t.truck_number}
                      onChange={e => updateTruck(i, 'truck_number', e.target.value)}
                    />
                  </div>
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Batch Time</label>
                  <div style={timeControlStyle}>
                    <input
                      type="time"
                      style={timeInputStyle}
                      value={t.batch_time}
                      onChange={e => updateTruck(i, 'batch_time', e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setNow(i, 'batch_time')}
                      style={nowInlineBtnStyle}
                    >
                      Now
                    </button>
                  </div>
                </div>

                <div style={timeGridStyle}>
                  {[
                    { label: 'Arrival Time', field: 'arrival_time' },
                    { label: 'Pour Start', field: 'pour_start' },
                    { label: 'Pour Complete', field: 'pour_complete' },
                  ].map(({ label, field }) => (
                    <div key={field} style={timeFieldStyle}>
                      <label style={labelStyle}>{label}</label>
                      <div style={timeControlStyle}>
                        <input
                          type="time"
                          style={timeInputStyle}
                          value={t[field]}
                          onChange={e => updateTruck(i, field, e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setNow(i, field)}
                          style={nowInlineBtnStyle}
                        >
                          Now
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={rowStyle}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Yards</label>
                  <input style={inputStyle} placeholder="e.g. 9.5" value={t.yards} onChange={e => updateTruck(i, 'yards', e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Concrete Temp</label>
                  <input style={inputStyle} placeholder="e.g. 75°F" value={t.concrete_temp} onChange={e => updateTruck(i, 'concrete_temp', e.target.value)} />
                </div>
              </div>

              <div style={rowStyle}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Slump</label>
                  <input style={inputStyle} placeholder='e.g. 4.5"' value={t.slump} onChange={e => updateTruck(i, 'slump', e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Air Content</label>
                  <input style={inputStyle} placeholder="e.g. 5.0%" value={t.air_content} onChange={e => updateTruck(i, 'air_content', e.target.value)} />
                </div>
              </div>

              <div style={rowStyle}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Water Added</label>
                  <input style={inputStyle} placeholder="None or amount" value={t.water_added} onChange={e => updateTruck(i, 'water_added', e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Cylinders Cast</label>
                  <input style={inputStyle} placeholder="e.g. 4" value={t.cylinders_cast} onChange={e => updateTruck(i, 'cylinders_cast', e.target.value)} />
                </div>
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Truck Notes</label>
                <input style={inputStyle} placeholder="Any issues with this truck" value={t.notes} onChange={e => updateTruck(i, 'notes', e.target.value)} />
              </div>
            </div>
            )
          })}

          <div style={truckActionsStyle}>
            <button type="button" onClick={addTruck} style={{ ...addBtnStyle, flex: '1 1 180px' }}>
              + Add Truck
            </button>
            <button type="button" onClick={duplicateActiveTruck} style={{ ...secondaryActionButtonStyle, flex: '1 1 180px' }}>
              Duplicate Test Fields
            </button>
          </div>
        </div>

        {/* PHOTOS */}
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>Photos</div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Attach Photos <span style={{ fontWeight: '400', color: '#888' }}>(optional)</span></label>
            <input
              type="file"
              accept="image/*"
              multiple
              style={{ ...inputStyle, padding: '.5rem', cursor: 'pointer' }}
              onChange={e => setPhotoFiles(Array.from(e.target.files))}
            />
            {photoFiles.length > 0 && (
              <p style={{ margin: '.4rem 0 0', fontSize: '.8rem', color: '#666' }}>
                {photoFiles.length} photo{photoFiles.length !== 1 ? 's' : ''} selected
              </p>
            )}
          </div>
        </div>

        <button type="submit" disabled={submitting} style={{
          width: '100%',
          padding: '1.1rem',
          background: submitting ? '#999' : '#cc3300',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '1.1rem',
          fontWeight: '700',
          cursor: submitting ? 'not-allowed' : 'pointer',
          marginTop: '.5rem',
          marginBottom: '3rem'
        }}>
          {submitting ? 'Saving...' : 'Save Pour Log'}
        </button>

      </form>
    </FormPage>
  )
}

const rowStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '1rem',
  marginBottom: '1rem',
  alignItems: 'start'
}

const draftStatusStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  border: '1px solid #dfe6eb',
  borderRadius: '999px',
  padding: '.38rem .75rem',
  margin: '-.25rem 0 1rem',
  color: '#40515d',
  background: '#fff',
  fontSize: '.82rem',
  fontWeight: '800',
}

const truckSwitcherStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: '.65rem',
  marginBottom: '1rem',
}

const truckJumpButtonStyle = {
  minHeight: '74px',
  padding: '.7rem .8rem',
  border: '2px solid #d6dde3',
  borderRadius: '12px',
  textAlign: 'left',
  cursor: 'pointer',
  boxShadow: '0 6px 14px rgba(22, 35, 45, 0.05)',
}

const truckJumpTitleStyle = {
  display: 'block',
  color: '#172a3a',
  fontWeight: '800',
  fontSize: '.95rem',
  marginBottom: '.2rem',
}

const truckJumpMetaStyle = {
  display: 'block',
  color: '#60717d',
  fontWeight: '700',
  fontSize: '.78rem',
  lineHeight: 1.35,
}

const truckActionsStyle = {
  display: 'flex',
  gap: '.75rem',
  flexWrap: 'wrap',
}

const secondaryActionButtonStyle = {
  border: '1px solid #d6dde3',
  borderRadius: '12px',
  background: '#fff',
  color: '#2a3a45',
  padding: '.85rem 1rem',
  fontWeight: '800',
  cursor: 'pointer',
}
