'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

export default function PourLogFlatwork() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const project_name = searchParams.get('project_name') || ''
  const project_id = searchParams.get('project_id') || ''

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
      truck_number: '1',
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
      truck_number: String(trucks.length + 1),
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
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)

    const formData = new FormData(e.target)

    let photo_urls = []
    if (photoFiles.length > 0) {
      const fd = new FormData()
      fd.append('folder', 'pour-logs')
      photoFiles.forEach(f => fd.append('files', f))
      const uploadRes = await fetch('/api/upload-photos', { method: 'POST', body: fd })
      if (uploadRes.ok) {
        const uploadData = await uploadRes.json()
        photo_urls = uploadData.urls
      }
    }

    const payload = {
      project_id,
      project_name: formData.get('project_name'),
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
      router.push('/pour-logs/' + data.id)
    } else {
      alert('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <main style={{ maxWidth: '680px', margin: '0 auto', padding: '1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <a href={project_id ? '/pour-log-select?project_id=' + project_id + '&project_name=' + encodeURIComponent(project_name) : '/'} style={{ color: '#cc3300', textDecoration: 'none', fontSize: '.9rem' }}>
          Back
        </a>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 style={{ color: '#1a1a1a', fontSize: '1.8rem', marginBottom: '.5rem' }}>
          Flatwork Pour Log
        </h1>
        {project_name && (
          <p style={{ color: '#cc3300', fontSize: '1rem', fontWeight: '600', margin: 0 }}>
            {project_name}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit}>

        {/* JOB INFO */}
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>Job Info</div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Project Name</label>
            <input name="project_name" required style={inputStyle} defaultValue={project_name} />
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

          {trucks.map((t, i) => (
            <div key={i} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ fontWeight: '700', color: '#1a1a1a', fontSize: '1.1rem' }}>Truck {t.truck_number}</div>
                {trucks.length > 1 && (
                  <button type="button" onClick={() => removeTruck(i)} style={removeBtnStyle}>
                    Remove
                  </button>
                )}
              </div>

              {/* Time fields with Now buttons */}
              <div style={rowStyle}>
                {[
                  { label: 'Arrival Time', field: 'arrival_time' },
                  { label: 'Pour Start', field: 'pour_start' },
                  { label: 'Pour Complete', field: 'pour_complete' },
                ].map(({ label, field }) => (
                  <div key={field} style={{ flex: 1 }}>
                    <label style={labelStyle}>{label}</label>
                    <input
                      type="time"
                      style={inputStyle}
                      value={t[field]}
                      onChange={e => updateTruck(i, field, e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setNow(i, field)}
                      style={nowBtnStyle}
                    >
                      Now
                    </button>
                  </div>
                ))}
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
          ))}

          <button type="button" onClick={addTruck} style={addBtnStyle}>
            + Add Truck
          </button>
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
    </main>
  )
}

const sectionStyle = {
  background: 'white',
  borderRadius: '10px',
  padding: '1.5rem',
  marginBottom: '1.5rem',
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
}

const sectionHeaderStyle = {
  fontWeight: '800',
  fontSize: '1.1rem',
  color: '#1a1a1a',
  marginBottom: '1.2rem',
  paddingBottom: '.75rem',
  borderBottom: '2px solid #f0f0f0'
}

const fieldStyle = { marginBottom: '1rem' }

const rowStyle = {
  display: 'flex',
  gap: '1rem',
  marginBottom: '1rem'
}

const cardStyle = {
  background: '#f9f9f9',
  border: '1px solid #eee',
  borderRadius: '8px',
  padding: '1.2rem',
  marginBottom: '1rem'
}

const labelStyle = {
  display: 'block',
  fontWeight: '600',
  marginBottom: '.3rem',
  color: '#333',
  fontSize: '.85rem'
}

const inputStyle = {
  width: '100%',
  padding: '.7rem',
  border: '1px solid #ddd',
  borderRadius: '6px',
  fontSize: '1rem',
  boxSizing: 'border-box',
  background: 'white'
}

const addBtnStyle = {
  width: '100%',
  padding: '.9rem',
  background: '#f5f5f5',
  border: '2px dashed #ddd',
  borderRadius: '8px',
  fontSize: '1rem',
  fontWeight: '600',
  color: '#666',
  cursor: 'pointer'
}

const removeBtnStyle = {
  padding: '.3rem .8rem',
  background: 'white',
  border: '1px solid #ddd',
  borderRadius: '4px',
  fontSize: '.8rem',
  color: '#999',
  cursor: 'pointer'
}

const nowBtnStyle = {
  marginTop: '.3rem',
  width: '100%',
  padding: '.4rem',
  background: '#f0f0f0',
  border: '1px solid #ddd',
  borderRadius: '5px',
  fontSize: '.78rem',
  fontWeight: '700',
  color: '#555',
  cursor: 'pointer'
}
