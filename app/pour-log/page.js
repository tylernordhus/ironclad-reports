'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'

export default function PourLog() {
  const searchParams = useSearchParams()
  const project_name = searchParams.get('project_name') || ''
  const project_id = searchParams.get('project_id') || ''

  const [foundations, setFoundations] = useState([
    { foundation_id: '', total_depth: '', estimated_yards: '', notes: '' }
  ])

  const [trucks, setTrucks] = useState([
    {
      truck_number: '1',
      arrival_time: '',
      pour_start: '',
      pour_complete: '',
      yards: '',
      foundations_served: [],
      depth_reading: '',
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

  const addFoundation = () => {
    setFoundations([...foundations, { foundation_id: '', total_depth: '', estimated_yards: '', notes: '' }])
  }

  const updateFoundation = (index, field, value) => {
    const updated = [...foundations]
    updated[index][field] = value
    setFoundations(updated)
  }

  const removeFoundation = (index) => {
    setFoundations(foundations.filter((_, i) => i !== index))
  }

  const addTruck = () => {
    setTrucks([...trucks, {
      truck_number: String(trucks.length + 1),
      arrival_time: '',
      pour_start: '',
      pour_complete: '',
      yards: '',
      foundations_served: [],
      depth_reading: '',
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

  const toggleFoundationForTruck = (truckIndex, foundationId) => {
    const updated = [...trucks]
    const served = updated[truckIndex].foundations_served
    if (served.includes(foundationId)) {
      updated[truckIndex].foundations_served = served.filter(f => f !== foundationId)
    } else {
      updated[truckIndex].foundations_served = [...served, foundationId]
    }
    setTrucks(updated)
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
      log_date: formData.get('log_date'),
      weather: formData.get('weather'),
      ambient_temp: formData.get('ambient_temp'),
      concrete_supplier: formData.get('concrete_supplier'),
      submitted_by: formData.get('submitted_by'),
      photo_urls,
      foundations,
      trucks: trucks.map(t => ({
        ...t,
        foundations_served: t.foundations_served.join(', ')
      }))
    }

    const res = await fetch('/api/pour-log/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (res.ok) {
      const data = await res.json()
      window.location.href = project_id
        ? '/projects/' + project_id
        : '/pour-logs'
    } else {
      alert('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <main style={{ maxWidth: '680px', margin: '0 auto', padding: '1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <a href={project_id ? '/projects/' + project_id : '/'} style={{ color: '#cc3300', textDecoration: 'none', fontSize: '.9rem' }}>
          Back
        </a>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 style={{ color: '#1a1a1a', fontSize: '1.8rem', marginBottom: '.5rem' }}>
          Drilled Shaft Pour Log
        </h1>
        {project_name && (
          <p style={{ color: '#cc3300', fontSize: '1rem', fontWeight: '600', margin: 0 }}>
            {project_name}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit}>

        {/* HEADER */}
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>Job Info</div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Project Name</label>
            <input name="project_name" required style={inputStyle} defaultValue={project_name} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Date</label>
            <input name="log_date" type="date" required style={inputStyle} />
          </div>
          <div style={rowStyle}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Weather</label>
              <input name="weather" style={inputStyle} placeholder="e.g. Sunny" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Ambient Temp</label>
              <input name="ambient_temp" style={inputStyle} placeholder="e.g. 88°F" />
            </div>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Concrete Supplier</label>
            <input name="concrete_supplier" style={inputStyle} placeholder="e.g. Central Concrete" />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Submitted By</label>
            <input name="submitted_by" required style={inputStyle} placeholder="Your name" />
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
                  <label style={labelStyle}>Total Depth</label>
                  <input
                    style={inputStyle}
                    placeholder="e.g. 14'-6"
                    value={f.total_depth}
                    onChange={e => updateFoundation(i, 'total_depth', e.target.value)}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Est. Yards</label>
                  <input
                    style={inputStyle}
                    placeholder="e.g. 8.5"
                    value={f.estimated_yards}
                    onChange={e => updateFoundation(i, 'estimated_yards', e.target.value)}
                  />
                </div>
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Notes</label>
                <textarea
                  style={{ ...inputStyle, resize: 'vertical' }}
                  rows={2}
                  placeholder="e.g. Poured to 2' from top with truck 1, completed with truck 2"
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

        {/* TRUCKS */}
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

              <div style={rowStyle}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Arrival Time</label>
                  <input type="time" style={inputStyle} value={t.arrival_time} onChange={e => updateTruck(i, 'arrival_time', e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Pour Start</label>
                  <input type="time" style={inputStyle} value={t.pour_start} onChange={e => updateTruck(i, 'pour_start', e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Pour Complete</label>
                  <input type="time" style={inputStyle} value={t.pour_complete} onChange={e => updateTruck(i, 'pour_complete', e.target.value)} />
                </div>
              </div>

              <div style={rowStyle}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Yards</label>
                  <input style={inputStyle} placeholder="e.g. 9.5" value={t.yards} onChange={e => updateTruck(i, 'yards', e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Depth Reading</label>
                  <input style={inputStyle} placeholder="e.g. 8'-3" value={t.depth_reading} onChange={e => updateTruck(i, 'depth_reading', e.target.value)} />
                </div>
              </div>

              {foundations.some(f => f.foundation_id) && (
                <div style={fieldStyle}>
                  <label style={labelStyle}>Foundations Served</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem', marginTop: '.3rem' }}>
                    {foundations.filter(f => f.foundation_id).map((f, fi) => (
                      <button
                        key={fi}
                        type="button"
                        onClick={() => toggleFoundationForTruck(i, f.foundation_id)}
                        style={{
                          padding: '.5rem 1rem',
                          borderRadius: '6px',
                          border: '2px solid',
                          borderColor: t.foundations_served.includes(f.foundation_id) ? '#cc3300' : '#ddd',
                          background: t.foundations_served.includes(f.foundation_id) ? '#cc3300' : 'white',
                          color: t.foundations_served.includes(f.foundation_id) ? 'white' : '#666',
                          fontWeight: '600',
                          fontSize: '.85rem',
                          cursor: 'pointer'
                        }}
                      >
                        {f.foundation_id}
                      </button>
                    ))}
                  </div>
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
          ))}

          <button type="button" onClick={addTruck} style={addBtnStyle}>
            + Add Truck
          </button>
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

const fieldStyle = {
  marginBottom: '1rem'
}

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
