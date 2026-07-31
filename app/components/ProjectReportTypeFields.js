import { PROJECT_REPORT_TYPE_OPTIONS } from '@/lib/project-report-types'

export default function ProjectReportTypeFields({ settings = {} }) {
  return (
    <div style={{ marginBottom: '1.4rem' }}>
      <div style={{ display: 'block', fontWeight: '600', marginBottom: '.55rem', color: '#333' }}>
        Active Report Types
      </div>
      <p style={{ color: '#666', fontSize: '.9rem', margin: '0 0 .9rem' }}>
        Only enabled report types will appear for this project in project detail screens and report selection flows.
      </p>
      <div style={gridStyle}>
        {PROJECT_REPORT_TYPE_OPTIONS.map(option => (
          <label key={option.key} style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.7rem' }}>
              <input
                type="checkbox"
                name={`report_type_${option.key}`}
                defaultChecked={settings[option.key] !== false}
                style={{ width: '18px', height: '18px' }}
              />
              <div>
                <div style={{ fontWeight: '700', color: '#1a1a1a', fontSize: '.95rem' }}>
                  {option.label}
                </div>
                {option.comingSoon ? (
                  <div style={{ color: '#8a8a8a', fontSize: '.8rem', marginTop: '.2rem' }}>
                    Reserved for a future template.
                  </div>
                ) : null}
              </div>
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}

const gridStyle = {
  display: 'grid',
  gap: '.75rem',
}

const cardStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '.9rem 1rem',
  border: '1px solid #e5e5e5',
  borderRadius: '8px',
  background: '#fafafa',
  cursor: 'pointer',
}
