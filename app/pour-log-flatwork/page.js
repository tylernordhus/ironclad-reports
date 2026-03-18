'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'

export default function PourLogFlatwork() {
  const searchParams = useSearchParams()
  const project_name = searchParams.get('project_name') || ''
  const project_id = searchParams.get('project_id') || ''

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

  const removeTruck = (index) => {
    setTrucks(trucks.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)

    const formData = new FormData(e.target)

    const payload = {
      project_id,
      project_name: formData.get('project_name'),
      log_date: formData.get('log_date'),
      log_type: 'flatwork',
      weather: formData.get('weather'),
      ambient_temp: formData.get('ambient_temp'),
      concrete_supplier: formData.get('concrete_supplier'),
      submitted_by: formData.get('submitted_by'),
      area_location: formData.get('area_location'),
      square_footage: formData.get('square_footage'),
      thickness: formData.get('thickness'),
      total_yards: formData.get('total_yards'),
      finish_type: formData.get('finish_type'),
      general_notes: formData.get('general_notes'),
      trucks
    }

    const res = await fetch('/api/pour-log/create-flatwork', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (res.ok) {
      window.location.href = project_id ? '/projects/' + project_id : '/'
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
              <input name="ambient_temp" style={inputStyle} placeholder="e.g. 75°F" />
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

        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>Pour Info</div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Area / Location</label>
            <input name="area_location" style={inputStyle} placeholder="e.g. Building pad grid A-D" />
          </div>
          <div style={rowStyle}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Square Footage</label>
              <input name="square_footage" style={inputStyle} placeholder="e.g. 2400" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Thickness (in)</label>
              <input name="thickness" style={inputStyle} placeholder='e.g. 6"' />
            </div>
          </div>
          <div style={rowStyle}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Total Est. Yards</label>
              <input name="total_yards" style={inputStyle} placeholder="e.g. 45" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Finish Type</label>
              <select name="finish_type" style={inputStyle}>
                <option value="">Select...</option>
                <option value="Broom">Broom</option>
                <option value="Trowel">Trowel</option>
                <option value="Exposed Aggregate">Exposed Aggregate</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>General Notes​​​​​​​​​​​​​​​​
