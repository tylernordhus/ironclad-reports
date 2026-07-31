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
  formInlineNowButtonStyle as nowInlineBtnStyle,
  formInputStyle as inputStyle,
  formLabelStyle as baseLabelStyle,
  formRemoveButtonStyle as removeBtnStyle,
  formSectionStyle as sectionStyle,
  formSectionHeaderStyle as sectionHeaderStyle,
  formStatusButtonBaseStyle as statusBtnStyle,
  formSubmitButtonStyle,
  formTimeFieldStyle as timeFieldStyle,
  formTimePanelHeaderStyle as timePanelHeaderStyle,
  formTimePanelStyle as timePanelStyle,
} from '@/app/components/FormUi'
import { preparePhotoFileForUpload } from '@/lib/client-photo-upload'
import TremieBreakGuide, {
  createDefaultTremieGuide,
  normalizeTremieGuide,
} from '@/app/components/TremieBreakGuide'
import {
  buildTruckNotes,
  formatTruckFoundations,
  getTruckEstimatedLeftover,
  isRejectedTruck,
  stripRejectedMarker,
} from '@/lib/pour-log-trucks'

function emptyFoundation() {
  return {
    foundation_id: '',
    total_depth: '',
    actual_hole_depth: '',
    estimated_yards: '',
    shaft_diameter: '',
    anchor_bolt_projection: '',
    notes: ''
  }
}

function emptyTruck(truckNumber = '1') {
  return {
    truck_number: truckNumber,
    batch_time: '',
    arrival_time: '',
    pour_start: '',
    pour_complete: '',
    yards: '',
    rejected: false,
    foundations_served: [],
    shaft_depths: {},
    estimated_leftover_yards: '',
    concrete_temp: '',
    slump: '',
    air_content: '',
    water_added: '',
    cylinders_cast: '',
    notes: ''
  }
}

function asText(value) {
  return value == null ? '' : String(value)
}

function parseFoundationsServed(value) {
  const entries = String(value ?? '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)

  const foundations_served = []
  const shaft_depths = {}

  entries.forEach(entry => {
    const match = entry.match(/^(.*?)(?:\s*\((.*)\))?$/)
    const foundationId = match?.[1]?.trim()
    const depth = match?.[2]?.trim()

    if (!foundationId) return
    foundations_served.push(foundationId)
    if (depth) shaft_depths[foundationId] = depth
  })

  return { foundations_served, shaft_depths }
}

function sanitizeTruckFoundations(parsedFoundations, validFoundationIds) {
  const validSet = new Set(validFoundationIds.filter(Boolean))
  const foundations_served = parsedFoundations.foundations_served.filter(id => validSet.has(id))
  const shaft_depths = Object.fromEntries(
    Object.entries(parsedFoundations.shaft_depths).filter(([id]) => validSet.has(id))
  )

  return { foundations_served, shaft_depths }
}

function makePhotoItem({ id, url = '', label = '', file = null, previewUrl = '' }) {
  return {
    id,
    url,
    label,
    file,
    previewUrl: previewUrl || url,
  }
}

function serializePhotosForDraft(photos) {
  return (photos || [])
    .filter(photo => !photo.file && photo.url)
    .map(photo => ({
      id: photo.id,
      url: asText(photo.url),
      label: asText(photo.label),
    }))
}

function getApiUrl(path) {
  if (typeof window === 'undefined') return path
  return new URL(path, window.location.origin).toString()
}

function parseJsonSafe(text) {
  try {
    return text ? JSON.parse(text) : null
  } catch {
    return null
  }
}

function truckHasCompletionDepth(truck) {
  if (truck?.rejected) return false
  if ((truck?.foundations_served || []).length !== 1) return false

  return (truck.foundations_served || []).some(foundationId => {
    const depthText = asText(truck?.shaft_depths?.[foundationId]).trim()
    if (!depthText) return false
    const numericParts = depthText.match(/-?\d+(?:\.\d+)?/g)
    return Array.isArray(numericParts) && numericParts.length > 0 && numericParts.every(part => Number(part) === 0)
  })
}

function uploadPhotos(formData) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', getApiUrl('/api/upload-photos'))

    xhr.onload = () => {
      const data = parseJsonSafe(xhr.responseText)

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data || {})
        return
      }

      if (xhr.status === 413) {
        reject(new Error('Photo upload failed with HTTP 413. The image is still too large.'))
        return
      }

      const message =
        data?.errors?.join('\n') ||
        data?.error ||
        xhr.responseText?.trim() ||
        xhr.statusText ||
        'Photo upload failed'

      reject(new Error(xhr.status ? `${message} (HTTP ${xhr.status})` : message))
    }

    xhr.onerror = () => {
      reject(new Error('Photo upload failed before reaching the server. Please try again.'))
    }

    xhr.send(formData)
  })
}

