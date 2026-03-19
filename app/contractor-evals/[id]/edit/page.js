'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function EditContractorEval({ params }) {
  const router = useRouter()
  const [data, setData] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/contractor-eval/get/' + params.id)
      .then(r => r.json())
      .then(d => setData(d.eval_))
  }, [params.id])

  if (!data) return <p style={{ padding: '2rem', color: '#666' }}>Loading...</p>

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const formData = new FormData(e.target)
    const res = await fetch('/api/contractor-eval/update/' + params.id, { method: 'POST', body: formData })
    if (res.ok) {
      router.push('/contractor-evals/' + params.id)
    } else {
      setError('Something went wrong. Please try again.')
      setSaving(false)
    }
  }

  return (
    <main style={{ maxWidth: '680px', margin: '0 auto', padding: '1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <a href={'/contractor-evals/' + params.id} style={{ color: '#cc3300', textDecoration: 'none', fontSize: '.9rem' }}>← Back</a>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 style={{ color: '#1a1a1a', fontSize: '1.8rem', marginBottom: '.5rem' }}>Edit Contractor Evaluation</h1>
        {data.project_name && <p style={{ color: '#cc3300', fontSize: '1rem', fontWeight: '600', margin: 0 }}>{data.project_name}</p>}
      </div>

      {error && <p style={{ color: '#cc3300', background: '#fff3f0', padding: '1rem', borderRadius: '6px', marginBottom: '1rem' }}>{error}</p>}

      <form onSubmit={handleSubmit}>
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>Inspector Information</div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Inspector Name</label>
            <input name="inspector_name" defaultValue={data.inspector_name || ''} style={inputStyle} />
          </div>
          <div style={rowStyle}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Date</label>
              <input name="inspection_date" type="date" defaultValue={data.inspection_date || ''} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Inspection Location</label>
              <input name="inspection_location" defaultValue={data.inspection_location || ''} style={inputStyle} />
            </div>
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>Contractor Information</div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Contractor Name</label>
            <input name="contractor_name" defaultValue={data.contractor_name || ''} style={inputStyle} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Project Name / Number</label>
            <input name="project_name" defaultValue={data.project_name || ''} style={inputStyle} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Supervisor Name</label>
            <input name="supervisor_name" defaultValue={data.supervisor_name || ''} style={inputStyle} />
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>Safety Compliance</div>
          <YesNo name="ppe_compliant" question="Are all workers wearing appropriate PPE?" defaultValue={data.ppe_compliant} />
          <YesNo name="safety_signs" question="Are safety signs and barriers in place?" defaultValue={data.safety_signs} />
          <YesNo name="emergency_procedures" question="Are emergency procedures clearly communicated?" defaultValue={data.emergency_procedures} />
          <div style={fieldStyle}>
            <label style={labelStyle}>Comments</label>
            <textarea name="safety_comments" rows={2} defaultValue={data.safety_comments || ''} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>Work Quality</div>
          <YesNo name="work_specs" question="Is the work being performed according to project specifications?" defaultValue={data.work_specs} />
          <YesNo name="materials_quality" question="Are materials and equipment of acceptable quality?" defaultValue={data.materials_quality} />
          <YesNo name="workmanship" question="Is the workmanship neat and professional?" defaultValue={data.workmanship} />
          <div style={fieldStyle}>
            <label style={labelStyle}>Comments</label>
            <textarea name="work_quality_comments" rows={2} defaultValue={data.work_quality_comments || ''} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>Timeliness</div>
          <YesNo name="on_schedule" question="Is the project on schedule?" defaultValue={data.on_schedule} />
          <YesNo name="milestones_met" question="Are milestones being met as planned?" defaultValue={data.milestones_met} />
          <div style={fieldStyle}>
            <label style={labelStyle}>Comments</label>
            <textarea name="timeliness_comments" rows={2} defaultValue={data.timeliness_comments || ''} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>Communication</div>
          <YesNo name="contractor_responsive" question="Is the contractor responsive to inquiries and concerns?" defaultValue={data.contractor_responsive} />
          <YesNo name="progress_reports" question="Are progress reports provided regularly?" defaultValue={data.progress_reports} />
          <div style={fieldStyle}>
            <label style={labelStyle}>Comments</label>
            <textarea name="communication_comments" rows={2} defaultValue={data.communication_comments || ''} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>Compliance with Regulations</div>
          <YesNo name="regulations_compliant" question="Is the contractor adhering to all regulations?" defaultValue={data.regulations_compliant} />
          <YesNo name="permits_current" question="Are all permits and licenses current?" defaultValue={data.permits_current} />
          <div style={fieldStyle}>
            <label style={labelStyle}>Comments</label>
            <textarea name="compliance_comments" rows={2} defaultValue={data.compliance_comments || ''} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>Environmental Considerations</div>
          <YesNo name="env_impact_minimized" question="Is the contractor minimizing environmental impact?" defaultValue={data.env_impact_minimized} />
          <YesNo name="waste_disposal" question="Are waste materials disposed of properly?" defaultValue={data.waste_disposal} />
          <div style={fieldStyle}>
            <label style={labelStyle}>Comments</label>
            <textarea name="environmental_comments" rows={2} defaultValue={data.environmental_comments || ''} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>Overall Evaluation</div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Overall Performance Rating</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem', marginTop: '.3rem' }}>
              {['Excellent', 'Good', 'Satisfactory', 'Needs Improvement', 'Unsatisfactory'].map(r => (
                <label key={r} style={{ display: 'flex', alignItems: 'center', gap: '.4rem', cursor: 'pointer', padding: '.5rem .9rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '.9rem', background: 'white' }}>
                  <input type="radio" name="overall_rating" value={r} defaultChecked={data.overall_rating === r} />
                  {r}
                </label>
              ))}
            </div>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Comments</label>
            <textarea name="overall_comments" rows={3} defaultValue={data.overall_comments || ''} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>Inspector Signature</div>
          <div style={rowStyle}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Signature (type full name)</label>
              <input name="inspector_signature" defaultValue={data.inspector_signature || ''} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Date</label>
              <input name="signature_date" type="date" defaultValue={data.signature_date || ''} style={inputStyle} />
            </div>
          </div>
        </div>

        <button type="submit" disabled={saving} style={{
          width: '100%', padding: '1.1rem',
          background: saving ? '#999' : '#cc3300', color: 'white',
          border: 'none', borderRadius: '8px',
          fontSize: '1.1rem', fontWeight: '700',
          cursor: saving ? 'not-allowed' : 'pointer', marginBottom: '3rem'
        }}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </main>
  )
}

function YesNo({ name, question, defaultValue }) {
  return (
    <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #f0f0f0' }}>
      <div style={{ fontSize: '.9rem', color: '#333', marginBottom: '.5rem' }}>{question}</div>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '.4rem', cursor: 'pointer', fontWeight: '600', color: '#2a7a2a' }}>
          <input type="radio" name={name} value="yes" defaultChecked={defaultValue === true} /> Yes
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '.4rem', cursor: 'pointer', fontWeight: '600', color: '#cc3300' }}>
          <input type="radio" name={name} value="no" defaultChecked={defaultValue === false} /> No
        </label>
      </div>
    </div>
  )
}

const sectionStyle = { background: 'white', borderRadius: '10px', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }
const sectionHeaderStyle = { fontWeight: '800', fontSize: '1.1rem', color: '#1a1a1a', marginBottom: '1.2rem', paddingBottom: '.75rem', borderBottom: '2px solid #f0f0f0' }
const fieldStyle = { marginBottom: '1rem' }
const rowStyle = { display: 'flex', gap: '1rem', marginBottom: '1rem' }
const labelStyle = { display: 'block', fontWeight: '600', marginBottom: '.3rem', color: '#333', fontSize: '.85rem' }
const inputStyle = { width: '100%', padding: '.7rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '1rem', boxSizing: 'border-box', background: 'white' }
