import { redirect } from 'next/navigation'
import {
  FormBackLink,
  FormGrid,
  FormHero,
  FormPage,
  FormSection,
  formFieldStyle,
  formInputStyle,
  formLabelStyle,
  formSubmitButtonStyle,
  formTextAreaStyle,
} from '@/app/components/FormUi'

const yesNoOptions = [
  { label: 'Yes', value: 'yes' },
  { label: 'No', value: 'no' },
]

const ratingOptions = ['Excellent', 'Good', 'Satisfactory', 'Needs Improvement', 'Unsatisfactory']

export default async function ContractorEvalPage(props) {
  const searchParams = await props.searchParams
  const project_name = searchParams?.project_name || ''
  const project_id = searchParams?.project_id || ''

  if (!project_id) redirect('/select-project?for=contractor-eval')

  return (
    <FormPage maxWidth="900px">
      <FormBackLink href={project_id ? `/projects/${project_id}` : '/'}>
        Back
      </FormBackLink>

      <FormHero
        eyebrow="Contractor Evaluation"
        title="Contractor Evaluation"
        subtitle={project_name || 'Document contractor performance, safety, and compliance.'}
        accent="#17456b"
      />

      <form action="/api/contractor-eval/create" method="POST">
        <input type="hidden" name="project_id" value={project_id} />
        <input type="hidden" name="project_name_hidden" value={project_name} />

        <FormSection title="Inspector Information">
          <FormGrid>
            <Field label="Inspector Name">
              <input name="inspector_name" style={formInputStyle} placeholder="Your name" />
            </Field>
            <Field label="Date">
              <input name="inspection_date" type="date" style={formInputStyle} />
            </Field>
            <Field label="Inspection Location">
              <input name="inspection_location" style={formInputStyle} placeholder="e.g. Site A" />
            </Field>
          </FormGrid>
        </FormSection>

        <FormSection title="Contractor Information">
          <FormGrid>
            <Field label="Contractor Name">
              <input name="contractor_name" style={formInputStyle} placeholder="e.g. ABC Concrete Co." />
            </Field>
            <Field label="Project Name / Number">
              <input name="project_name" style={formInputStyle} defaultValue={project_name} placeholder="e.g. Wichita Substation" />
            </Field>
            <Field label="Supervisor Name">
              <input name="supervisor_name" style={formInputStyle} placeholder="On-site supervisor" />
            </Field>
          </FormGrid>
        </FormSection>

        <EvaluationSection
          title="Safety Compliance"
          items={[
            ['ppe_compliant', 'Are all workers wearing appropriate PPE?'],
            ['safety_signs', 'Are safety signs and barriers in place?'],
            ['emergency_procedures', 'Are emergency procedures clearly communicated and accessible?'],
          ]}
          commentsName="safety_comments"
        />

        <EvaluationSection
          title="Work Quality"
          items={[
            ['work_specs', 'Is the work being performed according to project specifications?'],
            ['materials_quality', 'Are materials and equipment of acceptable quality?'],
            ['workmanship', 'Is the workmanship neat and professional?'],
          ]}
          commentsName="work_quality_comments"
        />

        <EvaluationSection
          title="Timeliness"
          items={[
            ['on_schedule', 'Is the project on schedule?'],
            ['milestones_met', 'Are milestones being met as planned?'],
          ]}
          commentsName="timeliness_comments"
        />

        <EvaluationSection
          title="Communication"
          items={[
            ['contractor_responsive', 'Is the contractor responsive to inquiries and concerns?'],
            ['progress_reports', 'Are progress reports provided regularly?'],
          ]}
          commentsName="communication_comments"
        />

        <EvaluationSection
          title="Compliance with Regulations"
          items={[
            ['regulations_compliant', 'Is the contractor adhering to local, state, and federal regulations?'],
            ['permits_current', 'Are all necessary permits and licenses obtained and up to date?'],
          ]}
          commentsName="compliance_comments"
        />

        <EvaluationSection
          title="Environmental Considerations"
          items={[
            ['env_impact_minimized', 'Is the contractor minimizing environmental impact?'],
            ['waste_disposal', 'Are waste materials disposed of properly?'],
          ]}
          commentsName="environmental_comments"
        />

        <FormSection title="Overall Evaluation">
          <Field label="Overall Performance Rating">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.55rem' }}>
              {ratingOptions.map(rating => (
                <label
                  key={rating}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '.45rem',
                    padding: '.75rem .95rem',
                    border: '1px solid #d6dde3',
                    borderRadius: '999px',
                    background: '#fff',
                    fontWeight: '700',
                    color: '#324652',
                    cursor: 'pointer',
                  }}
                >
                  <input type="radio" name="overall_rating" value={rating} />
                  {rating}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Comments">
            <textarea name="overall_comments" rows={4} style={formTextAreaStyle} />
          </Field>
        </FormSection>

        <FormSection title="Inspector Signature">
          <FormGrid>
            <Field label="Signature (type full name)">
              <input name="inspector_signature" style={formInputStyle} placeholder="Type your full name" />
            </Field>
            <Field label="Date">
              <input name="signature_date" type="date" style={formInputStyle} />
            </Field>
          </FormGrid>
        </FormSection>

        <button type="submit" style={{ ...formSubmitButtonStyle, marginBottom: '2rem', background: '#17456b' }}>
          Submit Evaluation
        </button>
      </form>
    </FormPage>
  )
}

function EvaluationSection({ title, items, commentsName }) {
  return (
    <FormSection title={title}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '.85rem' }}>
        {items.map(([name, question]) => (
          <div
            key={name}
            style={{
              padding: '.95rem 1rem',
              border: '1px solid #dce5eb',
              borderRadius: '14px',
              background: '#f7fafc',
            }}
          >
            <div style={{ fontSize: '.95rem', fontWeight: '700', color: '#172a3a', marginBottom: '.7rem' }}>
              {question}
            </div>
            <HiddenSegmentedChoice name={name} options={yesNoOptions} activeColor="#17456b" />
          </div>
        ))}
      </div>
      <Field label="Comments">
        <textarea name={commentsName} rows={3} style={formTextAreaStyle} />
      </Field>
    </FormSection>
  )
}

function HiddenSegmentedChoice({ name, options, activeColor }) {
  return (
    <div style={{ display: 'flex', gap: '.55rem', flexWrap: 'wrap' }}>
      {options.map(option => (
        <label
          key={`${name}-${option.value}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '.45rem',
            padding: '.7rem .95rem',
            border: `1px solid ${activeColor}`,
            borderRadius: '999px',
            background: '#fff',
            color: '#173244',
            fontWeight: '700',
            cursor: 'pointer',
          }}
        >
          <input type="radio" name={name} value={option.value} />
          {option.label}
        </label>
      ))}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={formFieldStyle}>
      <label style={formLabelStyle}>{label}</label>
      {children}
    </div>
  )
}
