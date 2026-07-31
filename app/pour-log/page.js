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
  formStatusButtonBaseStyle as statusBtnStyle,
  formSubmitButtonStyle,
  formTimeControlStyle as timeControlStyle,
  formTimeInputStyle as timeInputStyle,
  formTimePanelHeaderStyle as timePanelHeaderStyle,
  formTimePanelStyle as timePanelStyle,
} from '@/app/components/FormUi'
import { preparePhotoFileForUpload } from '@/lib/client-photo-upload'
import TremieBreakGuide, {
  createDefaultTremieGuide,
  normalizeTremieGuide,
} from '@/app/components/TremieBreakGuide'
import {
  HANDWRITTEN_IMPORT_STORAGE_KEY,
  emptyImportedFoundation,
  emptyImportedTruck,
  normalizeHandwrittenImportDraft,
} from '@/lib/pour-log-handwritten-import'
import { buildTruckNotes, formatTruckFoundations } from '@/lib/pour-log-trucks'

export default function PourLog() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const project_name = searchParams.get('project_name') || ''
  const project_id = searchParams.get('project_id') || ''
  const [projectName, setProjectName] = useState(project_name)

  useEffect(() => {
    if (!project_id) router.replace('/select-project?for=pour-log')
  }, [project_id, router])

  const [logDate, setLogDate] = useState('')
  const [weather, setWeather] = useState('')
  const [ambientTemp, setAmbientTemp] = useState('')
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [concreteSupplier, setConcreteSupplier] = useState('')
  const [submittedBy, setSubmittedBy] = useState('')

  const [foundations, setFoundations] = useState([emptyImportedFoundation()])

  const [trucks, setTrucks] = useState([emptyImportedTruck('1')])
  const [tremieGuide, setTremieGuide] = useState(() => createDefaultTremieGuide())
  const [activeTruckIndex, setActiveTruckIndex] = useState(null)

  const [submitting, setSubmitting] = useState(false)
  const [photoFiles, setPhotoFiles] = useState([])
  const [importReview, setImportReview] = useState(null)
  const [draftReady, setDraftReady] = useState(false)
  const [draftStatus, setDraftStatus] = useState('Saved')
  const draftKey = `pour-log-new-draft:${project_id || 'no-project'}:drilled_shaft`
  const skipNextDraftSave = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const rawDraft = window.localStorage.getItem(HANDWRITTEN_IMPORT_STORAGE_KEY)
    if (!rawDraft) return

    try {
      const parsedDraft = normalizeHandwrittenImportDraft(JSON.parse(rawDraft))
      const draftProjectId = String(parsedDraft?.project_id || '').trim()
      if (draftProjectId && project_id && draftProjectId !== project_id) {
        return
      }

      if (parsedDraft.project_name) setProjectName(parsedDraft.project_name)
      if (parsedDraft.log_date) setLogDate(parsedDraft.log_date)
      if (parsedDraft.weather) setWeather(parsedDraft.weather)
      if (parsedDraft.ambient_temp) setAmbientTemp(parsedDraft.ambient_temp)
      if (parsedDraft.concrete_supplier) setConcreteSupplier(parsedDraft.concrete_supplier)
      if (parsedDraft.submitted_by) setSubmittedBy(parsedDraft.submitted_by)
      if (parsedDraft.foundations?.length) setFoundations(parsedDraft.foundations)
      if (parsedDraft.trucks?.length) setTrucks(parsedDraft.trucks)

      setImportReview({
        review_notes: parsedDraft.review_notes || [],
        low_confidence_fields: parsedDraft.low_confidence_fields || [],
        missing_fields: parsedDraft.missing_fields || [],
        remarks_issues: parsedDraft.remarks_issues || '',
      })

      window.localStorage.removeItem(HANDWRITTEN_IMPORT_STORAGE_KEY)
    } catch (error) {
      console.error('Failed to load handwritten import draft:', error)
      window.localStorage.removeItem(HANDWRITTEN_IMPORT_STORAGE_KEY)
    }
  }, [project_id])

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
      if (Array.isArray(draft.foundations) && draft.foundations.length) setFoundations(draft.foundations)
      if (Array.isArray(draft.trucks) && draft.trucks.length) setTrucks(draft.trucks)
      if (draft.tremie_break_guide) setTremieGuide(normalizeTremieGuide(draft.tremie_break_guide))
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
        foundations,
        trucks,
        tremie_break_guide: tremieGuide,
        activeTruckIndex,
        savedAt: Date.now(),
      }))
      setDraftStatus('Draft saved')
      return true
    } catch {
      setDraftStatus('Unsaved changes')
      return false
    }
  }, [activeTruckIndex, ambientTemp, concreteSupplier, draftKey, draftReady, foundations, logDate, projectName, project_id, submittedBy, submitting, tremieGuide, trucks, weather])

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
  }, [activeTruckIndex, ambientTemp, concreteSupplier, draftKey, draftReady, foundations, logDate, projectName, project_id, saveDraftNow, submittedBy, submitting, tremieGuide, trucks, weather])

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

  const addFoundation = () => {
    setFoundations([...foundations, emptyImportedFoundation()])
  }

  const updateFoundation = (index, field, value) => {
    const updated = [...foundations]
    updated[index][field] = value
    setFoundations(updated)
  }

  const removeFoundation = (index) => {
    const foundationId = foundations[index]?.foundation_id
    setFoundations(foundations.filter((_, i) => i !== index))

    if (!foundationId) return

    setTrucks(prev => prev.map(truck => {
      const served = (truck.foundations_served || []).filter(id => id !== foundationId)
      const nextDepths = { ...(truck.shaft_depths || {}) }
      delete nextDepths[foundationId]

      return {
        ...truck,
        foundations_served: served,
        shaft_depths: nextDepths,
        estimated_leftover_yards: '',
      }
    }))
  }

  const addTruck = () => {
    setTrucks([...trucks, emptyImportedTruck('')])
    setActiveTruckIndex(trucks.length)
  }

  const duplicateActiveTruck = () => {
    const source = trucks[activeTruckIndex] || trucks[trucks.length - 1]
    const duplicate = {
      ...emptyImportedTruck(''),
      concrete_temp: source?.concrete_temp || '',
      slump: source?.slump || '',
      air_content: source?.air_content || '',
      water_added: source?.water_added || '',
      cylinders_cast: source?.cylinders_cast || '',
    }
    setTrucks([...trucks, duplicate])
    setActiveTruckIndex(trucks.length)
  }

  const updateTruck = (index, field, value) => {
    const updated = [...trucks]
    updated[index][field] = value
    setTrucks(updated)
  }

  const truckHasCompletionDepth = (truck) => {
    if (truck?.rejected) return false
    if ((truck?.foundations_served || []).length !== 1) return false

    return (truck.foundations_served || []).some(foundationId => {
      const depthText = String(truck?.shaft_depths?.[foundationId] || '').trim()
      if (!depthText) return false
      const numericParts = depthText.match(/-?\d+(?:\.\d+)?/g)
      return Array.isArray(numericParts) && numericParts.length > 0 && numericParts.every(part => Number(part) === 0)
    })
  }

  const setNow = (truckIndex, field) => {
    const now = new Date()
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    updateTruck(truckIndex, field, `${hh}:${mm}`)
  }

  const toggleFoundationForTruck = (truckIndex, foundationId) => {
    const updated = [...trucks]
    const served = updated[truckIndex].foundations_served
    if (served.includes(foundationId)) {
      updated[truckIndex].foundations_served = served.filter(f => f !== foundationId)
      const depths = { ...updated[truckIndex].shaft_depths }
      delete depths[foundationId]
      updated[truckIndex].shaft_depths = depths
    } else {
      updated[truckIndex].foundations_served = [...served, foundationId]
      updated[truckIndex].shaft_depths = { ...updated[truckIndex].shaft_depths, [foundationId]: '' }
    }
    if (!truckHasCompletionDepth(updated[truckIndex])) {
      updated[truckIndex].estimated_leftover_yards = ''
    }
    setTrucks(updated)
  }

  const setShaftDepth = (truckIndex, foundationId, depth) => {
    const updated = [...trucks]
    updated[truckIndex] = {
      ...updated[truckIndex],
      shaft_depths: { ...updated[truckIndex].shaft_depths, [foundationId]: depth }
    }
    if (!truckHasCompletionDepth(updated[truckIndex])) {
      updated[truckIndex].estimated_leftover_yards = ''
    }
    setTrucks(updated)
  }

  const removeTruck = (index) => {
    setTrucks(trucks.filter((_, i) => i !== index))
    setActiveTruckIndex(current => {
      if (current == null || current === index) return null
      return current > index ? current - 1 : current
    })
  }

  const toggleRejectedTruck = (truckIndex) => {
    const updated = [...trucks]
    const nextRejected = !updated[truckIndex].rejected
    updated[truckIndex] = {
      ...updated[truckIndex],
      rejected: nextRejected,
      foundations_served: nextRejected ? [] : updated[truckIndex].foundations_served,
      shaft_depths: nextRejected ? {} : updated[truckIndex].shaft_depths,
      estimated_leftover_yards: nextRejected ? '' : updated[truckIndex].estimated_leftover_yards,
    }
    if (!truckHasCompletionDepth(updated[truckIndex])) {
      updated[truckIndex].estimated_leftover_yards = ''
    }
    setTrucks(updated)
  }

  const confirmSaveWithoutPhotos = (message) => {
    if (typeof window === 'undefined') return false
    return window.confirm(
      `${message}\n\nPress OK to save the pour log without the new photos.\nPress Cancel to stay on the page and retry photo upload.`
    )
  }

  const uploadPhotoFilesIndividually = async (files) => {
    const uploadedUrls = []
    const uploadErrors = []

    for (const file of files) {
      let fileToUpload = file

      try {
        fileToUpload = await preparePhotoFileForUpload(file)
      } catch (error) {
        uploadErrors.push(error.message || `${file.name}: Photo preparation failed.`)
        continue
      }

      const fd = new FormData()
      fd.append('folder', 'pour-logs')
      fd.append('project_id', project_id)
      fd.append('files', fileToUpload)

      try {
        const uploadRes = await fetch('/api/upload-photos', { method: 'POST', body: fd })
        const responseText = await uploadRes.text()
        let uploadData = null
        try {
          uploadData = responseText ? JSON.parse(responseText) : null
        } catch {
          uploadData = null
        }

        if (!uploadRes.ok) {
          if (uploadRes.status === 413) {
            uploadErrors.push(`${file.name}: Photo is too large to upload from this device.`)
            continue
          }

          uploadErrors.push(
            uploadData?.errors?.join('\n') ||
            uploadData?.error ||
            responseText?.trim() ||
            `${file.name}: Photo upload failed.`
          )
          continue
        }

        const firstUrl = Array.isArray(uploadData?.urls) ? uploadData.urls[0] : ''
        if (!firstUrl) {
          uploadErrors.push(`${file.name}: Photo upload did not return a file URL.`)
          continue
        }

        uploadedUrls.push(firstUrl)
      } catch (error) {
        uploadErrors.push(`${file.name}: ${error.message || 'Photo upload failed.'}`)
      }
    }

    return { uploadedUrls, uploadErrors }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)

    let photo_urls = []
    if (photoFiles.length > 0) {
      const { uploadedUrls, uploadErrors } = await uploadPhotoFilesIndividually(photoFiles)
      photo_urls = uploadedUrls

      if (uploadErrors.length > 0 && !confirmSaveWithoutPhotos(uploadErrors.join('\n'))) {
        setSubmitting(false)
        return
      }
    }

    const payload = {
      project_id,
      project_name: projectName,
      log_date: logDate,
      weather,
      ambient_temp: ambientTemp,
      concrete_supplier: concreteSupplier,
      submitted_by: submittedBy,
      photo_urls,
      foundations,
      tremie_break_guide: tremieGuide,
      trucks: trucks.map(({ shaft_depths, foundations_served, ...t }) => ({
        ...t,
        foundations_served: formatTruckFoundations(foundations_served, shaft_depths, t.rejected),
        notes: buildTruckNotes(
          t.notes,
          t.rejected,
          truckHasCompletionDepth({ ...t, foundations_served, shaft_depths }) ? t.estimated_leftover_yards : ''
        ),
      }))
    }

    const res = await fetch('/api/pour-log/create', {
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
    <FormPage maxWidth="920px">
      <FormBackLink href={project_id ? '/projects/' + project_id : '/'}>
        Back
      </FormBackLink>

      <FormHero
        eyebrow="Pour Log"
        title="Drilled Shaft Pour Log"
        subtitle={projectName || 'Track shaft details, truck placements, and field test results.'}
        accent="#cc3300"
      />

      <div style={draftStatusStyle}>
        {draftStatus}
      </div>

      {importReview && (
        <div style={{
          background: '#fff7e8',
          border: '1px solid #f0c36d',
          borderRadius: '12px',
          padding: '1rem',
          marginBottom: '1.5rem',
        }}>
          <div style={{ fontWeight: '800', color: '#7a5410', marginBottom: '.45rem' }}>
            Imported Handwritten Draft
          </div>
          <div style={{ color: '#7a5410', fontSize: '.95rem', marginBottom: '.7rem' }}>
            Check every field against the handwritten form before saving. This import is only a suggestion.
          </div>
          {importReview.review_notes?.length > 0 && (
            <div style={{ color: '#7a5410', fontSize: '.92rem', marginBottom: '.45rem' }}>
              {importReview.review_notes.join(' ')}
            </div>
          )}
          {importReview.low_confidence_fields?.length > 0 && (
            <div style={{ color: '#7a5410', fontSize: '.9rem', marginBottom: '.35rem' }}>
              <strong>Low confidence:</strong> {importReview.low_confidence_fields.join(', ')}
            </div>
          )}
          {importReview.missing_fields?.length > 0 && (
            <div style={{ color: '#7a5410', fontSize: '.9rem', marginBottom: '.35rem' }}>
              <strong>Missing on paper:</strong> {importReview.missing_fields.join(', ')}
            </div>
          )}
          {importReview.remarks_issues && (
            <div style={{ color: '#7a5410', fontSize: '.9rem' }}>
              <strong>Remarks / issues:</strong> {importReview.remarks_issues}
            </div>
          )}
        </div>
      )}

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
                placeholder="e.g. 88°F"
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

        {/* FOUNDATIONS */}
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>Foundations Poured</div>

          {foundations.map((f, i) => (
            <div key={i} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ fontWeight: '700', color: '#1a1a1a' }}>Foundation {i + 1}</div>
                {foundations.length > 1 && (
                  <button type="button" onClick={() => removeFoundation(i)} style={removeBtnStyle}>
                    Remove
                  </button>
                )}
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Foundation / Shaft ID</label>
                <input
                  style={inputStyle}
                  placeholder="e.g. 4A2, 6A Middle"
                  value={f.foundation_id}
                  onChange={e => updateFoundation(i, 'foundation_id', e.target.value)}
                  required
                />
              </div>
              <div style={rowStyle}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Design Depth</label>
                  <input
                    style={inputStyle}
                    placeholder="e.g. 14'-6&quot;"
                    value={f.total_depth}
                    onChange={e => updateFoundation(i, 'total_depth', e.target.value)}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Actual Depth</label>
                  <input
                    style={inputStyle}
                    placeholder="e.g. 15'-0&quot;"
                    value={f.actual_hole_depth || ''}
                    onChange={e => updateFoundation(i, 'actual_hole_depth', e.target.value)}
                  />
                </div>
              </div>
              <div style={rowStyle}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Est. Yards</label>
                  <input
                    style={inputStyle}
                    placeholder="e.g. 8.5"
                    value={f.estimated_yards}
                    onChange={e => updateFoundation(i, 'estimated_yards', e.target.value)}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Shaft Diameter</label>
                  <input
                    style={inputStyle}
                    placeholder={"e.g. 8'-0\""}
                    value={f.shaft_diameter || ''}
                    onChange={e => updateFoundation(i, 'shaft_diameter', e.target.value)}
                  />
                </div>
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Anchor Bolt Projection</label>
                <input
                  style={inputStyle}
                  placeholder={"e.g. 9\""}
                  value={f.anchor_bolt_projection || ''}
                  onChange={e => updateFoundation(i, 'anchor_bolt_projection', e.target.value)}
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Notes</label>
                <textarea
                  style={{ ...inputStyle, resize: 'vertical' }}
                  rows={2}
                  placeholder="Any notes"
                  value={f.notes}
                  onChange={e => updateFoundation(i, 'notes', e.target.value)}
                />
              </div>
            </div>
          ))}

          <button type="button" onClick={addFoundation} style={addBtnStyle}>
            + Add Foundation
          </button>
        </div>

        <TremieBreakGuide
          value={tremieGuide}
          onChange={setTremieGuide}
          foundations={foundations}
          trucks={trucks}
          sectionStyle={sectionStyle}
          sectionHeaderStyle={sectionHeaderStyle}
          fieldStyle={fieldStyle}
          labelStyle={labelStyle}
          inputStyle={inputStyle}
        />

        {/* TRUCKS */}
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
                    {t.rejected ? ' · Rejected' : ''}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                  <div>
                    <div style={{ fontWeight: '800', color: '#1a1a1a', fontSize: '1.15rem' }}>Truck {i + 1}</div>
                    <div style={{ color: '#60717d', fontSize: '.84rem', marginTop: '.15rem' }}>
                      {t.truck_number ? `Truck ID / Unit # ${t.truck_number}` : 'Truck ID / Unit # not entered'}
                    </div>
                  </div>
                  {t.rejected && (
                    <span style={{
                      padding: '.22rem .55rem',
                      borderRadius: '999px',
                      background: '#7a1212',
                      color: 'white',
                      fontSize: '.72rem',
                      fontWeight: '800',
                      letterSpacing: '.04em',
                    }}>
                      REJECTED
                    </span>
                  )}
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
                  {[
                    { label: 'Truck ID / Unit #', field: 'truck_number', type: 'text', hasNow: false },
                    { label: 'Batch Time', field: 'batch_time', type: 'time', hasNow: true },
                  ].map(({ label, field, type = 'time', hasNow = true }) => (
                    <div key={field} style={{ flex: 1 }}>
                      <label style={labelStyle}>{label}</label>
                      <div style={hasNow ? timeControlStyle : undefined}>
                        <input
                          type={type}
                          style={hasNow ? timeInputStyle : inputStyle}
                          value={t[field]}
                          onChange={e => updateTruck(i, field, e.target.value)}
                        />
                        {hasNow && (
                          <button
                            type="button"
                            onClick={() => setNow(i, field)}
                            style={nowInlineBtnStyle}
                          >
                            Now
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={rowStyle}>
                  {[
                    { label: 'Arrival Time', field: 'arrival_time' },
                    { label: 'Pour Start', field: 'pour_start' },
                    { label: 'Pour Complete', field: 'pour_complete' },
                  ].map(({ label, field, type = 'time', hasNow = true }) => (
                    <div key={field} style={{ flex: 1 }}>
                      <label style={labelStyle}>{label}</label>
                      <div style={timeControlStyle}>
                        <input
                          type={type}
                          style={timeInputStyle}
                          value={t[field]}
                          onChange={e => updateTruck(i, field, e.target.value)}
                        />
                        {hasNow && (
                          <button
                            type="button"
                            onClick={() => setNow(i, field)}
                            style={nowInlineBtnStyle}
                          >
                            Now
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Yards</label>
                <input style={inputStyle} placeholder="e.g. 9.5" value={t.yards} onChange={e => updateTruck(i, 'yards', e.target.value)} />
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Load Status</label>
                <button
                  type="button"
                  onClick={() => toggleRejectedTruck(i)}
                  style={{
                    ...statusBtnStyle,
                    background: t.rejected ? '#7a1212' : 'white',
                    color: t.rejected ? 'white' : '#7a1212',
                    borderColor: '#7a1212',
                  }}
                >
                  {t.rejected ? 'Rejected Load' : 'Mark Rejected'}
                </button>
                <div style={{ fontSize: '.8rem', color: '#666', marginTop: '.45rem' }}>
                  Rejected loads stay on the log but do not count as concrete placed in the shaft.
                </div>
              </div>

              {/* Foundations served chips */}
              {!t.rejected && foundations.some(f => f.foundation_id) && (
                <div style={fieldStyle}>
                  <label style={labelStyle}>Foundations Served</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem', marginTop: '.3rem' }}>
                    {foundations.filter(f => f.foundation_id).map((f, fi) => {
                      const selected = t.foundations_served.includes(f.foundation_id)
                      return (
                        <button
                          key={fi}
                          type="button"
                          onClick={() => toggleFoundationForTruck(i, f.foundation_id)}
                          style={{
                            padding: '.5rem 1rem',
                            borderRadius: '6px',
                            border: '2px solid',
                            borderColor: selected ? '#cc3300' : '#ddd',
                            background: selected ? '#cc3300' : 'white',
                            color: selected ? 'white' : '#666',
                            fontWeight: '600',
                            fontSize: '.85rem',
                            cursor: 'pointer'
                          }}
                        >
                          {f.foundation_id}
                        </button>
                      )
                    })}
                  </div>

                  {/* Finish depth per selected shaft */}
                  {t.foundations_served.length > 0 && (
                    <div style={{ marginTop: '.75rem', padding: '.75rem', background: '#f0f4f8', borderRadius: '6px' }}>
                      <div style={{ fontSize: '.8rem', fontWeight: '700', color: '#555', marginBottom: '.5rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                        Finish Depth (from top)
                      </div>
                      {t.foundations_served.map(foundId => (
                        <div key={foundId} style={{ display: 'flex', alignItems: 'center', gap: '.6rem', marginBottom: '.4rem' }}>
                          <span style={{ fontSize: '.85rem', fontWeight: '700', color: '#1a1a1a', minWidth: '90px' }}>{foundId}</span>
                          <input
                            style={{ ...inputStyle, flex: 1 }}
                            placeholder="e.g. 2'-3&quot;"
                            value={t.shaft_depths?.[foundId] || ''}
                            onChange={e => setShaftDepth(i, foundId, e.target.value)}
                          />
                        </div>
                      ))}
                      {truckHasCompletionDepth(t) && (
                        <div style={{ marginTop: '.75rem' }}>
                          <label style={labelStyle}>Estimated Left On Truck</label>
                          <input
                            style={inputStyle}
                            placeholder="e.g. 1.25"
                            value={t.estimated_leftover_yards || ''}
                            onChange={e => updateTruck(i, 'estimated_leftover_yards', e.target.value)}
                          />
                          <div style={{ fontSize: '.78rem', color: '#666', marginTop: '.35rem' }}>
                            Estimated cubic yards left on the truck after the shaft reached `0`.
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div style={rowStyle}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Concrete Temp</label>
                  <input style={inputStyle} placeholder="e.g. 90°F" value={t.concrete_temp} onChange={e => updateTruck(i, 'concrete_temp', e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Slump</label>
                  <input style={inputStyle} placeholder='e.g. 7.75"' value={t.slump} onChange={e => updateTruck(i, 'slump', e.target.value)} />
                </div>
              </div>

              <div style={rowStyle}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Air Content</label>
                  <input style={inputStyle} placeholder="e.g. 4.0%" value={t.air_content} onChange={e => updateTruck(i, 'air_content', e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Water Added</label>
                  <input style={inputStyle} placeholder="e.g. None or 5 gal" value={t.water_added} onChange={e => updateTruck(i, 'water_added', e.target.value)} />
                </div>
              </div>

              <div style={rowStyle}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Cylinders Cast</label>
                  <input style={inputStyle} placeholder="e.g. 4" value={t.cylinders_cast} onChange={e => updateTruck(i, 'cylinders_cast', e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Notes</label>
                  <input style={inputStyle} placeholder="Any issues" value={t.notes} onChange={e => updateTruck(i, 'notes', e.target.value)} />
                </div>
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

        <button
          type="submit"
          disabled={submitting}
          style={{ ...formSubmitButtonStyle, marginBottom: '2rem', opacity: submitting ? 0.7 : 1 }}
        >
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
  alignItems: 'start',
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
