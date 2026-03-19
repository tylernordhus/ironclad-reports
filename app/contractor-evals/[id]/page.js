import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export const revalidate = 0

function formatDate(d) {
  if (!d) return '-'
  const [y, m, day] = d.split('-')
  return m + '-' + day + '-' + y
}

function YN({ value }) {
  if (value === true) return <span style={{ color: '#2a7a2a', fontWeight: '700' }}>Yes</span>
  if (value === false) return <span style={{ color: '#cc3300', fontWeight: '700' }}>No</span>
  return <span style={{ color: '#999' }}>—</span>
}

export default async function ContractorEvalDetail({ params }) {
  const { data: eval_, error } = await supabase
    .from('contractor_evaluations')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !eval_) return <p style={{ padding: '2rem', color: 'red' }}>Evaluation not found.</p>

  const backHref = eval_.project_id ? `/projects/${eval_.project_id}` : '/reports'

  return (
    <main style={{ maxWidth: '750px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href={backHref} style={{ color: '#cc3300', textDecoration: 'none', fontSize: '.9rem' }}>← Back</Link>
      </div>

      <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '1.5rem' }}>
        <div style={{ background: '#cc3300', padding: '1.5rem 2rem' }}>
          <h1 style={{ color: 'white', fontSize: '1.4rem', margin: 0 }}>Contractor Evaluation</h1>
          <p style={{ color: 'rgba(255,255,255,0.85)', margin: '.3rem 0 0', fontSize: '.9rem' }}>
            {eval_.project_name} · {formatDate(eval_.inspection_date)}
          </p>
        </div>
        <div style={{ padding: '1.5rem 2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <Field label="Inspector" value={eval_.inspector_name} />
            <Field label="Inspection Location" value={eval_.inspection_location} />
            <Field label="Contractor" value={eval_.contractor_name} />
            <Field label="Supervisor" value={eval_.supervisor_name} />
          </div>
        </div>
      </div>

      <Section title="Safety Compliance">
        <CheckRow label="Workers wearing appropriate PPE?" value={eval_.ppe_compliant} />
        <CheckRow label="Safety signs and barriers in place?" value={eval_.safety_signs} />
        <CheckRow label="Emergency procedures communicated?" value={eval_.emergency_procedures} />
        {eval_.safety_comments && <Field label="Comments" value={eval_.safety_comments} />}
      </Section>

      <Section title="Work Quality">
        <CheckRow label="Work performed to project specifications?" value={eval_.work_specs} />
        <CheckRow label="Materials and equipment acceptable quality?" value={eval_.materials_quality} />
        <CheckRow label="Workmanship neat and professional?" value={eval_.workmanship} />
        {eval_.work_quality_comments && <Field label="Comments" value={eval_.work_quality_comments} />}
      </Section>

      <Section title="Timeliness">
        <CheckRow label="Project on schedule?" value={eval_.on_schedule} />
        <CheckRow label="Milestones being met?" value={eval_.milestones_met} />
        {eval_.timeliness_comments && <Field label="Comments" value={eval_.timeliness_comments} />}
      </Section>

      <Section title="Communication">
        <CheckRow label="Contractor responsive to inquiries?" value={eval_.contractor_responsive} />
        <CheckRow label="Progress reports provided regularly?" value={eval_.progress_reports} />
        {eval_.communication_comments && <Field label="Comments" value={eval_.communication_comments} />}
      </Section>

      <Section title="Compliance with Regulations">
        <CheckRow label="Adhering to local/state/federal regulations?" value={eval_.regulations_compliant} />
        <CheckRow label="Permits and licenses current?" value={eval_.permits_current} />
        {eval_.compliance_comments && <Field label="Comments" value={eval_.compliance_comments} />}
      </Section>

      <Section title="Environmental Considerations">
        <CheckRow label="Minimizing environmental impact?" value={eval_.env_impact_minimized} />
        <CheckRow label="Waste disposed of properly?" value={eval_.waste_disposal} />
        {eval_.environmental_comments && <Field label="Comments" value={eval_.environmental_comments} />}
      </Section>

      <Section title="Overall Evaluation">
        {eval_.overall_rating && (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '.75rem', fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '.3rem' }}>Overall Rating</div>
            <span style={{ background: '#fff3f0', color: '#cc3300', fontWeight: '700', padding: '.4rem .9rem', borderRadius: '6px', fontSize: '1rem' }}>
              {eval_.overall_rating}
            </span>
          </div>
        )}
        {eval_.overall_comments && <Field label="Comments" value={eval_.overall_comments} />}
      </Section>

      {(eval_.inspector_signature || eval_.signature_date) && (
        <Section title="Inspector Signature">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <Field label="Signature" value={eval_.inspector_signature} />
            <Field label="Date" value={formatDate(eval_.signature_date)} />
          </div>
        </Section>
      )}

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem' }}>
        <a href={`/api/contractor-eval/pdf/${eval_.id}`} style={btnStyle('#cc3300', 'white')}>Download PDF</a>
        <form action={`/api/delete/contractor-eval/${eval_.id}`} method="POST" style={{ flex: 1 }}>
          <button type="submit" style={{ ...btnStyle('white', '#cc3300'), width: '100%', border: '2px solid #cc3300', cursor: 'pointer' }}>
            Delete Evaluation
          </button>
        </form>
      </div>
    </main>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ background: 'white', borderRadius: '8px', padding: '1.2rem 1.5rem', marginBottom: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div style={{ fontWeight: '800', fontSize: '.95rem', color: '#1a1a1a', marginBottom: '.9rem', paddingBottom: '.5rem', borderBottom: '2px solid #f0f0f0' }}>
        {title.toUpperCase()}
      </div>
      {children}
    </div>
  )
}

function CheckRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.4rem 0', borderBottom: '1px solid #f9f9f9' }}>
      <span style={{ fontSize: '.9rem', color: '#333' }}>{label}</span>
      <YN value={value} />
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div style={{ marginTop: '.75rem' }}>
      <div style={{ fontSize: '.7rem', fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '.2rem' }}>{label}</div>
      <div style={{ fontSize: '.95rem', color: '#1a1a1a' }}>{value || '-'}</div>
    </div>
  )
}

function btnStyle(bg, color) {
  return {
    flex: 1, minWidth: '140px', padding: '.8rem 1rem',
    background: bg, color,
    borderRadius: '6px', textDecoration: 'none',
    fontWeight: '600', fontSize: '.9rem', textAlign: 'center',
    display: 'block'
  }
}
