'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  FormBackLink,
  FormHero,
  FormPage,
  formCheckboxCardStyle as checkboxOptionStyle,
  formFieldStyle as fieldStyle,
  formInputStyle as inputStyle,
  formLabelStyle as labelStyle,
  formSecondaryButtonStyle as smallButtonStyle,
  formSectionStyle as sectionCardStyle,
  formSubmitButtonStyle as submitButtonStyle,
  formTableCellLabelStyle as tableCellLabelStyle,
  formTableCellStyle as tableCellStyle,
  formTableHeaderStyle as tableHeaderStyle,
  formTableInputStyle as tableInputStyle,
  formTableStyle as tableStyle,
  formTableWrapStyle as tableWrapStyle,
  segmentedButtonStyle,
} from '@/app/components/FormUi'
import {
  STATUS_OPTIONS,
  createEmptyQaFormData,
  getByPath,
  getQaFormDefinition,
  getQaFormTypeMeta,
  optionKey,
  validateQaFormPayload,
} from '@/lib/qa-forms'
import { preparePhotoFileForUpload } from '@/lib/client-photo-upload'

function cloneWithPath(source, path, value) {
  const next = Array.isArray(source) ? [...source] : { ...source }
  const parts = String(path || '').split('.').filter(Boolean)
  if (!parts.length) return next

  let cursor = next
  let original = source

  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index]
    const originalChild = original && typeof original === 'object' ? original[part] : undefined
    const child = Array.isArray(originalChild)
      ? [...originalChild]
      : (originalChild && typeof originalChild === 'object')
        ? { ...originalChild }
        : {}
    cursor[part] = child
    cursor = child
    original = originalChild
  }

  cursor[parts[parts.length - 1]] = value
  return next
}

function titleCaseStatus(value) {
  if (value === 'yes') return 'Yes'
  if (value === 'no') return 'No'
  if (value === 'na') return 'N/A'
  return 'Not Set'
}

