export default async function ContractorEvalPage(props) {
  const searchParams = await props.searchParams
  const project_name = searchParams?.project_name || ''
  const project_id = searchParams?.project_id || ''

  return (
    <main style={{ maxWidth: '680px', margin: '0 auto', padding: '1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <a href={project_id ? `/projects/${project_id}` : '/'} style={{ color: '#cc3300', textDecoration: 'none', fontSize: '.9rem' }}>
          ← Back
        </a>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 style={{ color: '#1a1a1a', fontSize: '1.8rem', marginBottom: '.5rem' }}>Contractor Evaluation</h1>
        {project_name && (
          <p style={{ color: '#cc3300', fontSize: '1rem', fontWeight: '600', margin: 0 }}>{project_name}</p>
        )}
      </div>

      <form action="/api/contractor-eval/create" method="POST">
        <input type="hidden" name="project_id" value={project_id} />
        <input type="hidden" name="project_name_hidden" value={project_name} />

        {/* Inspector Info */}
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>Inspector Information</div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Inspector Name</label>
            <input name="inspector_name" style={inputStyle} placeholder="Your name" />
          </div>
          <div style={rowStyle}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Date</label>
              <input name="inspection_date" type="date" style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Inspection Location</label>
              <input name="inspection_location" style={inputStyle} placeholder="e.g. Site A" />
            </div>
          </div>
        </div>

        {/* Contractor Info */}
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>Contractor Information</div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Contractor Name</label>
            <input name="contractor_name" style={inputStyle} placeholder="e.g. ABC Concrete Co." />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Project Name / Number</label>
            <input name="project_name" style={inputStyle} defaultValue={project_name} placeholder="e.g. Wichita Substation" />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Supervisor Name</label>
            <input name="supervisor_name" style={inputStyle} placeholder="On-site supervisor" />
          </div>
        </div>

        {/* Safety Compliance */}
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>Safety Compliance</div>
          <YesNo name="ppe_compliant" question="Are all workers wearing appropriate PPE?" />
          <YesNo name="safety_signs" question="Are safety signs and barriers in place?" />
          <YesNo name="emergency_procedures" question="Are emergency procedures clearly communicated and accessible?" />
          <div style={fieldStyle}>
            <label style={labelStyle}>Comments</label>
            <textarea name="safety_comments" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
        </div>

        {/* Work Quality */}
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>Work Quality</div>
          <YesNo name="work_specs" question="Is the work being performed according to project specifications?" />
          <YesNo name="materials_quality" question="Are materials and equipment of acceptable quality?" />
          <YesNo name="workmanship" question="Is the workmanship neat and professional?" />
          <div style={fieldStyle}>
            <label style={labelStyle}>Comments</label>
            <textarea name="work_quality_comments" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
        </div>

        {/* Timeliness */}
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>Timeliness</div>
          <YesNo name="on_schedule" question="Is the project on schedule?" />
          <YesNo name="milestones_met" question="Are milestones being met as planned?" />
          <div style={fieldStyle}>
            <label style={labelStyle}>Comments</label>
            <textarea name="timeliness_comments" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
        </div>

        {/* Communication */}
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>Communication</div>
          <YesNo name="contractor_responsive" question="Is the contractor responsive to inquiries and concerns?" />
          <YesNo name="progress_reports" question="Are progress reports provided regularly?" />
          <div style={fieldStyle}>
            <label style={labelStyle}>Comments</label>
            <textarea name="communication_comments" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
        </div>

        {/* Compliance */}
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>Compliance with Regulations</div>
          <YesNo name="regulations_compliant" question="Is the contractor adhering to local, state, and federal regulations?" />
          <YesNo name="permits_current" question="Are all necessary permits and licenses obtained and up to date?" />
          <div style={fieldStyle}>
            <label style={labelStyle}>Comments</label>
            <textarea name="compliance_comments" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
        </div>

        {/* Environmental */}
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>Environmental Considerations</div>
          <YesNo name="env_impact_minimized" question="Is the contractor minimizing environmental impact?" />
          <YesNo name="waste_disposal" question="Are waste materials disposed of properly?" />
          <div style={fieldStyle}>
            <label style={labelStyle}>Comments</label>
            <textarea name="environmental_comments" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
        </div>

        {/* Overall */}
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>Overall Evaluation</div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Overall Performance Rating</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem', marginTop: '.3rem' }}>
              {['Excellent', 'Good', 'Satisfactory', 'Needs Improvement', 'Unsatisfactory'].map(r => (
                <label key={r} style={{ display: 'flex', alignItems: 'center', gap: '.4rem', cursor: 'pointer', padding: '.5rem .9rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '.9rem', background: 'white' }}>
                  <input type="radio" name="overall_rating" value={r} />
                  {r}
                </label>
              ))}
            </div>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Comments</label>
            <textarea name="overall_comments" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
        </div>

        {/* Signature */}
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>Inspector Signature</div>
          <div style={rowStyle}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Signature (type full name)</label>
              <input name="inspector_signature" style={inputStyle} placeholder="Type your full name" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Date</label>
              <input name="signature_date" type="date" style={inputStyle} />
            </div>
          </div>
        </div>

        <button type="submit" style={{
          width: '100%', padding: '1.1rem',
          background: '#cc3300', color: 'white',
          border: 'none', borderRadius: '8px',
          fontSize: '1.1rem', fontWeight: '700',
          cursor: 'pointer', marginBottom: '3rem'
        }}>
          Submit Evaluation
        </button>
      </form>
    </main>
  )
}

function YesNo({ name, question }) {
  return (
    <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #f0f0f0' }}>
      <div style={{ fontSize: '.9rem', color: '#333', marginBottom: '.5rem' }}>{question}</div>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '.4rem', cursor: 'pointer', fontWeight: '600', color: '#2a7a2a' }}>
          <input type="radio" name={name} value="yes" /> Yes
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '.4rem', cursor: 'pointer', fontWeight: '600', color: '#cc3300' }}>
          <input type="radio" name={name} value="no" /> No
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
