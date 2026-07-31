const STATUS_OPTIONS = ['yes', 'no', 'na']

function optionKey(label) {
  return String(label || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function titleCaseStatus(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'yes') return 'Yes'
  if (normalized === 'no') return 'No'
  if (normalized === 'na') return 'N/A'
  return '-'
}

export const QA_FORM_TYPES = {
  mono_pole_framing: {
    key: 'mono_pole_framing',
    code: 'QA-009',
    title: 'Mono Pole / H-Frame / 3 Pole Framing Report',
    shortLabel: 'Framing',
    accent: '#7a4d18',
    sections: [
      {
        kind: 'fields',
        title: 'Project Information',
        fields: [
          { path: 'project_number', label: 'Project Number', type: 'text' },
          { path: 'work_date', label: 'Date Work Performed', type: 'date', required: true },
          { path: 'owner', label: 'Owner', type: 'text' },
          { path: 'structure_number', label: 'Structure Number', type: 'text' },
          { path: 'contractor', label: 'Contractor/Subcontractor', type: 'text' },
          { path: 'time_started', label: 'Time Started', type: 'time' },
          { path: 'time_ended', label: 'Time Ended', type: 'time' },
          { path: 'wind', label: 'Wind', type: 'text' },
          { path: 'temp', label: 'Temp', type: 'text' },
          { path: 'drawing_spec_number', label: 'Drawing/Spec. Number', type: 'text' },
          { path: 'structure_type', label: 'Structure Type', type: 'text' },
        ],
      },
      {
        kind: 'tri_state_list',
        title: 'Framing Verification Points',
        path: 'verification_items',
        includeRemarks: true,
        items: [
          'Pole Stored on Cribbing',
          'Pole Top and Bottom Match',
          'Pole Top and Bottom Correctly Oriented for Jacking',
          'Correct Jacking Method per Specifications',
          'Minimum and Maximum Jacking Dimensions Marked on Pole Base',
          'Max Allowable Jacking Pressure',
          'Completed Splice Joint with Tolerance Jacking Dimensions',
          'Locking Bar Installed',
          'Insulators Clean',
          'OPGW Hardware Installed',
          'Signage Installed in Correct Direction',
          'Correct Bolt Orientation',
          'Correct Cotter Pin Orientation',
          'Pole Cap Installed',
          'Bolts Tightened Per Specification',
          'Corona Rings in Correct Orientation/Clean',
          'The Above Were Installed per Specification',
        ],
      },
      {
        kind: 'table',
        title: 'Slip Joint Dimensions',
        path: 'slip_joint_dimensions',
        rowLabels: ['Top Joint', 'Middle Joint', 'Bottom Joint'],
        columns: [
          { key: 'min', label: 'Min', type: 'text' },
          { key: 'max', label: 'Max', type: 'text' },
          { key: 'act', label: 'Act', type: 'text' },
        ],
      },
      {
        kind: 'fields',
        title: 'Closeout',
        fields: [
          { path: 'remarks', label: 'Remarks', type: 'textarea' },
          { path: 'submitted_by', label: 'QA Signature / Submitted By', type: 'text', required: true },
          { path: 'signature_date', label: 'Signature Date', type: 'date' },
          { path: 'review_document', label: 'Review Document', type: 'checkbox' },
        ],
      },
    ],
  },
  vibratory_caisson: {
    key: 'vibratory_caisson',
    code: 'QA-010',
    title: 'Vibratory Caisson Report',
    shortLabel: 'Vibratory Caisson',
    accent: '#8f3f2a',
    sections: [
      {
        kind: 'fields',
        title: 'Project Information',
        fields: [
          { path: 'project_number', label: 'Project Number', type: 'text' },
          { path: 'work_date', label: 'Date Work Performed', type: 'date', required: true },
          { path: 'owner', label: 'Owner', type: 'text' },
          { path: 'structure_number', label: 'Structure No.', type: 'text' },
          { path: 'structure_type', label: 'Structure Type', type: 'text' },
          { path: 'contractor', label: 'Contractor/Subcontractor', type: 'text' },
          { path: 'time_started', label: 'Time Started', type: 'time' },
          { path: 'time_ended', label: 'Time Ended', type: 'time' },
          { path: 'wind', label: 'Wind', type: 'text' },
          { path: 'temp', label: 'Temp', type: 'text' },
          { path: 'drawing_spec_number', label: 'Drawing/Spec No.', type: 'text' },
        ],
      },
      {
        kind: 'fields',
        title: 'Equipment',
        fields: [
          { path: 'crane_size_model', label: 'Crane Size & Model No.', type: 'text' },
          { path: 'hammer_size_model', label: 'Hammer Size & Model No.', type: 'text' },
        ],
      },
      {
        kind: 'tri_state_list',
        title: 'Vibration Monitoring in Compliance with Specification(s)',
        path: 'monitoring_checks',
        items: [
          'Offset & Center Pins visible',
          'Transits used to verify orientation of Offset and Center Pins',
          'Embed depth marked clearly on outside of caisson',
          'Proper coating not damaged',
          'Correct diameter & Length',
          'Backfilled to specification both inside and around caisson',
          'Orientation/plumbness as per specification',
          'Above performed according to specification',
          'Picture verification',
        ],
      },
      {
        kind: 'fields',
        title: 'Closeout',
        fields: [
          { path: 'remarks', label: 'Remarks', type: 'textarea' },
          { path: 'submitted_by', label: 'QA Signature / Submitted By', type: 'text', required: true },
          { path: 'signature_date', label: 'Signature Date', type: 'date' },
          { path: 'installation_witnessed', label: 'Installation Witnessed', type: 'checkbox' },
          { path: 'review_document', label: 'Review Document', type: 'checkbox' },
        ],
      },
    ],
  },
  pole_setting: {
    key: 'pole_setting',
    code: 'QA-011',
    title: 'Pole Setting Report (Direct Embed / Foundation)',
    shortLabel: 'Pole Setting',
    accent: '#6b4f2e',
    sections: [
      {
        kind: 'fields',
        title: 'Project Information',
        fields: [
          { path: 'project_number', label: 'Project Number', type: 'text' },
          { path: 'work_date', label: 'Date Work Performed', type: 'date', required: true },
          { path: 'owner', label: 'Owner', type: 'text' },
          { path: 'structure_number', label: 'Structure No.', type: 'text' },
          { path: 'structure_type', label: 'Structure Type', type: 'text' },
          { path: 'contractor', label: 'Contractor/Subcontractor', type: 'text' },
          { path: 'time_started', label: 'Time Started', type: 'time' },
          { path: 'time_ended', label: 'Time Ended', type: 'time' },
          { path: 'weather', label: 'Weather', type: 'text' },
          { path: 'wind', label: 'Wind', type: 'text' },
          { path: 'temp', label: 'Temp', type: 'text' },
          { path: 'drawing_spec_number', label: 'Drawing/Spec No.', type: 'text' },
        ],
      },
      {
        kind: 'checkbox_group',
        title: 'Worksite Conditions',
        path: 'worksite_conditions',
        options: ['Dry', 'Wet', 'Flat', 'Rocky', 'Icy'],
      },
      {
        kind: 'fields',
        title: 'Equipment and Pole Data',
        fields: [
          { path: 'equipment_used_to_set_pole', label: 'Equipment Used to Set Pole', type: 'textarea' },
          { path: 'pole_size_class.pole_a', label: 'Pole A Size / Class', type: 'text' },
          { path: 'pole_size_class.pole_b', label: 'Pole B Size / Class', type: 'text' },
          { path: 'pole_size_class.pole_c', label: 'Pole C Size / Class', type: 'text' },
          { path: 'transit_calibration_date', label: 'Transit Calibration Date', type: 'date' },
          { path: 'transit_serial_number', label: 'Transit Serial #', type: 'text' },
        ],
      },
      {
        kind: 'tri_state_matrix',
        title: 'Installation Checklist',
        path: 'installation_checks',
        columns: ['Pole A', 'Pole B', 'Pole C'],
        rows: [
          'Hole excavated to proper depth',
          'Hole free of water and debris',
          'Pole location verified using center and bisect pins',
          'Centerline, Cant (twist) verified with transit per spec until backfill complete',
          'Embed depth marked on pole for reference point',
          'Pole set plumb or to specified rake',
          'Insulators checked for damage prior to setting',
          'Pole itself including coatings checked for damage prior to setting',
          'Correct backfill material used',
          'Backfill brought up and tamped in lifts per specification',
          'Arm alignment accurate',
          'Anchor bolts / bolted flanges tightened to specified torque',
          'Anchor nuts welded (if required)',
          'Concrete at required strength prior to setting',
        ],
      },
      {
        kind: 'fields',
        title: 'Closeout',
        fields: [
          { path: 'remarks', label: 'Remarks', type: 'textarea' },
          { path: 'submitted_by', label: 'QA Signature / Submitted By', type: 'text', required: true },
          { path: 'signature_date', label: 'Signature Date', type: 'date' },
          { path: 'installation_witnessed', label: 'Installation Witnessed', type: 'checkbox' },
          { path: 'review_document', label: 'Review Document', type: 'checkbox' },
        ],
      },
    ],
  },
  grounding_resistance: {
    key: 'grounding_resistance',
    code: 'QA-013',
    title: 'Structure Grounding and Resistance Measurement Report',
    shortLabel: 'Grounding Resistance',
    accent: '#2a5f66',
    sections: [
      {
        kind: 'fields',
        title: 'Project Information',
        fields: [
          { path: 'project_number', label: 'Project Number', type: 'text' },
          { path: 'work_date', label: 'Date Work Performed', type: 'date', required: true },
          { path: 'owner', label: 'Owner', type: 'text' },
          { path: 'structure_number', label: 'Structure No.', type: 'text' },
          { path: 'structure_type', label: 'Structure Type', type: 'text' },
          { path: 'contractor', label: 'Contractor/Subcontractor', type: 'text' },
          { path: 'time_started', label: 'Time Started', type: 'time' },
          { path: 'time_ended', label: 'Time Ended', type: 'time' },
          { path: 'wind', label: 'Wind', type: 'text' },
          { path: 'temp', label: 'Temp', type: 'text' },
          { path: 'drawing_spec_number', label: 'Drawing/Spec No.', type: 'text' },
        ],
      },
      {
        kind: 'checkbox_group',
        title: 'Soil Conditions',
        path: 'soil_conditions',
        options: ['Dry', 'Wet', 'Moist', 'Very Dry', 'Frozen', 'Thawing'],
      },
      {
        kind: 'checkbox_group',
        title: 'Climate Conditions',
        path: 'climate_conditions',
        options: ['Sunny', 'Overcast', 'Partly Cloudy', 'Rainy'],
      },
      {
        kind: 'fields',
        title: 'Megger',
        fields: [
          { path: 'megger.make', label: 'Megger Make', type: 'text' },
          { path: 'megger.serial_number', label: 'Megger Serial #', type: 'text' },
          { path: 'megger.model', label: 'Megger Model', type: 'text' },
          { path: 'megger.calibration_date', label: 'Megger Calibration Date', type: 'date' },
          { path: 'resistance_specified', label: 'Resistance (OHMS) Specified', type: 'text' },
        ],
      },
      {
        kind: 'table',
        title: 'Resistance Readings',
        path: 'grounding_rows',
        rowCount: 4,
        columns: [
          { key: 'rods_inst_1', label: '# of Rods Inst. (1st)', type: 'text' },
          { key: 'reading_1', label: '1st Reading (OHMS)', type: 'text' },
          { key: 'rods_inst_2', label: '# of Rods Inst. (2nd)', type: 'text' },
          { key: 'reading_2', label: '2nd Reading (OHMS)', type: 'text' },
          { key: 'met_resistance', label: 'Met Resistance Specified', type: 'tri_state_simple' },
          { key: 'remarks', label: 'Remarks', type: 'text' },
        ],
      },
      {
        kind: 'fields',
        title: 'Closeout',
        fields: [
          { path: 'picture_verification_taken', label: 'Picture verification of acceptable resistance reading taken', type: 'checkbox' },
          { path: 'grounding_installed_per_spec', label: 'Grounding installed per Specification', type: 'checkbox' },
          { path: 'remarks', label: 'Remarks', type: 'textarea' },
          { path: 'submitted_by', label: 'QA Signature / Submitted By', type: 'text', required: true },
          { path: 'signature_date', label: 'Signature Date', type: 'date' },
          { path: 'installation_witnessed', label: 'Installation Witnessed', type: 'checkbox' },
          { path: 'review_document', label: 'Review Document', type: 'checkbox' },
        ],
      },
    ],
  },
}

export const QA_FORM_TYPE_OPTIONS = Object.values(QA_FORM_TYPES)

function getInitialValueForField(field) {
  if (field.type === 'checkbox') return false
  return ''
}

function setByPath(target, path, value) {
  const parts = String(path || '').split('.').filter(Boolean)
  if (!parts.length) return

  let cursor = target
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index]
    if (typeof cursor[part] !== 'object' || cursor[part] === null || Array.isArray(cursor[part])) {
      cursor[part] = {}
    }
    cursor = cursor[part]
  }

  cursor[parts[parts.length - 1]] = value
}

