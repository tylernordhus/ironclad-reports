'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function EditPourLog() {
  const { id } = useParams()
  const router = useRouter()

  const [log, setLog] = useState(null)
  const [foundations, setFoundations] = useState([])
  const [trucks, setTrucks] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/pour-log/get/${id}`)
      .then(r => r.json())
      .then(data => {
        setLog(data.log)
        setFoundations(data.foundations || [])
        setTrucks(data.trucks || [])
        setLoading(false)
      })
  }, [id])

  const updateFoundation = (i, field, value) => {
    const updated = [...foundations]
    updated[i][field] = value
    setFoundations(updated)
  }

  const addFoundation = () => {
    setFoundations([...foundations, { foundation_id: '', total_depth: '', estimated_yards: '', notes: '' }])
  }

  const removeFoundation = (i) => {
    setFoundations(foundations.filter((_, idx) => idx !== i))
  }

  const updateTruck = (i, field, value) => {
    const updated = [...trucks]
    updated[i][field] = value
    setTrucks(updated)
  }

  const addTruck = () => {
    setTrucks([...trucks, {
      truck_number: String(trucks.length + 1),
      arrival_time: '', pour_start: '', pour_complete: '',
      yards: '', foundations_served: '', depth_reading: '',
      concrete_temp: '', slump: '', air_content: '',
      water_added: '', cylinders_cast: '', notes: ''
    }])
  }

  const removeTruck = (i) => {
    setTrucks(trucks.filter((_, idx) => idx !== i))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    const formData = new FormData(e.target)
    formData.set('foundations', JSON.stringify(foundations))
    formData.set('trucks', JSON.stringify(trucks))
    const res = await fetch(`/api/pour-log/update/${id}`, {
      method: 'POST',
      body: formData
    })

    if (res.ok) {
      router.push(`/pour-logs/${id}`)
    } else {
      alert('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  if (loading) return <p style={{ padding: '2rem' }}>Loading...</p>
  if (!log) return <p style={{ padding: '2rem', color: 'red' }}>Pour log not found.</p>

  return (
    <main style={{ maxWidth: '680px', margin: '0 auto', padding: '1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <a href={`/pour-logs/${id}`} style={{ color: '#cc3300', textDecoration: 'none', fontSize: '.9rem' }}>
          ← Back
        </a>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 style={{ color: '#1a1a1a', fontSize: '1.8rem', marginBottom: '.5rem' }}>Edit Pour Log</h1>
        <p style={{ color: '#cc3300', fontSize: '1rem', fontWeight: '600', margin: 0 }}>{log.project_name}</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>Job Info</div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Project Name</label>
            <input name="project_name" required style={inputStyle} defaultValue={log.project_name} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Date</label>
            <input name="log_date" type="date" required style={inputStyle} defaultValue={log.log_date} />
          </div>
          <div style={rowStyle}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Weather</label>
              <input name="weather" style={inputStyle} defaultValue={log.weather || ''} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Ambient Temp</label>
              <input name="ambient_temp" style={inputStyle} defaultValue={log.ambient_temp || ''} />
            </div>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Concrete Supplier</label>
            <input name="concrete_supplier" style={inputStyle} defaultValue={log.concrete_supplier || ''} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Submitted By</label>
            <input name="submitted_by" required style={inputStyle} defaultValue={log.submitted_by} />
          </div>
          {log.photo_urls && log.photo_urls.length > 0 && (
            <div style={fieldStyle}>
              <label style={labelStyle}>Existing Photos</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '.75rem' }}>
                {log.photo_urls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    <img src={url} alt={`Photo ${i + 1}`} style={{ width: '100%', height: '110px', objectFit: 'cover', borderRadius: '6px', display: 'block' }} />
                  </a>
                ))}
              </div>
            </div>
          )}
          <div style={fieldStyle}>
            <label style={labelStyle}>Add Photos</label>
            <input name="add_photos" type="file" accept="image/*" multiple style={inputStyle} />
            <div style={{ fontSize: '.8rem', color: '#888', marginTop: '.35rem' }}>
              New photos will be appended to this pour log.
            </div>
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>Foundations Poured</div>
          {foundations.map((f, i) => (
            <div key={i} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ fontWeight: '700' }}>Foundation {i + 1}</div>
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
                  <label style={labelStyle}>Total Depth</label>
                  <input style={inputStyle} value={f.total_depth || ''} onChange={e => updateFoundation(i, 'total_depth', e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Est. Yards</label>
                  <input style={inputStyle} value={f.estimated_yards || ''} onChange={e => updateFoundation(i, 'estimated_yards', e.target.value)} />
                </div>
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Notes</label>
                <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={2} value={f.notes || ''} onChange={e => updateFoundation(i, 'notes', e.target.value)} />
              </div>
            </div>
          ))}
          <button type="button" onClick={addFoundation} style={addBtnStyle}>+ Add Foundation</button>
        </div>

        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>Concrete Trucks</div>
          {trucks.map((t, i) => (
            <div key={i} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ fontWeight: '700', fontSize: '1.1rem' }}>Truck {t.truck_number}</div>
                {trucks.length > 1 && (
                  <button type="button" onClick={() => removeTruck(i)} style={removeBtnStyle}>Remove</button>
                )}
              </div>
              <div style={rowStyle}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Arrival Time</label>
                  <input type="time" style={inputStyle} value={t.arrival_time || ''} onChange={e => updateTruck(i, 'arrival_time', e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Pour Start</label>
                  <input type="time" style={inputStyle} value={t.pour_start || ''} onChange={e => updateTruck(i, 'pour_start', e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Pour Complete</label>
                  <input type="time" style={inputStyle} value={t.pour_complete || ''} onChange={e => updateTruck(i, 'pour_complete', e.target.value)} />
                </div>
              </div>
              <div style={rowStyle}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Yards</label>
                  <input style={inputStyle} value={t.yards || ''} onChange={e => updateTruck(i, 'yards', e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Depth Reading</label>
                  <input style={inputStyle} value={t.depth_reading || ''} onChange={e => updateTruck(i, 'depth_reading', e.target.value)} />
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
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Foundations Served</label>
                  <input style={inputStyle} value={t.foundations_served || ''} onChange={e => updateTruck(i, 'foundations_served', e.target.value)} />
                </div>
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Notes</label>
                <input style={inputStyle} value={t.notes || ''} onChange={e => updateTruck(i, 'notes', e.target.value)} />
              </div>
            </div>
          ))}
          <button type="button" onClick={addTruck} style={addBtnStyle}>+ Add Truck</button>
        </div>

        <button type="submit" disabled={submitting} style={{
          width: '100%', padding: '1.1rem',
          background: submitting ? '#999' : '#cc3300',
          color: 'white', border: 'none', borderRadius: '8px',
          fontSize: '1.1rem', fontWeight: '700',
          cursor: submitting ? 'not-allowed' : 'pointer',
          marginTop: '.5rem', marginBottom: '3rem'
        }}>
          {submitting ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </main>
  )
}

const sectionStyle = { background: 'white', borderRadius: '10px', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }
const sectionHeaderStyle = { fontWeight: '800', fontSize: '1.1rem', color: '#1a1a1a', marginBottom: '1.2rem', paddingBottom: '.75rem', borderBottom: '2px solid #f0f0f0' }
const fieldStyle = { marginBottom: '1rem' }
const rowStyle = { display: 'flex', gap: '1rem', marginBottom: '1rem' }
const cardStyle = { background: '#f9f9f9', border: '1px solid #eee', borderRadius: '8px', padding: '1.2rem', marginBottom: '1rem' }
const labelStyle = { display: 'block', fontWeight: '600', marginBottom: '.3rem', color: '#333', fontSize: '.85rem' }
const inputStyle = { width: '100%', padding: '.7rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '1rem', boxSizing: 'border-box', background: 'white' }
const addBtnStyle = { width: '100%', padding: '.9rem', background: '#f5f5f5', border: '2px dashed #ddd', borderRadius: '8px', fontSize: '1rem', fontWeight: '600', color: '#666', cursor: 'pointer' }
const removeBtnStyle = { padding: '.3rem .8rem', background: 'white', border: '1px solid #ddd', borderRadius: '4px', fontSize: '.8rem', color: '#999', cursor: 'pointer' }
