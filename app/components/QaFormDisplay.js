import { buildQaFormDisplaySections } from '@/lib/qa-forms'

export default function QaFormDisplay({ record }) {
  const sections = buildQaFormDisplaySections(record)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {sections.map(section => (
        <div key={section.title} style={sectionCardStyle}>
          <h2 style={sectionTitleStyle}>{section.title}</h2>

          {section.kind === 'pairs' ? (
            <div style={pairsGridStyle}>
              {section.rows.map(row => (
                <div key={row.label} style={{ marginBottom: '.85rem' }}>
                  <div style={labelStyle}>{row.label}</div>
                  <div style={valueStyle}>{row.value || '-'}</div>
                </div>
              ))}
            </div>
          ) : null}

          {section.kind === 'tri_state_list' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.8rem' }}>
              {section.items.map(item => (
                <div key={item.label} style={itemCardStyle}>
                  <div style={{ fontWeight: 700, color: '#1a1a1a', marginBottom: '.3rem' }}>{item.label}</div>
                  <div style={{ color: '#24506d', fontWeight: 600 }}>{item.status}</div>
                  {item.remarks ? <div style={{ color: '#555', marginTop: '.4rem', lineHeight: '1.45' }}>{item.remarks}</div> : null}
                </div>
              ))}
            </div>
          ) : null}

          {section.kind === 'matrix' ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={tableHeaderStyle}>Item</th>
                    {section.columns.map(column => (
                      <th key={column} style={tableHeaderStyle}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section.rows.map(row => (
                    <tr key={row.label}>
                      <td style={tableCellLabelStyle}>{row.label}</td>
                      {row.values.map((value, index) => (
                        <td key={`${row.label}-${index}`} style={tableCellStyle}>{value}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {section.kind === 'table' ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    {section.columns.map(column => (
                      <th key={column.key} style={tableHeaderStyle}>{column.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section.rows.map((row, index) => (
                    <tr key={index}>
                      {section.columns.map(column => (
                        <td key={column.key} style={column.key === '_row' ? tableCellLabelStyle : tableCellStyle}>
                          {row[column.key] || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

const sectionCardStyle = {
  background: 'white',
  border: '1px solid #e5eaee',
  borderRadius: '10px',
  padding: '1.25rem',
}

const sectionTitleStyle = {
  margin: '0 0 1rem',
  color: '#1a1a1a',
  fontSize: '1.1rem',
}

const pairsGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '1rem',
}

const labelStyle = {
  fontSize: '.74rem',
  fontWeight: 700,
  color: '#7a8894',
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  marginBottom: '.25rem',
}

const valueStyle = {
  fontSize: '.98rem',
  color: '#1a1a1a',
  lineHeight: '1.5',
  whiteSpace: 'pre-wrap',
}

const itemCardStyle = {
  border: '1px solid #e8edf1',
  borderRadius: '8px',
  padding: '1rem',
  background: '#fbfcfd',
}

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
}

const tableHeaderStyle = {
  padding: '.7rem',
  border: '1px solid #d8dfe5',
  background: '#f4f7f9',
  textAlign: 'left',
  fontSize: '.84rem',
  color: '#1a1a1a',
}

const tableCellStyle = {
  padding: '.7rem',
  border: '1px solid #e0e6eb',
  color: '#1a1a1a',
  fontSize: '.92rem',
  verticalAlign: 'top',
}

const tableCellLabelStyle = {
  ...tableCellStyle,
  fontWeight: 700,
}