async function uploadPhotosIndividually(photos, projectId = '') {
  const uploadedPhotos = []
  const errors = []

  for (const photo of photos) {
    let uploadFile = photo.uploadFile || photo.file

    try {
      uploadFile = await preparePhotoFileForUpload(uploadFile)
    } catch (error) {
      errors.push(error.message || `${photo.file?.name || 'Photo'}: Photo preparation failed.`)
      continue
    }

    const formData = new FormData()
    formData.append('folder', 'pour-logs')
    if (projectId) formData.append('project_id', projectId)
    formData.append('files', uploadFile)

    try {
      const result = await uploadPhotos(formData)
      const firstUpload = Array.isArray(result?.uploaded) ? result.uploaded[0] : null
      if (!firstUpload?.url) {
        errors.push(`${photo.file?.name || photo.uploadFile?.name || 'Photo'}: Photo upload did not return a file URL.`)
        continue
      }

      uploadedPhotos.push({
        url: firstUpload.url,
        label: photo.label.trim(),
      })
    } catch (error) {
      errors.push(`${photo.file?.name || photo.uploadFile?.name || 'Photo'}: ${error.message || 'Photo upload failed.'}`)
    }
  }

  return { uploadedPhotos, errors }
}

export default function EditPourLog() {
  const { id } = useParams()
  const router = useRouter()
  const draftKey = `pour-log-edit-draft:${id}`

  const [form, setForm] = useState(null)
  const [foundations, setFoundations] = useState([])
  const [trucks, setTrucks] = useState([])
  const [tremieGuide, setTremieGuide] = useState(() => createDefaultTremieGuide())
  const [jobInfoOpen, setJobInfoOpen] = useState(false)
  const [activeFoundationIndex, setActiveFoundationIndex] = useState(null)
  const [activeTruckIndex, setActiveTruckIndex] = useState(null)
  const [photos, setPhotos] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [draftRestored, setDraftRestored] = useState(false)
  const [draftStatus, setDraftStatus] = useState('Saved')
  const [serverSaveStatus, setServerSaveStatus] = useState('Saved to database')
  const photoId = useRef(1)
  const photosRef = useRef([])
  const latestAutosaveId = useRef(0)

  useEffect(() => {
    photosRef.current = photos
  }, [photos])

  useEffect(() => {
    return () => {
      photosRef.current.forEach(photo => {
        if (photo.file && photo.previewUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(photo.previewUrl)
        }
      })
    }
  }, [])

  useEffect(() => {
    let active = true

    fetch(`/api/pour-log/get/${id}`, { cache: 'no-store' })
      .then(r => {
        if (!r.ok) throw new Error('Failed to load pour log')
        return r.json()
      })
      .then(data => {
        if (!active) return

        const serverForm = {
          project_id: asText(data.log?.project_id),
          project_name: asText(data.log?.project_name),
          log_date: asText(data.log?.log_date),
          weather: asText(data.log?.weather),
          ambient_temp: asText(data.log?.ambient_temp),
          concrete_supplier: asText(data.log?.concrete_supplier),
          submitted_by: asText(data.log?.submitted_by),
        }
        const photoUrls = Array.isArray(data.log?.photo_urls) ? data.log.photo_urls : []
        const photoLabels = Array.isArray(data.log?.photo_labels) ? data.log.photo_labels : []
        const serverPhotos = photoUrls.map((url, index) => makePhotoItem({
          id: photoId.current++,
          url,
          label: asText(photoLabels[index]),
        }))
        const serverFoundations =
          data.foundations?.length
            ? data.foundations.map(f => ({
              id: f.id,
              foundation_id: asText(f.foundation_id),
              total_depth: asText(f.total_depth),
              actual_hole_depth: asText(f.actual_hole_depth),
              estimated_yards: asText(f.estimated_yards),
              shaft_diameter: asText(f.shaft_diameter),
              anchor_bolt_projection: asText(f.anchor_bolt_projection),
              notes: asText(f.notes),
            }))
            : [emptyFoundation()]
        const validFoundationIds = serverFoundations
          .map(f => asText(f.foundation_id).trim())
          .filter(Boolean)
        const serverTrucks =
          data.trucks?.length
            ? data.trucks.map((t, index) => {
              const parsedFoundations = sanitizeTruckFoundations(
                parseFoundationsServed(t.foundations_served),
                validFoundationIds
              )
              return {
                id: t.id,
                truck_number: asText(t.truck_number) || String(index + 1),
                batch_time: asText(t.batch_time),
                arrival_time: asText(t.arrival_time),
                pour_start: asText(t.pour_start),
                pour_complete: asText(t.pour_complete),
                yards: asText(t.yards),
                rejected: isRejectedTruck(t),
                foundations_served: parsedFoundations.foundations_served,
                shaft_depths: parsedFoundations.shaft_depths,
                estimated_leftover_yards: getTruckEstimatedLeftover(t),
                concrete_temp: asText(t.concrete_temp),
                slump: asText(t.slump),
                air_content: asText(t.air_content),
                water_added: asText(t.water_added),
                cylinders_cast: asText(t.cylinders_cast),
                notes: stripRejectedMarker(t.notes),
              }
            })
            : [emptyTruck()]

        let nextForm = serverForm
        let nextPhotos = serverPhotos
        let nextFoundations = serverFoundations
        let nextTrucks = serverTrucks
        let nextTremieGuide = normalizeTremieGuide(data.log?.tremie_break_guide)
        let restoredDraft = false

        if (typeof window !== 'undefined') {
          const rawDraft = window.localStorage.getItem(draftKey)
          const draft = parseJsonSafe(rawDraft)

          if (draft && typeof draft === 'object') {
            const draftSavedAt = Number(draft.savedAt || 0)
            const serverUpdatedAt = Date.parse(data.log?.updated_at || '')
            const draftIsOlderThanServer =
              Number.isFinite(serverUpdatedAt) &&
              serverUpdatedAt > 0 &&
              draftSavedAt > 0 &&
              draftSavedAt < serverUpdatedAt

            if (draftIsOlderThanServer && !window.confirm('A newer saved pour log exists. Restore the older local draft anyway?')) {
              window.localStorage.removeItem(draftKey)
              setDraftStatus('Saved')
            } else {
              if (draft.form && typeof draft.form === 'object') {
                nextForm = {
                  ...serverForm,
                  project_name: asText(draft.form.project_name ?? serverForm.project_name),
                  log_date: asText(draft.form.log_date ?? serverForm.log_date),
                  weather: asText(draft.form.weather ?? serverForm.weather),
                  ambient_temp: asText(draft.form.ambient_temp ?? serverForm.ambient_temp),
                  concrete_supplier: asText(draft.form.concrete_supplier ?? serverForm.concrete_supplier),
                  submitted_by: asText(draft.form.submitted_by ?? serverForm.submitted_by),
                }
              }

            if (Array.isArray(draft.foundations) && draft.foundations.length > 0) {
              nextFoundations = draft.foundations.map(foundation => ({
                id: foundation?.id,
                foundation_id: asText(foundation?.foundation_id),
                total_depth: asText(foundation?.total_depth),
                actual_hole_depth: asText(foundation?.actual_hole_depth),
                estimated_yards: asText(foundation?.estimated_yards),
                shaft_diameter: asText(foundation?.shaft_diameter),
                anchor_bolt_projection: asText(foundation?.anchor_bolt_projection),
                notes: asText(foundation?.notes),
              }))
            }

            const draftFoundationIds = nextFoundations
              .map(foundation => asText(foundation.foundation_id).trim())
              .filter(Boolean)

            if (Array.isArray(draft.trucks) && draft.trucks.length > 0) {
              nextTrucks = draft.trucks.map((truck, index) => {
                const parsedFoundations = sanitizeTruckFoundations({
                  foundations_served: Array.isArray(truck?.foundations_served) ? truck.foundations_served : [],
                  shaft_depths: truck?.shaft_depths && typeof truck.shaft_depths === 'object' ? truck.shaft_depths : {},
                }, draftFoundationIds)

                return {
                  id: truck?.id,
                  truck_number: asText(truck?.truck_number) || String(index + 1),
                  batch_time: asText(truck?.batch_time),
                  arrival_time: asText(truck?.arrival_time),
                  pour_start: asText(truck?.pour_start),
                  pour_complete: asText(truck?.pour_complete),
                  yards: asText(truck?.yards),
                  rejected: Boolean(truck?.rejected),
                  foundations_served: parsedFoundations.foundations_served,
                  shaft_depths: parsedFoundations.shaft_depths,
                  estimated_leftover_yards: asText(truck?.estimated_leftover_yards),
                  concrete_temp: asText(truck?.concrete_temp),
                  slump: asText(truck?.slump),
                  air_content: asText(truck?.air_content),
                  water_added: asText(truck?.water_added),
                  cylinders_cast: asText(truck?.cylinders_cast),
                  notes: stripRejectedMarker(truck?.notes),
                }
              })
            }

            if (draft.tremie_break_guide) {
              nextTremieGuide = normalizeTremieGuide(draft.tremie_break_guide)
            }

            if (Array.isArray(draft.photos)) {
              nextPhotos = draft.photos
                .filter(photo => photo?.url)
                .map(photo => makePhotoItem({
                  id: Number.isFinite(Number(photo?.id)) ? Number(photo.id) : photoId.current++,
                  url: asText(photo?.url),
                  label: asText(photo?.label),
                }))
            }

            if (draft.activeTruckIndex == null) {
              setActiveTruckIndex(null)
            } else if (Number.isFinite(Number(draft.activeTruckIndex))) {
              setActiveTruckIndex(Number(draft.activeTruckIndex))
            }
            if (draft.activeFoundationIndex == null) {
              setActiveFoundationIndex(null)
            } else if (Number.isFinite(Number(draft.activeFoundationIndex))) {
              setActiveFoundationIndex(Number(draft.activeFoundationIndex))
            }

              restoredDraft = true
              setDraftStatus('Draft saved')
            }
          }
        }

        const maxPhotoId = nextPhotos.reduce((max, photo) => Math.max(max, Number(photo.id) || 0), 0)
        photoId.current = Math.max(maxPhotoId + 1, 1)

        setForm(nextForm)
        setPhotos(nextPhotos)
        setFoundations(nextFoundations)
        setTrucks(nextTrucks)
        setTremieGuide(nextTremieGuide)
        setDraftRestored(restoredDraft)
        setLoading(false)
      })
      .catch(() => {
        if (!active) return
        setForm(null)
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [draftKey, id])

  const saveDraftNow = useCallback(() => {
    if (loading || !form || typeof window === 'undefined' || submitting) return false

    try {
      window.localStorage.setItem(draftKey, JSON.stringify({
        form,
        foundations,
        trucks,
        tremie_break_guide: tremieGuide,
        activeFoundationIndex,
        activeTruckIndex,
        photos: serializePhotosForDraft(photos),
        savedAt: Date.now(),
      }))
      setDraftStatus('Draft saved')
      return true
    } catch {
      setDraftStatus('Unsaved changes')
      return false
    }
  }, [activeFoundationIndex, activeTruckIndex, draftKey, form, foundations, loading, photos, submitting, tremieGuide, trucks])

  const buildPourLogPayload = useCallback(({ includeNewPhotos = false } = {}) => {
    const usablePhotos = photos.filter(photo => includeNewPhotos || !photo.file)
    return {
      ...form,
      photo_urls: usablePhotos.map(photo => photo.url).filter(Boolean),
      photo_labels: usablePhotos.map(photo => (photo.label || '').trim()),
      foundations,
      tremie_break_guide: tremieGuide,
      trucks: trucks.map(({ shaft_depths, foundations_served, ...truck }) => ({
        ...truck,
        foundations_served: formatTruckFoundations(foundations_served, shaft_depths, truck.rejected),
        notes: buildTruckNotes(
          truck.notes,
          truck.rejected,
          truckHasCompletionDepth({ ...truck, foundations_served, shaft_depths })
            ? truck.estimated_leftover_yards
            : ''
        ),
      })),
    }
  }, [form, foundations, photos, tremieGuide, trucks])

  useEffect(() => {
    if (loading || !form || typeof window === 'undefined' || submitting) return

    setDraftStatus('Unsaved changes')
    const timeoutId = window.setTimeout(() => {
      setDraftStatus('Saving')
      saveDraftNow()
    }, 350)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [activeFoundationIndex, activeTruckIndex, draftKey, form, foundations, loading, photos, saveDraftNow, submitting, tremieGuide, trucks])

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
        const res = await fetch(getApiUrl(`/api/pour-log/update/${id}`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...buildPourLogPayload({ includeNewPhotos: false }),
            autosave: true,
          }),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => null)
          throw new Error(data?.error || 'Database autosave failed.')
        }

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
  }, [activeFoundationIndex, activeTruckIndex, buildPourLogPayload, draftKey, form, foundations, id, loading, photos, submitting, tremieGuide, trucks])

  useEffect(() => {
    setActiveTruckIndex(current => {
      if (current == null || trucks.length === 0) return null
      return Math.max(0, Math.min(current, trucks.length - 1))
    })
  }, [trucks.length])

  useEffect(() => {
    setActiveFoundationIndex(current => {
      if (current == null || foundations.length === 0) return null
      return Math.max(0, Math.min(current, foundations.length - 1))
    })
  }, [foundations.length])

  const updateFoundation = (i, field, value) => {
    setFoundations(prev => prev.map((foundation, index) => (
      index === i ? { ...foundation, [field]: value } : foundation
    )))
  }

  const addFoundation = () => {
    setFoundations(prev => {
      setActiveFoundationIndex(prev.length)
      return [...prev, emptyFoundation()]
    })
  }

  const removeFoundation = (i) => {
    const foundationId = foundations[i]?.foundation_id
    setFoundations(prev => prev.filter((_, idx) => idx !== i))
    setActiveFoundationIndex(current => {
      if (current == null || current === i) return null
      return current > i ? current - 1 : current
    })

    if (!foundationId) return

    setTrucks(prev => prev.map(truck => {
      const served = (truck.foundations_served || []).filter(id => id !== foundationId)
      const nextDepths = { ...(truck.shaft_depths || {}) }
      delete nextDepths[foundationId]

      const nextTruck = {
        ...truck,
        foundations_served: served,
        shaft_depths: nextDepths,
      }
      return truckHasCompletionDepth(nextTruck)
        ? nextTruck
        : { ...nextTruck, estimated_leftover_yards: '' }
    }))
  }

  const updateTruck = (i, field, value) => {
    setTrucks(prev => prev.map((truck, index) => (
      index === i ? { ...truck, [field]: value } : truck
    )))
  }

  const addTruck = () => {
    setTrucks(prev => {
      setActiveTruckIndex(prev.length)
      return [...prev, emptyTruck('')]
    })
  }

  const duplicateActiveTruck = () => {
    setTrucks(prev => {
      const source = prev[activeTruckIndex] || prev[prev.length - 1]
      const duplicate = {
        ...emptyTruck(''),
        concrete_temp: source?.concrete_temp || '',
        slump: source?.slump || '',
        air_content: source?.air_content || '',
        water_added: source?.water_added || '',
        cylinders_cast: source?.cylinders_cast || '',
      }
      setActiveTruckIndex(prev.length)
      return [...prev, duplicate]
    })
  }

  const removeTruck = (i) => {
    setTrucks(prev => prev.filter((_, idx) => idx !== i))
    setActiveTruckIndex(current => {
      if (current == null || current === i) return null
      return current > i ? current - 1 : current
    })
  }

  const toggleRejectedTruck = (truckIndex) => {
    setTrucks(prev => prev.map((truck, index) => {
      if (index !== truckIndex) return truck

      const nextRejected = !truck.rejected
      const nextTruck = {
        ...truck,
        rejected: nextRejected,
        foundations_served: nextRejected ? [] : truck.foundations_served,
        shaft_depths: nextRejected ? {} : truck.shaft_depths,
      }
      return truckHasCompletionDepth(nextTruck)
        ? nextTruck
        : { ...nextTruck, estimated_leftover_yards: '' }
    }))
  }

  const toggleFoundationForTruck = (truckIndex, foundationId) => {
    setTrucks(prev => prev.map((truck, index) => {
      if (index !== truckIndex) return truck

      const served = truck.foundations_served || []
      if (served.includes(foundationId)) {
        const nextDepths = { ...(truck.shaft_depths || {}) }
        delete nextDepths[foundationId]
        const nextTruck = {
          ...truck,
          foundations_served: served.filter(id => id !== foundationId),
          shaft_depths: nextDepths,
        }
        return truckHasCompletionDepth(nextTruck)
          ? nextTruck
          : { ...nextTruck, estimated_leftover_yards: '' }
      }

      const nextTruck = {
        ...truck,
        foundations_served: [...served, foundationId],
        shaft_depths: { ...(truck.shaft_depths || {}), [foundationId]: truck.shaft_depths?.[foundationId] || '' },
      }
      return truckHasCompletionDepth(nextTruck)
        ? nextTruck
        : { ...nextTruck, estimated_leftover_yards: '' }
    }))
  }

  const setShaftDepth = (truckIndex, foundationId, depth) => {
    setTrucks(prev => prev.map((truck, index) => (
      index === truckIndex
        ? (() => {
          const nextTruck = {
          ...truck,
          shaft_depths: { ...(truck.shaft_depths || {}), [foundationId]: depth }
          }
          return truckHasCompletionDepth(nextTruck)
            ? nextTruck
            : { ...nextTruck, estimated_leftover_yards: '' }
        })()
        : truck
    )))
  }

  const addPhotos = (files) => {
    const nextPhotos = Array.from(files || []).map(file => makePhotoItem({
      id: photoId.current++,
      file,
      label: '',
      previewUrl: URL.createObjectURL(file),
    }))
    setPhotos(prev => [...prev, ...nextPhotos])
  }

  const updatePhoto = (id, field, value) => {
    setPhotos(prev => prev.map(photo => (
      photo.id === id ? { ...photo, [field]: value } : photo
    )))
  }

  const removePhoto = (id) => {
    setPhotos(prev => {
      const toRemove = prev.find(photo => photo.id === id)
      if (toRemove?.file && toRemove.previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(toRemove.previewUrl)
      }
      return prev.filter(photo => photo.id !== id)
    })
  }

  const confirmSaveWithoutPhotos = (message) => {
    if (typeof window === 'undefined') return false
    return window.confirm(
      `${message}\n\nPress OK to save your changes without the new photos.\nPress Cancel to stay on the page and retry photo upload.`
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      let uploadedPhotos = []
      const newPhotos = photos.filter(photo => photo.file)

      if (newPhotos.length > 0) {
        const uploadResult = await uploadPhotosIndividually(newPhotos, form?.project_id)
        uploadedPhotos = uploadResult.uploadedPhotos

        if (uploadResult.errors.length > 0 && !confirmSaveWithoutPhotos(uploadResult.errors.join('\n'))) {
          setSubmitting(false)
          return
        }
      }

      const finalPhotos = [
        ...photos
          .filter(photo => !photo.file)
          .map(photo => ({
            url: photo.url,
            label: photo.label.trim(),
          })),
        ...uploadedPhotos,
      ]

      const res = await fetch(getApiUrl(`/api/pour-log/update/${id}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...buildPourLogPayload({ includeNewPhotos: false }),
          photo_urls: finalPhotos.map(photo => photo.url),
          photo_labels: finalPhotos.map(photo => photo.label),
        })
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(`Save failed: ${data?.error || 'Something went wrong.'}`)
      }

      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(draftKey)
      }
      setDraftRestored(false)
      setDraftStatus('Saved')
      setServerSaveStatus('Saved to database')
      router.replace(`/pour-logs/${id}`)
      router.refresh()
    } catch (error) {
      alert(error.message || 'Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  if (loading) return <p style={{ padding: '2rem' }}>Loading...</p>
  if (!form) return <p style={{ padding: '2rem', color: 'red' }}>Pour log not found.</p>

  return (
    <FormPage maxWidth="920px">
      <FormBackLink href={`/pour-logs/${id}`}>Back</FormBackLink>

      <FormHero
        eyebrow="Pour Log"
        title="Edit Pour Log"
        subtitle={form.project_name || 'Update shaft details, trucks, and field notes.'}
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
                <input
                  name="project_name"
                  required
                  style={inputStyle}
                  value={form.project_name}
                  onChange={e => setForm(prev => ({ ...prev, project_name: e.target.value }))}
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Date</label>
                <input
                  name="log_date"
                  type="date"
                  required
                  style={inputStyle}
                  value={form.log_date}
                  onChange={e => setForm(prev => ({ ...prev, log_date: e.target.value }))}
                />
              </div>
              <div style={rowStyle}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Weather</label>
                  <input
                    name="weather"
                    style={inputStyle}
                    value={form.weather}
                    onChange={e => setForm(prev => ({ ...prev, weather: e.target.value }))}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Ambient Temp</label>
                  <input
                    name="ambient_temp"
                    style={inputStyle}
                    value={form.ambient_temp}
                    onChange={e => setForm(prev => ({ ...prev, ambient_temp: e.target.value }))}
                  />
                </div>
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Concrete Supplier</label>
                <input
                  name="concrete_supplier"
                  style={inputStyle}
                  value={form.concrete_supplier}
                  onChange={e => setForm(prev => ({ ...prev, concrete_supplier: e.target.value }))}
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Submitted By</label>
                <input
                  name="submitted_by"
                  required
                  style={inputStyle}
                  value={form.submitted_by}
                  onChange={e => setForm(prev => ({ ...prev, submitted_by: e.target.value }))}
                />
              </div>
            </div>
          )}
        </div>

        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>Foundations Poured</div>
          <div style={truckSwitcherStyle}>
            {foundations.map((f, i) => {
              const active = activeFoundationIndex === i
              return (
                <button
                  key={`foundation-jump-${i}`}
                  type="button"
                  onClick={() => setActiveFoundationIndex(current => current === i ? null : i)}
                  style={{
                    ...truckJumpButtonStyle,
                    borderColor: active ? '#cc3300' : '#d6dde3',
                    background: active ? '#fff4ef' : '#fff',
                  }}
                >
                  <span style={truckJumpTitleStyle}>Foundation {i + 1}</span>
                  <span style={truckJumpMetaStyle}>
                    {f.foundation_id || 'No shaft ID'}
                    {f.actual_hole_depth ? ` · Actual ${f.actual_hole_depth}` : f.total_depth ? ` · Design ${f.total_depth}` : ''}
                  </span>
                </button>
              )
            })}
          </div>

          {foundations.map((f, i) => {
            if (activeFoundationIndex !== i) return null

            return (
            <div key={i} style={{ ...cardStyle, borderColor: '#cc3300', background: '#fffdfb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <div style={{ fontWeight: '800', fontSize: '1.15rem' }}>Foundation {i + 1}</div>
                  <div style={{ color: '#60717d', fontSize: '.84rem', marginTop: '.15rem' }}>
                    {f.foundation_id || 'Foundation / Shaft ID not entered'}
                  </div>
                </div>
                {foundations.length > 1 && (
                  <button type="button" onClick={() => removeFoundation(i)} style={removeBtnStyle}>Remove</button>
                )}
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Foundation / Shaft ID</label>
                <input style={inputStyle} value={f.foundation_id} onChange={e => updateFoundation(i, 'foundation_id', e.target.value)} required />
              </div>
              <div style={rowStyle}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Design Depth</label>
                  <input style={inputStyle} value={f.total_depth || ''} onChange={e => updateFoundation(i, 'total_depth', e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Actual Depth</label>
                  <input style={inputStyle} value={f.actual_hole_depth || ''} onChange={e => updateFoundation(i, 'actual_hole_depth', e.target.value)} />
                </div>
              </div>
              <div style={rowStyle}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Est. Yards</label>
                  <input style={inputStyle} value={f.estimated_yards || ''} onChange={e => updateFoundation(i, 'estimated_yards', e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Shaft Diameter</label>
                  <input style={inputStyle} value={f.shaft_diameter || ''} onChange={e => updateFoundation(i, 'shaft_diameter', e.target.value)} />
                </div>
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Anchor Bolt Projection</label>
                <input style={inputStyle} value={f.anchor_bolt_projection || ''} onChange={e => updateFoundation(i, 'anchor_bolt_projection', e.target.value)} />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Notes</label>
                <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={2} value={f.notes || ''} onChange={e => updateFoundation(i, 'notes', e.target.value)} />
              </div>
            </div>
            )
          })}
          <button type="button" onClick={addFoundation} style={addBtnStyle}>+ Add Foundation</button>
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
                    <div style={{ fontWeight: '800', fontSize: '1.15rem' }}>Truck {i + 1}</div>
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
                  <button type="button" onClick={() => removeTruck(i)} style={removeBtnStyle}>Remove</button>
                )}
              </div>
              <div style={timePanelStyle}>
                <div style={timePanelHeaderStyle}>Truck Time Log</div>
                <div style={rowStyle}>
                  <div style={timeFieldStyle}>
                    <label style={labelStyle}>Truck ID / Unit #</label>
                    <input style={inputStyle} value={t.truck_number || ''} onChange={e => updateTruck(i, 'truck_number', e.target.value)} />
                  </div>
                  <div style={timeFieldStyle}>
                    <label style={labelStyle}>Batch Time</label>
                    <input type="time" style={inputStyle} value={t.batch_time || ''} onChange={e => updateTruck(i, 'batch_time', e.target.value)} />
                  </div>
                </div>
                <div style={rowStyle}>
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
              <div style={rowStyle}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Concrete Temp</label>
                  <input style={inputStyle} value={t.concrete_temp || ''} onChange={e => updateTruck(i, 'concrete_temp', e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Slump</label>
                  <input style={inputStyle} value={t.slump || ''} onChange={e => updateTruck(i, 'slump', e.target.value)} />
                </div>
              </div>
              <div style={rowStyle}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Air Content</label>
                  <input style={inputStyle} value={t.air_content || ''} onChange={e => updateTruck(i, 'air_content', e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Water Added</label>
                  <input style={inputStyle} value={t.water_added || ''} onChange={e => updateTruck(i, 'water_added', e.target.value)} />
                </div>
              </div>
              <div style={rowStyle}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Cylinders Cast</label>
                  <input style={inputStyle} value={t.cylinders_cast || ''} onChange={e => updateTruck(i, 'cylinders_cast', e.target.value)} />
                </div>
              </div>
              {!t.rejected && foundations.some(f => f.foundation_id) && (
                <div style={fieldStyle}>
                  <label style={labelStyle}>Foundations Served</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem', marginTop: '.3rem' }}>
                    {foundations.filter(f => f.foundation_id).map((foundation, foundationIndex) => {
                      const selected = (t.foundations_served || []).includes(foundation.foundation_id)
                      return (
                        <button
                          key={foundationIndex}
                          type="button"
                          onClick={() => toggleFoundationForTruck(i, foundation.foundation_id)}
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
                          {foundation.foundation_id}
                        </button>
                      )
                    })}
                  </div>

                  {(t.foundations_served || []).length > 0 && (
                    <div style={{ marginTop: '.75rem', padding: '.75rem', background: '#f0f4f8', borderRadius: '6px' }}>
                      <div style={{ fontSize: '.8rem', fontWeight: '700', color: '#555', marginBottom: '.5rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                        Finish Depth (from top)
                      </div>
                      {(t.foundations_served || []).map(foundationId => (
                        <div key={foundationId} style={{ display: 'flex', alignItems: 'center', gap: '.6rem', marginBottom: '.4rem' }}>
                          <span style={{ fontSize: '.85rem', fontWeight: '700', color: '#1a1a1a', minWidth: '90px' }}>{foundationId}</span>
                          <input
                            style={{ ...inputStyle, flex: 1 }}
                            placeholder={"e.g. 2'-3\""}
                            value={t.shaft_depths?.[foundationId] || ''}
                            onChange={e => setShaftDepth(i, foundationId, e.target.value)}
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
                            Estimated cubic yards left on the truck after the shaft reached 0.
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div style={fieldStyle}>
                <label style={labelStyle}>Notes</label>
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

        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>Photos</div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Add Photos</label>
            <input
              type="file"
              accept="image/*,.heic,.heif"
              multiple
              style={inputStyle}
              onChange={e => {
                addPhotos(e.target.files)
                e.target.value = ''
              }}
            />
            <div style={{ fontSize: '.8rem', color: '#888', marginTop: '.35rem' }}>
              Add, preview, caption, or remove photos before saving. iPhone HEIC/HEIF photos are converted automatically.
            </div>
          </div>

          {photos.length === 0 ? (
            <div style={{ fontSize: '.9rem', color: '#888' }}>No photos attached.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              {photos.map((photo, index) => (
                <div key={photo.id} style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.75rem', gap: '.75rem' }}>
                    <div style={{ fontWeight: '700', fontSize: '.95rem' }}>
                      Photo {index + 1}
                    </div>
                    <button type="button" onClick={() => removePhoto(photo.id)} style={removeBtnStyle}>
                      Delete
                    </button>
                  </div>
                  <a href={photo.previewUrl} target="_blank" rel="noopener noreferrer">
                    <img
                      src={photo.previewUrl}
                      alt={photo.label || `Photo ${index + 1}`}
                      style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '6px', display: 'block', marginBottom: '.75rem' }}
                    />
                  </a>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Comment / Caption</label>
                    <textarea
                      rows={2}
                      style={{ ...inputStyle, resize: 'vertical' }}
                      placeholder="Optional photo note"
                      value={photo.label}
                      onChange={e => updatePhoto(photo.id, 'label', e.target.value)}
                    />
                  </div>
                  {photo.file && (
                    <div style={{ fontSize: '.8rem', color: '#666' }}>{photo.file.name}</div>
                  )}
                </div>
              ))}
            </div>
          )}
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
  alignItems: 'start'
}
const labelStyle = {
  ...baseLabelStyle,
  display: 'flex',
  alignItems: 'flex-end',
  lineHeight: '1.2',
  minHeight: '2rem'
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
