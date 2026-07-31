'use client'

import { useMemo, useRef } from 'react'
import { usePathname } from 'next/navigation'

export default function OrganizationSwitcher({
  memberships = [],
  currentOrganizationId = '',
  hasExplicitSelection = false,
}) {
  const formRef = useRef(null)
  const pathname = usePathname()

  const options = useMemo(() => (
    memberships.map(membership => ({
      id: membership.organization_id,
      label: membership.organization_name || 'Organization',
      role: membership.access_role || membership.role || 'viewer',
    }))
  ), [memberships])

  if (options.length === 0) return null

  return (
    <div style={wrapperStyle}>
      <form ref={formRef} action="/api/organizations/switch" method="POST" style={formStyle}>
        <input type="hidden" name="next" value={pathname || '/'} />
        <label style={labelStyle}>
          Organization
          <select
            name="organization_id"
            defaultValue={hasExplicitSelection ? currentOrganizationId : ''}
            onChange={() => formRef.current?.submit()}
            style={selectStyle}
          >
            {options.length > 1 && (
              <option value="">All Organizations</option>
            )}
            {options.map(option => (
              <option key={option.id} value={option.id}>
                {option.label} · {option.role}
              </option>
            ))}
          </select>
        </label>
      </form>
    </div>
  )
}

const wrapperStyle = {
  background: '#fff6f1',
  borderBottom: '1px solid #f1ddd2',
  padding: '.7rem 1rem',
}

const formStyle = {
  maxWidth: '1100px',
  margin: '0 auto',
  display: 'flex',
  justifyContent: 'flex-end',
}

const labelStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '.65rem',
  color: '#5b3a2e',
  fontSize: '.92rem',
  fontWeight: '700',
}

const selectStyle = {
  minWidth: '240px',
  borderRadius: '8px',
  border: '1px solid #dfc3b7',
  background: 'white',
  padding: '.55rem .75rem',
  color: '#2b2b2b',
  fontSize: '.92rem',
  fontWeight: '600',
}