export function getByPath(source, path, fallback = '') {
  const parts = String(path || '').split('.').filter(Boolean)
  let cursor = source

  for (const part of parts) {
    if (cursor == null || typeof cursor !== 'object' || !(part in cursor)) {
      return fallback
    }
    cursor = cursor[part]
  }

  return cursor == null ? fallback : cursor
}

export function getQaFormDefinition(formType) {
  return QA_FORM_TYPES[formType] || null
}

export function getQaFormTypeMeta(formType) {
  return getQaFormDefinition(formType) || {
    key: formType,
    code: 'QA',
    title: 'QA Form',
    shortLabel: 'QA Form',
    accent: '#24506d',
    sections: [],
  }
}

export function createEmptyQaFormData(formType) {
  const definition = getQaFormDefinition(formType)
  if (!definition) return {}

  const data = {}

  for (const section of definition.sections) {
    if (section.kind === 'fields') {
      for (const field of section.fields) {
        setByPath(data, field.path, getInitialValueForField(field))
      }
      continue
    }

    if (section.kind === 'checkbox_group') {
      const group = {}
      for (const label of section.options) {
        group[optionKey(label)] = false
      }
      setByPath(data, section.path, group)
      continue
    }

    if (section.kind === 'tri_state_list') {
      const list = {}
      for (const label of section.items) {
        list[optionKey(label)] = section.includeRemarks
          ? { status: '', remarks: '' }
          : { status: '' }
      }
      setByPath(data, section.path, list)
      continue
    }

    if (section.kind === 'tri_state_matrix') {
      const matrix = {}
      for (const rowLabel of section.rows) {
        matrix[optionKey(rowLabel)] = {}
        for (const columnLabel of section.columns) {
          matrix[optionKey(rowLabel)][optionKey(columnLabel)] = ''
        }
      }
      setByPath(data, section.path, matrix)
      continue
    }

    if (section.kind === 'table') {
      const rows = []
      const rowCount = section.rowLabels?.length || section.rowCount || 0
      for (let index = 0; index < rowCount; index += 1) {
        const row = {}
        for (const column of section.columns) {
          row[column.key] = column.type === 'checkbox' ? false : ''
        }
        rows.push(row)
      }
      setByPath(data, section.path, rows)
    }
  }

  return data
}

