import Link from 'next/link'

export function FormPage({ children, maxWidth = '1040px' }) {
  return (
    <main style={formPageStyle}>
      <div style={{ ...formShellStyle, maxWidth }}>{children}</div>
    </main>
  )
}

export function FormBackLink({ href, children = 'Back' }) {
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <Link href={href} style={formBackLinkStyle}>
        {children}
      </Link>
    </div>
  )
}

export function FormHero({ eyebrow, title, subtitle, accent = '#cc3300' }) {
  return (
    <div
      style={{
        ...formHeroStyle,
        background: `linear-gradient(135deg, ${accent} 0%, ${shadeHex(accent, -24)} 100%)`,
      }}
    >
      {eyebrow ? <div style={formHeroEyebrowStyle}>{eyebrow}</div> : null}
      <h1 style={formTitleStyle}>{title}</h1>
      {subtitle ? <p style={formSubtitleStyle}>{subtitle}</p> : null}
    </div>
  )
}

export function FormSection({ title, children, action = null }) {
  return (
    <section style={formSectionStyle}>
      <div style={formSectionHeaderRowStyle}>
        <h2 style={formSectionHeaderStyle}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function FormGrid({ children, min = '220px', style }) {
  return (
    <div
      style={{
        ...formGridStyle,
        gridTemplateColumns: `repeat(auto-fit, minmax(${min}, 1fr))`,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function SegmentedChoice({
  name,
  value,
  options,
  onChange,
  allowClear = false,
  activeColor = '#cc3300',
}) {
  return (
    <div style={segmentedWrapStyle}>
      {options.map(option => {
        const active = value === option.value
        return (
          <button
            key={`${name}-${option.value}`}
            type="button"
            onClick={() => onChange(active && allowClear ? '' : option.value)}
            style={{
              ...segmentedButtonStyle,
              borderColor: active ? activeColor : '#d6dde3',
              background: active ? activeColor : '#fff',
              color: active ? '#fff' : '#2a3a45',
            }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function shadeHex(hex, amount) {
  const safe = String(hex || '#cc3300').replace('#', '')
  const normalized = safe.length === 3
    ? safe.split('').map(char => char + char).join('')
    : safe

  const value = Number.parseInt(normalized, 16)
  if (Number.isNaN(value)) return '#9f2500'

  const next = [16, 8, 0]
    .map(shift => {
      const channel = (value >> shift) & 0xff
      return Math.max(0, Math.min(255, channel + amount))
    })

  return `#${next.map(channel => channel.toString(16).padStart(2, '0')).join('')}`
}

export const formPageStyle = {
  minHeight: '100vh',
  display: 'flex',
  justifyContent: 'center',
  padding: '2rem 1rem 4rem',
  background:
    'linear-gradient(180deg, #f6f1ea 0%, #f4f6f8 26%, #eef2f5 100%)',
}

export const formShellStyle = {
  width: '100%',
  background: '#fff',
  borderRadius: '22px',
  padding: '1.25rem',
  boxShadow: '0 20px 50px rgba(22, 35, 45, 0.08)',
  border: '1px solid rgba(23, 42, 58, 0.08)',
}

export const formBackLinkStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '.4rem',
  color: '#b53a0f',
  textDecoration: 'none',
  fontSize: '.92rem',
  fontWeight: '700',
}

export const formHeroStyle = {
  borderRadius: '18px',
  padding: '1.35rem 1.5rem',
  color: '#fff',
  marginBottom: '1.25rem',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
}

export const formHeroEyebrowStyle = {
  fontSize: '.76rem',
  fontWeight: '800',
  letterSpacing: '.12em',
  textTransform: 'uppercase',
  opacity: 0.8,
  marginBottom: '.45rem',
}

export const formTitleStyle = {
  margin: 0,
  fontSize: '1.85rem',
  lineHeight: 1.1,
}

export const formSubtitleStyle = {
  margin: '.45rem 0 0',
  color: 'rgba(255,255,255,0.92)',
  fontSize: '1rem',
  fontWeight: '600',
}

export const formSectionStyle = {
  background: '#fff',
  borderRadius: '18px',
  padding: '1.2rem',
  marginBottom: '1rem',
  border: '1px solid #dfe6eb',
  boxShadow: '0 10px 24px rgba(22, 35, 45, 0.05)',
}

export const formSectionHeaderRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '1rem',
  flexWrap: 'wrap',
  marginBottom: '.95rem',
}

export const formSectionHeaderStyle = {
  margin: 0,
  fontWeight: '800',
  fontSize: '1.04rem',
  color: '#172a3a',
  letterSpacing: '.01em',
}

export const formFieldStyle = {
  marginBottom: '1rem',
  minWidth: 0,
}

export const formGridStyle = {
  display: 'grid',
  gap: '1rem',
  marginBottom: '1rem',
  alignItems: 'start',
}

export const formLabelStyle = {
  display: 'block',
  fontWeight: '700',
  marginBottom: '.42rem',
  color: '#324652',
  fontSize: '.83rem',
  textTransform: 'uppercase',
  letterSpacing: '.04em',
}

export const formInputStyle = {
  width: '100%',
  padding: '.82rem .9rem',
  border: '1px solid #cfd8df',
  borderRadius: '12px',
  fontSize: '1rem',
  boxSizing: 'border-box',
  background: '#fbfcfd',
  color: '#172a3a',
}

export const formTextAreaStyle = {
  ...formInputStyle,
  resize: 'vertical',
  minHeight: '110px',
  lineHeight: '1.55',
}

export const formHintStyle = {
  marginTop: '.4rem',
  fontSize: '.8rem',
  color: '#60717d',
  lineHeight: 1.45,
}

export const formCardStyle = {
  background: '#f7fafc',
  border: '1px solid #dce5eb',
  borderRadius: '16px',
  padding: '1rem',
  marginBottom: '1rem',
}

export const formTimePanelStyle = {
  marginBottom: '1rem',
  padding: '1rem',
  borderRadius: '16px',
  background: '#fff7f1',
  border: '1px solid #efcfbd',
}

export const formTimePanelHeaderStyle = {
  fontSize: '.78rem',
  fontWeight: '800',
  textTransform: 'uppercase',
  letterSpacing: '.1em',
  color: '#9a4d23',
  marginBottom: '.8rem',
}

export const formTimeGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
  gap: '.9rem',
  marginBottom: '.2rem',
}

export const formTimeFieldStyle = {
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
}

export const formTimeControlStyle = {
  display: 'flex',
  gap: '.45rem',
  alignItems: 'stretch',
}

export const formTimeInputStyle = {
  ...formInputStyle,
  flex: 1,
}

export const formDashedAddButtonStyle = {
  width: '100%',
  padding: '.95rem 1rem',
  background: '#f7fafc',
  border: '2px dashed #c9d5dd',
  borderRadius: '14px',
  fontSize: '.98rem',
  fontWeight: '700',
  color: '#506370',
  cursor: 'pointer',
}

export const formSecondaryButtonStyle = {
  padding: '.72rem 1rem',
  background: '#fff',
  border: '1px solid #ced8df',
  borderRadius: '12px',
  fontSize: '.88rem',
  fontWeight: '700',
  color: '#324652',
  cursor: 'pointer',
}

export const formRemoveButtonStyle = {
  ...formSecondaryButtonStyle,
  padding: '.45rem .8rem',
  fontSize: '.8rem',
  color: '#8d3c1d',
  borderColor: '#e5c7b8',
  background: '#fff9f5',
}

export const formSubmitButtonStyle = {
  width: '100%',
  padding: '1rem 1.1rem',
  background: '#cc3300',
  color: '#fff',
  border: 'none',
  borderRadius: '14px',
  fontSize: '1.05rem',
  fontWeight: '800',
  cursor: 'pointer',
  marginTop: '.5rem',
}

export const formInlineNowButtonStyle = {
  minWidth: '58px',
  padding: '.82rem .75rem',
  background: '#fff',
  border: '1px solid #d9b39b',
  borderRadius: '12px',
  fontSize: '.78rem',
  fontWeight: '800',
  color: '#8f4217',
  cursor: 'pointer',
}

export const formStatusButtonBaseStyle = {
  width: '100%',
  padding: '.82rem .95rem',
  border: '2px solid',
  borderRadius: '14px',
  fontSize: '.95rem',
  fontWeight: '800',
  cursor: 'pointer',
}

export const segmentedWrapStyle = {
  display: 'flex',
  gap: '.55rem',
  flexWrap: 'wrap',
}

export const segmentedButtonStyle = {
  padding: '.62rem .95rem',
  borderRadius: '999px',
  border: '1px solid #d6dde3',
  background: '#fff',
  color: '#2a3a45',
  fontWeight: '800',
  fontSize: '.84rem',
  cursor: 'pointer',
}

export const formCheckboxCardStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '.65rem',
  minHeight: '48px',
  border: '1px solid #dce5eb',
  borderRadius: '12px',
  padding: '.82rem .95rem',
  background: '#fbfcfd',
}

export const formTableWrapStyle = {
  overflowX: 'auto',
  border: '1px solid #dce5eb',
  borderRadius: '16px',
}

export const formTableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  minWidth: '620px',
  background: '#fff',
}

export const formTableHeaderStyle = {
  padding: '.8rem .75rem',
  background: '#eef3f6',
  color: '#324652',
  fontSize: '.78rem',
  fontWeight: '800',
  textTransform: 'uppercase',
  letterSpacing: '.06em',
  borderBottom: '1px solid #dce5eb',
  textAlign: 'left',
}

export const formTableCellLabelStyle = {
  padding: '.82rem .75rem',
  borderBottom: '1px solid #ebf0f3',
  color: '#172a3a',
  fontWeight: '700',
  verticalAlign: 'top',
}

export const formTableCellStyle = {
  padding: '.65rem .75rem',
  borderBottom: '1px solid #ebf0f3',
  verticalAlign: 'top',
}

export const formTableInputStyle = {
  ...formInputStyle,
  padding: '.65rem .75rem',
  fontSize: '.94rem',
}