async function uploadQaPhotos(photoEntries, fileRefs, projectId = '') {
  const uploadEntries = []

  for (const entry of photoEntries) {
    const fileInput = fileRefs.current[entry.id]
    const file = fileInput?.files?.[0]
    if (!file) continue

    const prepared = await preparePhotoFileForUpload(file)
    uploadEntries.push({
      file: prepared,
      label: entry.label || '',
    })
  }

  if (uploadEntries.length === 0) {
    return { urls: [], labels: [] }
  }

  const formData = new FormData()
  formData.append('folder', 'qa-forms')
  if (projectId) formData.append('project_id', projectId)
  uploadEntries.forEach(entry => {
    formData.append('files', entry.file)
  })

  const response = await fetch('/api/upload-photos', {
    method: 'POST',
    body: formData,
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    const errors = Array.isArray(payload?.errors) ? payload.errors.join('\n') : ''
    throw new Error(errors || payload?.error || 'Photo upload failed.')
  }

  const urls = Array.isArray(payload?.urls) ? payload.urls : []
  if (urls.length !== uploadEntries.length) {
    throw new Error('Some QA form photos did not finish uploading.')
  }

  return {
    urls,
    labels: uploadEntries.map(entry => entry.label),
  }
}

export default function QaFormEditor({
  mode = 'create',
  initialRecord = null,
  projectId = '',
  projectName = '',
  formType = '',
}) {
  const router = useRouter()
  const record = initialRecord || null
  const effectiveType = record?.form_type || formType
  const meta = getQaFormTypeMeta(effectiveType)
  const definition = getQaFormDefinition(effectiveType)
  const [currentProjectName, setCurrentProjectName] = useState(record?.project_name || projectName || '')
  const [formData, setFormData] = useState(record?.form_data || createEmptyQaFormData(effectiveType))
  const [existingPhotos] = useState(
    (record?.photo_urls || []).map((url, index) => ({
      url,
      label: record?.photo_labels?.[index] || '',
    }))
  )
  const [photoEntries, setPhotoEntries] = useState([{ id: 1, label: '' }])
  const [saving, setSaving] = useState(false)
  const fileRefs = useRef({})
  const nextPhotoId = useRef(2)

  if (!definition) {
    return (
      <main style={{ maxWidth: '780px', margin: '0 auto', padding: '2rem', color: '#7a1212' }}>
        Unknown QA form type.
      </main>
    )
  }

  function updateField(path, value) {
    setFormData(prev => cloneWithPath(prev, path, value))
  }

  function addPhotoEntry() {
    const id = nextPhotoId.current++
    setPhotoEntries(prev => [...prev, { id, label: '' }])
  }

  function removePhotoEntry(id) {
    setPhotoEntries(prev => prev.filter(entry => entry.id !== id))
    delete fileRefs.current[id]
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (saving) return

    const payload = {
      id: record?.id || null,
      project_id: record?.project_id || projectId || null,
      project_name: currentProjectName,
      form_type: effectiveType,
      form_data: formData,
      work_date: getByPath(formData, 'work_date', '') || null,
      submitted_by: getByPath(formData, 'submitted_by', '') || null,
      photo_urls: existingPhotos.map(photo => photo.url),
      photo_labels: existingPhotos.map(photo => photo.label),
    }

    const validationError = validateQaFormPayload(payload)
    if (validationError) {
      window.alert(validationError)
      return
    }

    setSaving(true)

    try {
      const uploaded = await uploadQaPhotos(photoEntries, fileRefs, record?.project_id || projectId)
      payload.photo_urls = [...payload.photo_urls, ...uploaded.urls]
      payload.photo_labels = [...payload.photo_labels, ...uploaded.labels]

      const endpoint = mode === 'edit'
        ? `/api/qa-form/update/${record.id}`
        : '/api/qa-form/create'

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(result?.error || 'Could not save the QA form.')
      }

      router.push(`/qa-forms/${result.id}`)
    } catch (error) {
      window.alert(error.message || 'Could not save the QA form.')
      setSaving(false)
    }
  }

  return (
    <FormPage maxWidth="980px">
      <FormBackLink href={mode === 'edit' ? `/qa-forms/${record.id}` : `/projects/${projectId}`}>
        Back
      </FormBackLink>

      <FormHero
        eyebrow={meta.code}
        title={`${mode === 'edit' ? 'Edit ' : 'New '}${meta.title}`}
        subtitle={currentProjectName || 'Complete the QA checklist and attach supporting photos.'}
        accent={meta.accent}
      />

        <form onSubmit={handleSubmit}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Project Name</label>
            <input
              value={currentProjectName}
              onChange={event => setCurrentProjectName(event.target.value)}
              style={inputStyle}
              required
            />
          </div>

          {definition.sections.map(section => (
            <div key={section.title} style={sectionCardStyle}>
              <h2 style={sectionTitleStyle}>{section.title}</h2>
              {section.kind === 'fields' ? (
                <div style={gridStyle}>
                  {section.fields.map(field => (
                    <FieldInput
                      key={field.path}
                      field={field}
                      value={getByPath(formData, field.path, field.type === 'checkbox' ? false : '')}
                      onChange={value => updateField(field.path, value)}
                    />
                  ))}
                </div>
              ) : null}

              {section.kind === 'checkbox_group' ? (
                <div style={checkboxGroupStyle}>
                  {section.options.map(label => {
                    const key = optionKey(label)
                    const checked = Boolean(getByPath(formData, `${section.path}.${key}`, false))
                    return (
                      <label key={key} style={checkboxOptionStyle}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={event => updateField(`${section.path}.${key}`, event.target.checked)}
                        />
                        <span>{label}</span>
                      </label>
                    )
                  })}
                </div>
              ) : null}

              {section.kind === 'tri_state_list' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {section.items.map(label => {
                    const key = optionKey(label)
                    const value = getByPath(formData, `${section.path}.${key}`, { status: '', remarks: '' })
                    return (
                      <div key={key} style={triStateItemCardStyle}>
                        <div style={{ fontWeight: 600, color: '#1a1a1a', marginBottom: '.55rem' }}>{label}</div>
                        <StatusButtons
                          value={value.status || ''}
                          onChange={status => updateField(`${section.path}.${key}.status`, status)}
                        />
                        {section.includeRemarks ? (
                          <textarea
                            rows={2}
                            value={value.remarks || ''}
                            onChange={event => updateField(`${section.path}.${key}.remarks`, event.target.value)}
                            placeholder="Remarks"
                            style={{ ...inputStyle, marginTop: '.7rem', resize: 'vertical' }}
                          />
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              ) : null}

              {section.kind === 'tri_state_matrix' ? (
                <div style={tableWrapStyle}>
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
                      {section.rows.map(rowLabel => {
                        const rowKey = optionKey(rowLabel)
                        return (
                          <tr key={rowKey}>
                            <td style={tableCellLabelStyle}>{rowLabel}</td>
                            {section.columns.map(column => {
                              const columnKey = optionKey(column)
                              const value = getByPath(formData, `${section.path}.${rowKey}.${columnKey}`, '')
                              return (
                                <td key={columnKey} style={tableCellStyle}>
                                  <select
                                    value={value}
                                    onChange={event => updateField(`${section.path}.${rowKey}.${columnKey}`, event.target.value)}
                                    style={selectStyle}
                                  >
                                    <option value="">-</option>
                                    {STATUS_OPTIONS.map(status => (
                                      <option key={status} value={status}>{titleCaseStatus(status)}</option>
                                    ))}
                                  </select>
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {section.kind === 'table' ? (
                <div style={tableWrapStyle}>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        {section.rowLabels ? <th style={tableHeaderStyle}>Item</th> : null}
                        {section.columns.map(column => (
                          <th key={column.key} style={tableHeaderStyle}>{column.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {getByPath(formData, section.path, []).map((row, index) => (
                        <tr key={index}>
                          {section.rowLabels ? <td style={tableCellLabelStyle}>{section.rowLabels[index]}</td> : null}
                          {section.columns.map(column => (
                            <td key={column.key} style={tableCellStyle}>
                              {column.type === 'tri_state_simple' ? (
                                <select
                                  value={row?.[column.key] || ''}
                                  onChange={event => {
                                    const nextRows = [...getByPath(formData, section.path, [])]
                                    nextRows[index] = { ...nextRows[index], [column.key]: event.target.value }
                                    updateField(section.path, nextRows)
                                  }}
                                  style={selectStyle}
                                >
                                  <option value="">-</option>
                                  {STATUS_OPTIONS.map(status => (
                                    <option key={status} value={status}>{titleCaseStatus(status)}</option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  value={row?.[column.key] || ''}
                                  onChange={event => {
                                    const nextRows = [...getByPath(formData, section.path, [])]
                                    nextRows[index] = { ...nextRows[index], [column.key]: event.target.value }
                                    updateField(section.path, nextRows)
                                  }}
                                  style={tableInputStyle}
                                />
                              )}
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

          {existingPhotos.length ? (
            <div style={sectionCardStyle}>
              <h2 style={sectionTitleStyle}>Existing Photos</h2>
              <div style={photoGridStyle}>
                {existingPhotos.map((photo, index) => (
                  <div key={`${photo.url}-${index}`}>
                    <img src={photo.url} alt={photo.label || `Photo ${index + 1}`} style={photoStyle} />
                    {photo.label ? <div style={photoLabelStyle}>{photo.label}</div> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div style={sectionCardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <h2 style={sectionTitleStyle}>Add Photos</h2>
              <button type="button" onClick={addPhotoEntry} style={smallButtonStyle}>+ Add Photo</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {photoEntries.map(entry => (
                <div key={entry.id} style={triStateItemCardStyle}>
                  <input
                    ref={element => {
                      fileRefs.current[entry.id] = element
                    }}
                    type="file"
                    accept="image/*"
                    style={inputStyle}
                  />
                  <input
                    value={entry.label}
                    onChange={event => {
                      setPhotoEntries(prev => prev.map(item => item.id === entry.id ? { ...item, label: event.target.value } : item))
                    }}
                    placeholder="Photo label"
                    style={{ ...inputStyle, marginTop: '.7rem' }}
                  />
                  {photoEntries.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removePhotoEntry(entry.id)}
                      style={{ ...smallButtonStyle, marginTop: '.7rem', background: '#fff3f0', color: '#cc3300', border: '1px solid #efc8bb' }}
                    >
                      Remove Photo
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <button type="submit" disabled={saving} style={submitButtonStyle}>
            {saving ? 'Saving QA Form...' : mode === 'edit' ? 'Save Changes' : 'Create QA Form'}
          </button>
        </form>
    </FormPage>
  )
}

function FieldInput({ field, value, onChange }) {
  if (field.type === 'textarea') {
    return (
      <div style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
        <label style={labelStyle}>{field.label}</label>
        <textarea rows={4} value={value || ''} onChange={event => onChange(event.target.value)} style={{ ...inputStyle, resize: 'vertical', minHeight: '120px' }} />
      </div>
    )
  }

  if (field.type === 'checkbox') {
    return (
      <label style={checkboxOptionStyle}>
        <input type="checkbox" checked={Boolean(value)} onChange={event => onChange(event.target.checked)} />
        <span>{field.label}</span>
      </label>
    )
  }

  return (
    <div style={fieldStyle}>
      <label style={labelStyle}>{field.label}</label>
      <input
        type={field.type === 'date' || field.type === 'time' ? field.type : 'text'}
        value={value || ''}
        onChange={event => onChange(event.target.value)}
        style={inputStyle}
      />
    </div>
  )
}

function StatusButtons({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '.45rem', flexWrap: 'wrap' }}>
      {STATUS_OPTIONS.map(status => {
        const active = value === status
        return (
          <button
            key={status}
            type="button"
            onClick={() => onChange(active ? '' : status)}
            style={{
              ...segmentedButtonStyle,
              border: active ? '1px solid #24506d' : '1px solid #d8dfe5',
              background: active ? '#24506d' : 'white',
              color: active ? 'white' : '#24506d',
            }}
          >
            {titleCaseStatus(status)}
          </button>
        )
      })}
    </div>
  )
}

const selectStyle = {
  ...inputStyle,
  minWidth: '96px',
}

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '1rem',
}

const sectionTitleStyle = {
  margin: '0 0 1rem',
  color: '#172a3a',
  fontSize: '1.03rem',
}

const checkboxGroupStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '.75rem',
}

const triStateItemCardStyle = {
  border: '1px solid #dce5eb',
  borderRadius: '14px',
  padding: '1rem',
  background: '#f7fafc',
}

const photoGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: '.85rem',
}

const photoStyle = {
  width: '100%',
  height: '140px',
  objectFit: 'cover',
  borderRadius: '8px',
  display: 'block',
}

const photoLabelStyle = {
  fontSize: '.8rem',
  color: '#555',
  marginTop: '.35rem',
  lineHeight: '1.35',
}