export function normalizeQaFormRecord(record) {
  if (!record) return null

  return {
    ...record,
    photo_urls: Array.isArray(record.photo_urls) ? record.photo_urls : [],
    photo_labels: Array.isArray(record.photo_labels) ? record.photo_labels : [],
    form_data: {
      ...createEmptyQaFormData(record.form_type),
      ...(record.form_data || {}),
    },
  }
}

export function formatCheckboxGroupValue(group = {}) {
  return Object.entries(group)
    .filter(([, checked]) => Boolean(checked))
    .map(([key]) => key.replace(/_/g, ' '))
    .map(value => value.replace(/\b\w/g, char => char.toUpperCase()))
    .join(', ') || '-'
}

export function buildQaFormDisplaySections(record) {
  const normalized = normalizeQaFormRecord(record)
  if (!normalized) return []

  const definition = getQaFormDefinition(normalized.form_type)
  if (!definition) return []

  const sections = []

  for (const section of definition.sections) {
    if (section.kind === 'fields') {
      sections.push({
        title: section.title,
        kind: 'pairs',
        rows: section.fields.map(field => ({
          label: field.label,
          value:
            field.type === 'checkbox'
              ? getByPath(normalized.form_data, field.path, false) ? 'Yes' : 'No'
              : getByPath(normalized.form_data, field.path, ''),
        })),
      })
      continue
    }

    if (section.kind === 'checkbox_group') {
      sections.push({
        title: section.title,
        kind: 'pairs',
        rows: [{ label: section.title, value: formatCheckboxGroupValue(getByPath(normalized.form_data, section.path, {})) }],
      })
      continue
    }

    if (section.kind === 'tri_state_list') {
      const group = getByPath(normalized.form_data, section.path, {})
      sections.push({
        title: section.title,
        kind: 'tri_state_list',
        items: section.items.map(label => {
          const item = group[optionKey(label)] || {}
          return {
            label,
            status: titleCaseStatus(item.status),
            remarks: item.remarks || '',
          }
        }),
      })
      continue
    }

    if (section.kind === 'tri_state_matrix') {
      const matrix = getByPath(normalized.form_data, section.path, {})
      sections.push({
        title: section.title,
        kind: 'matrix',
        columns: section.columns,
        rows: section.rows.map(label => ({
          label,
          values: section.columns.map(columnLabel => {
            const row = matrix[optionKey(label)] || {}
            return titleCaseStatus(row[optionKey(columnLabel)])
          }),
        })),
      })
      continue
    }

    if (section.kind === 'table') {
      const tableRows = getByPath(normalized.form_data, section.path, [])
      sections.push({
        title: section.title,
        kind: 'table',
        columns: section.rowLabels ? [{ key: '_row', label: '' }, ...section.columns] : section.columns,
        rows: tableRows.map((row, index) => {
          const nextRow = {}
          if (section.rowLabels) {
            nextRow._row = section.rowLabels[index] || `Row ${index + 1}`
          }
          for (const column of section.columns) {
            nextRow[column.key] =
              column.type === 'tri_state_simple'
                ? titleCaseStatus(row?.[column.key])
                : row?.[column.key] || '-'
          }
          return nextRow
        }),
      })
    }
  }

  return sections
}

export function getQaFormSummary(record) {
  const meta = getQaFormTypeMeta(record?.form_type)
  return {
    title: meta.title,
    shortLabel: meta.shortLabel,
    code: meta.code,
    accent: meta.accent,
  }
}

export function validateQaFormPayload(payload) {
  const definition = getQaFormDefinition(payload?.form_type)
  if (!definition) {
    return 'Choose a valid QA form type.'
  }

  if (!String(payload?.project_name || '').trim()) {
    return 'Project name is required.'
  }

  const formData = payload?.form_data || {}

  for (const section of definition.sections) {
    if (section.kind !== 'fields') continue
    for (const field of section.fields) {
      if (!field.required) continue
      const value = getByPath(formData, field.path, field.type === 'checkbox' ? false : '')
      if (field.type === 'checkbox') {
        if (!value) return `${field.label} is required.`
      } else if (!String(value || '').trim()) {
        return `${field.label} is required.`
      }
    }
  }

  return null
}

export { STATUS_OPTIONS, optionKey, titleCaseStatus }
