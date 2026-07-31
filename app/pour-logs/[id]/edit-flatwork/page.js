'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  FormBackLink,
  FormHero,
  FormPage,
  formCardStyle as cardStyle,
  formDashedAddButtonStyle as addBtnStyle,
  formFieldStyle as fieldStyle,
  formInputStyle as inputStyle,
  formLabelStyle as labelStyle,
  formRemoveButtonStyle as removeBtnStyle,
  formSectionStyle as sectionStyle,
  formSectionHeaderStyle as sectionHeaderStyle,
  formTimeFieldStyle as timeFieldStyle,
  formTimeGridStyle as timeGridStyle,
  formTimePanelHeaderStyle as timePanelHeaderStyle,
  formTimePanelStyle as timePanelStyle,
  formSubmitButtonStyle,
} from '@/app/components/FormUi'

export default function EditFlatworkPourLog() {
  const { id } = useParams()
  const router = useRouter()

  const [log, setLog] = useState(null)
  const [form, setForm] = useState(null)
  const [trucks, setTrucks] = useState([])
  const [jobInfoOpen, setJobInfoOpen] = useState(false)
  const [pourInfoOpen, setPourInfoOpen] = useState(false)
  const [activeTruckIndex, setActiveTruckIndex] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [draftStatus, setDraftStatus] = useState('Saved')
  const [serverSaveStatus, setServerSaveStatus] = useState('Saved to database')
  const [draftRestored, setDraftRestored] = useState(false)
  const draftKey = `pour-log-edit-draft:${id}:flatwork`
  const skipNextDraftSave = useRef(false)
  const latestAutosaveId = useRef(0)

  useEffect(() => {
    fetch(`/api/pour-log/get/${id}`)
      .then(r => r.json())
      .then(data => {
        const serverForm = {
          project_name: data.log?.project_name || '',
          log_date: data.log?.log_date || '',
          weather: data.log?.weather || '',
          ambient_temp: data.log?.ambient_temp || '',
          concrete_supplier: data.log?.concrete_supplier || '',
          submitted_by: data.log?.submitted_by || '',
          area_location: data.log?.area_location || '',
          square_footage: data.log?.square_footage || '',
          thickness: data.log?.thickness || '',
          total_yards: data.log?.total_yards || '',
          finish_type: data.log?.finish_type || '',
          general_notes: data.log?.general_notes || '',
        }
        let nextForm = serverForm
        let nextTrucks = data.trucks || []
        let restoredDraft = false

        if (typeof window !== 'undefined') {
          const rawDraft = window.localStorage.getItem(draftKey)
          if (rawDraft) {
            try {
              const draft = JSON.parse(rawDraft)
              const draftSavedAt = Number(draft.savedAt || 0)
              const serverUpdatedAt = Date.parse(data.log?.updated_at || '')
              const draftIsOlderThanServer =
                Number.isFinite(serverUpdatedAt) &&
                serverUpdatedAt > 0 &&
                draftSavedAt > 0 &&
                draftSavedAt < serverUpdatedAt

              if (draftIsOlderThanServer && !window.confirm('A newer saved pour log exists. Restore the older local draft anyway?')) {
                window.localStorage.removeItem(draftKey)
              } else {
                if (draft.form && typeof draft.form === 'object') {
                  nextForm = { ...serverForm, ...draft.form }
                }
                if (Array.isArray(draft.trucks) && draft.trucks.length) {
                  nextTrucks = draft.trucks
                }
                if (draft.activeTruckIndex == null) {
                  setActiveTruckIndex(null)
                } else if (Number.isFinite(Number(draft.activeTruckIndex))) {
                  setActiveTruckIndex(Number(draft.activeTruckIndex))
                }
                restoredDraft = true
                setDraftStatus('Draft saved')
                skipNextDraftSave.current = true
              }
            } catch {
              window.localStorage.removeItem(draftKey)
            }
          }
        }

        setLog(data.log)
        setForm(nextForm)
        setTrucks(nextTrucks)
        setDraftRestored(restoredDraft)
        setLoading(false)
      })
  }, [draftKey, id])

  const saveDraftNow = useCallback(() => {
    if (loading || !form || typeof window === 'undefined' || submitting) return false

    try {
      window.localStorage.setItem(draftKey, JSON.stringify({
        form,
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
  }, [activeTruckIndex, draftKey, form, loading, submitting, trucks])

  const buildPourLogPayload = useCallback(() => ({
    ...form,
    trucks,
  }), [form, trucks])

  useEffect(() => {
    if (loading || !form || typeof window === 'undefined' || submitting) return
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
  }, [activeTruckIndex, draftKey, form, loading, saveDraftNow, submitting, trucks])

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
    if (typeof window === 'undefined') return

    let cancelled = false
    const ping = async () => {
      try {
        await fetch('/api/auth/keepalive', { cache: 'no-store' })
      } catch {}
    }

    ping()
    const intervalId = window.setInterval(() => {
      if (!cancelled) ping()
    }, 4 * 60 * 1000)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') ping()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  useEffect(() => {
    if (loading || !form || submitting) return
    if (!form.project_name?.trim() || !form.log_date?.trim() || !form.submitted_by?.trim()) {
      setServerSaveStatus('Fill required fields to autosave')
      return
    }

    setServerSaveStatus('Database autosave pending')
    const timeoutId = window.setTimeout(async () => {
      const autosaveId = latestAutosaveId.current + 1
      latestAutosaveId.current = autosaveId
      setServerSaveStatus('Saving to database')

      try {
        const res = await fetch(`/api/pour-log/update-flatwork/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...buildPourLogPayload(),
            autosave: true,
          }),
        })

        if (!res.ok) throw new Error('Database autosave failed.')

        if (latestAutosaveId.current === autosaveId) {
          setServerSaveStatus('Saved to database')
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem(draftKey)
          }
          setDraftRestored(false)
        }
      } catch {
        if (latestAutosaveId.current === autosaveId) {
          setServerSaveStatus('Database autosave failed')
        }
      }
    }, 2200)

    return () => window.clearTimeout(timeoutId)
  }, [activeTruckIndex, buildPourLogPayload, draftKey, form, id, loading, submitting, trucks])

  useEffect(() => {
    setActiveTruckIndex(current => {
      if (current == null || trucks.length === 0) return null
      return Math.max(0, Math.min(current, trucks.length - 1))
    })
  }, [trucks.length])

  const updateForm = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const updateTruck = (i, field, value) => {
    const updated = [...trucks]
    updated[i][field] = value
    setTrucks(updated)
  }

  const addTruck = () => {
    setTrucks([...trucks, {
      truck_number: '',
      batch_time: '',
      arrival_time: '', pour_start: '', pour_complete: '',
      yards: '', concrete_temp: '', slump: '',
      air_content: '', water_added: '', cylinders_cast: '', notes: ''
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

  const removeTruck = (i) => {
    setTrucks(trucks.filter((_, idx) => idx !== i))
    setActiveTruckIndex(current => {
      if (current == null || current === i) return null
      return current > i ? current - 1 : current
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)

    const res = await fetch(`/api/pour-log/update-flatwork/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPourLogPayload())
    })

    if (res.ok) {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(draftKey)
      }
      setDraftStatus('Saved')
      setServerSaveStatus('Saved to database')
      router.push(`/pour-logs/${id}`)
    } else {
      alert('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  if (loading) return <p style={{ padding: '2rem' }}>Loading...</p>
  if (!log || !form) return <p style={{ padding: '2rem', color: 'red' }}>Pour log not found.</p>

  return (
    <FormPage maxWidth="900px">
      <FormBackLink href={`/pour-logs/${id}`}>Back</FormBackLink>

      <FormHero
        eyebrow="Pour Log"
        title="Edit Flatwork Pour Log"
        subtitle={form.project_name || 'Update flatwork sections, truck times, and test data.'}
        accent="#cc3300"
      />

      <div style={{ color: '#60717d', fontSize: '.86rem', margin: '-.1rem 0 1rem', fontWeight: '600' }}>
        {draftRestored
          ? 'Unsaved draft restored on this device.'
          : 'Changes autosave locally while you edit.'}
        <span style={draftStatusStyle}>{draftStatus}</span>
        <span style={draftStatusStyle}>{serverSaveStatus}</span>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={sectionStyle}>
          <div style={compactSectionHeaderStyle}>
            <div>
              <div style={sectionHeaderStyle}>Job Info</div>
              <div style={compactSummaryGridStyle}>
                <span style={compactSummaryItemStyle}>{form.project_name || 'No project name'}</span>
                <span style={compactSummaryItemStyle}>{form.log_date || 'No date'}</span>
                <span style={compactSummaryItemStyle}>{form.concrete_supplier || 'No supplier'}</span>
                <span style={compactSummaryItemStyle}>{form.submitted_by || 'No submitter'}</span>
              </div>
            </div>
            <button type="button" onClick={() => setJobInfoOpen(open => !open)} style={compactToggleButtonStyle}>
              {jobInfoOpen ? 'Hide Job Info' : 'Edit Job Info'}
            </button>
          </div>
          {jobInfoOpen && (
            <div style={compactExpandedBodyStyle}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Project Name</label>
                <input name="project_name" required style={inputStyle} value={form.project_name} onChange={e => updateForm('project_name', e.target.value)} />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Date</label>
                <input name="log_date" type="date" required style={inputStyle} value={form.log_date} onChange={e => updateForm('log_date', e.target.value)} />
              </div>
              <div style={rowStyle}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Weather</label>
                  <input name="weather" style={inputStyle} value={form.weather} onChange={e => updateForm('weather', e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Ambient Temp</label>
                  <input name="ambient_temp" style={inputStyle} value={form.ambient_temp} onChange={e => updateForm('ambient_temp', e.target.value)} />
                </div>
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Concrete Supplier</label>
                <input name="concrete_supplier" style={inputStyle} value={form.concrete_supplier} onChange={e => updateForm('concrete_supplier', e.target.value)} />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Submitted By</label>
                <input name="submitted_by" required style={inputStyle} value={form.submitted_by} onChange={e => updateForm('submitted_by', e.target.value)} />
              </div>
            </div>
          )}
        </div>

        <div style={sectionStyle}>
          <div style={compactSectionHeaderStyle}>
            <div>
              <div style={sectionHeaderStyle}>Pour Info</div>
              <div style={compactSummaryGridStyle}>
                <span style={compactSummaryItemStyle}>{form.area_location || 'No area'}</span>
                <span style={compactSummaryItemStyle}>{form.square_footage ? `${form.square_footage} sf` : 'No sf'}</span>
                <span style={compactSummaryItemStyle}>{form.thickness ? `${form.thickness} in` : 'No thickness'}</span>
                <span style={compactSummaryItemStyle}>{form.total_yards ? `${form.total_yards} yds` : 'No yardage'}</span>
              </div>
            </div>
            <button type="button" onClick={() => setPourInfoOpen(open => !open)} style={compactToggleButtonStyle}>
              {pourInfoOpen ? 'Hide Pour Info' : 'Edit Pour Info'}
            </button>
          </div>
          {pourInfoOpen && (
            <div style={compactExpandedBodyStyle}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Area / Location</label>
                <input name="area_location" style={inputStyle} value={form.area_location} onChange={e => updateForm('area_location', e.target.value)} />
              </div>
              <div style={rowStyle}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Square Footage</label>
                  <input name="square_footage" style={inputStyle} value={form.square_footage} onChange={e => updateForm('square_footage', e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Thickness (in)</label>
                  <input name="thickness" style={inputStyle} value={form.thickness} onChange={e => updateForm('thickness', e.target.value)} />
                </div>
              </div>
              <div style={rowStyle}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Total Est. Yards</label>
                  <input name="total_yards" style={inputStyle} value={form.total_yards} onChange={e => updateForm('total_yards', e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Finish Type</label>
                  <select name="finish_type" style={inputStyle} value={form.finish_type} onChange={e => updateForm('finish_type', e.target.value)}>
                    <option value="">Select...</option>
                    <option value="Broom">Broom</option>
                    <option value="Trowel">Trowel</option>
                    <option value="Exposed Aggregate">Exposed Aggregate</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>General Notes</label>
                <textarea name="general_notes" rows={3} style={{ ...inputStyle, resize: 'vertical' }} value={form.general_notes} onChange={e => updateForm('general_notes', e.target.value)} />
              </div>
            </div>
          )}
        </div>

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
                  <div style={{ fontWeight: '800', fontSize: '1.15rem' }}>Truck {i + 1}</div>
                  <div style={{ color: '#60717d', fontSize: '.84rem', marginTop: '.15rem' }}>
                    {t.truck_number ? `Truck ID / Unit # ${t.truck_number}` : 'Truck ID / Unit # not entered'}
                  </div>
                </div>
                {trucks.length > 1 && (
                  <button type="button" onClick={() => removeTruck(i)} style={removeBtnStyle}>Remove</button>
                )}
              </div>
              <div style={timePanelStyle}>
                <div style={timePanelHeaderStyle}>Truck Time Log</div>
                <div style={rowStyle}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Truck ID / Unit #</label>
                    <input
                      style={inputStyle}
                      value={t.truck_number || ''}
                      onChange={e => updateTruck(i, 'truck_number', e.target.value)}
                    />
                  </div>
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Batch Time</label>
                  <input type="time" style={inputStyle} value={t.batch_time || ''} onChange={e => updateTruck(i, 'batch_time', e.target.value)} />
                </div>
                <div style={timeGridStyle}>
                  <div style={timeFieldStyle}>
                    <label style={labelStyle}>Arrival Time</label>
                    <input type="time" style={inputStyle} value={t.arrival_time || ''} onChange={e => updateTruck(i, 'arrival_time', e.target.value)} />
                  </div>
                  <div style={timeFieldStyle}>
                    <label style={labelStyle}>Pour Start</label>
                    <input type="time" style={inputStyle} value={t.pour_start || ''} onChange={e => updateTruck(i, 'pour_start', e.target.value)} />
                  </div>
                  <div style={timeFieldStyle}>
                    <label style={labelStyle}>Pour Complete</label>
                    <input type="time" style={inputStyle} value={t.pour_complete || ''} onChange={e => updateTruck(i, 'pour_complete', e.target.value)} />
                  </div>
                </div>
              </div>
              <div style={rowStyle}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Yards</label>
                  <input style={inputStyle} value={t.yards || ''} onChange={e => updateTruck(i, 'yards', e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Concrete Temp</label>
                  <input style={inputStyle} value={t.concrete_temp || ''} onChange={e => updateTruck(i, 'concrete_temp', e.target.value)} />
                </div>
              </div>
              <div style={rowStyle}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Slump</label>
                  <input style={inputStyle} value={t.slump || ''} onChange={e => updateTruck(i, 'slump', e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Air Content</label>
                  <input style={inputStyle} value={t.air_content || ''} onChange={e => updateTruck(i, 'air_content', e.target.value)} />
                </div>
              </div>
              <div style={rowStyle}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Water Added</label>
                  <input style={inputStyle} value={t.water_added || ''} onChange={e => updateTruck(i, 'water_added', e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Cylinders Cast</label>
                  <input style={inputStyle} value={t.cylinders_cast || ''} onChange={e => updateTruck(i, 'cylinders_cast', e.target.value)} />
                </div>
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Truck Notes</label>
                <input style={inputStyle} value={t.notes || ''} onChange={e => updateTruck(i, 'notes', e.target.value)} />
              </div>
            </div>
            )
          })}
          <div style={truckActionsStyle}>
            <button type="button" onClick={addTruck} style={{ ...addBtnStyle, flex: '1 1 180px' }}>+ Add Truck</button>
            <button type="button" onClick={duplicateActiveTruck} style={{ ...secondaryActionButtonStyle, flex: '1 1 180px' }}>
              Duplicate Test Fields
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          style={{ ...formSubmitButtonStyle, marginBottom: '2rem', opacity: submitting ? 0.7 : 1 }}
        >
          {submitting ? 'Saving...' : 'Save Changes'}
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
  alignItems: 'start',
}

const compactSectionHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '1rem',
  flexWrap: 'wrap',
}

const compactSummaryGridStyle = {
  display: 'flex',
  gap: '.5rem',
  flexWrap: 'wrap',
  marginTop: '.55rem',
}

const compactSummaryItemStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '30px',
  padding: '.32rem .6rem',
  border: '1px solid #dfe6eb',
  borderRadius: '999px',
  color: '#40515d',
  background: '#fff',
  fontSize: '.78rem',
  fontWeight: '800',
  maxWidth: '240px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const compactToggleButtonStyle = {
  border: '1px solid #d6dde3',
  borderRadius: '12px',
  background: '#fff',
  color: '#2a3a45',
  padding: '.62rem .85rem',
  fontWeight: '800',
  cursor: 'pointer',
}

const compactExpandedBodyStyle = {
  marginTop: '1rem',
  borderTop: '1px solid #edf1f4',
  paddingTop: '1rem',
}

const draftStatusStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  border: '1px solid #dfe6eb',
  borderRadius: '999px',
  padding: '.26rem .62rem',
  marginLeft: '.6rem',
  color: '#40515d',
  background: '#fff',
  fontSize: '.78rem',
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
