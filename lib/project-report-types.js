import { isMissingRelationError } from '@/lib/supabase-errors'
import { QA_FORM_TYPE_OPTIONS } from '@/lib/qa-forms'

export const PROJECT_REPORT_TYPE_OPTIONS = [
  { key: 'daily_report', label: 'Daily Report', accent: '#cc3300' },
  { key: 'pour_log', label: 'Pour Log', accent: '#1a1a1a' },
  { key: 'qa_009', label: 'QA-009 Framing', accent: '#7a4d18' },
  { key: 'qa_010', label: 'QA-010 Vibratory Caisson', accent: '#8f3f2a' },
  { key: 'qa_011', label: 'QA-011 Pole Setting', accent: '#6b4f2e' },
  { key: 'qa_012', label: 'QA-012', accent: '#4f5660', comingSoon: true },
  { key: 'qa_013', label: 'QA-013 Grounding Resistance', accent: '#2a5f66' },
  { key: 'contractor_evaluation', label: 'Contractor Evaluation', accent: '#2a7a2a' },
]

export const DEFAULT_PROJECT_REPORT_TYPE_SETTINGS = Object.fromEntries(
  PROJECT_REPORT_TYPE_OPTIONS.map(option => [option.key, true])
)

const QA_FORM_TYPE_BY_REPORT_TYPE = {
  qa_009: 'mono_pole_framing',
  qa_010: 'vibratory_caisson',
  qa_011: 'pole_setting',
  qa_013: 'grounding_resistance',
}

const REPORT_TYPE_BY_QA_FORM_TYPE = Object.fromEntries(
  Object.entries(QA_FORM_TYPE_BY_REPORT_TYPE).map(([reportType, formType]) => [formType, reportType])
)

export function getProjectReportTypeSettingsFromRows(rows = []) {
  const settings = { ...DEFAULT_PROJECT_REPORT_TYPE_SETTINGS }

  for (const row of rows) {
    const key = String(row?.report_type || '').trim()
    if (key && key in settings) {
      settings[key] = row.enabled !== false
    }
  }

  return settings
}

export function isProjectReportTypeEnabled(settings, reportType) {
  if (!reportType) return false
  if (!settings) return true
  return settings[reportType] !== false
}

export function getEnabledQaFormTypes(settings) {
  return QA_FORM_TYPE_OPTIONS.filter(option =>
    isProjectReportTypeEnabled(settings, REPORT_TYPE_BY_QA_FORM_TYPE[option.key])
  )
}

export function getProjectReportTypeForQaForm(formType) {
  return REPORT_TYPE_BY_QA_FORM_TYPE[formType] || null
}

export async function getProjectReportTypeRowsByProjectIds(supabase, projectIds = []) {
  const ids = [...new Set((projectIds || []).filter(Boolean))]
  if (ids.length === 0) return []

  const { data, error } = await supabase
    .from('project_report_types')
    .select('project_id, report_type, enabled')
    .in('project_id', ids)

  if (error) {
    if (isMissingRelationError(error)) return []
    throw error
  }

  return data || []
}

export async function getProjectReportTypeSettings(supabase, projectId) {
  if (!projectId) return { ...DEFAULT_PROJECT_REPORT_TYPE_SETTINGS }

  const rows = await getProjectReportTypeRowsByProjectIds(supabase, [projectId])
  return getProjectReportTypeSettingsFromRows(rows)
}

export async function getProjectReportTypeSettingsMap(supabase, projectIds = []) {
  const ids = [...new Set((projectIds || []).filter(Boolean))]
  const rows = await getProjectReportTypeRowsByProjectIds(supabase, ids)

  const grouped = new Map()
  for (const id of ids) {
    grouped.set(id, [])
  }

  for (const row of rows) {
    if (!grouped.has(row.project_id)) {
      grouped.set(row.project_id, [])
    }
    grouped.get(row.project_id).push(row)
  }

  return Object.fromEntries(
    ids.map(id => [id, getProjectReportTypeSettingsFromRows(grouped.get(id) || [])])
  )
}

export function parseProjectReportTypeSettings(formData) {
  return Object.fromEntries(
    PROJECT_REPORT_TYPE_OPTIONS.map(option => [
      option.key,
      formData.get(`report_type_${option.key}`) === 'on',
    ])
  )
}

export async function saveProjectReportTypeSettings(supabase, projectId, settings) {
  if (!projectId || !settings) return

  const payload = PROJECT_REPORT_TYPE_OPTIONS.map(option => ({
    project_id: projectId,
    report_type: option.key,
    enabled: settings[option.key] !== false,
  }))

  const { error } = await supabase
    .from('project_report_types')
    .upsert(payload, { onConflict: 'project_id,report_type' })

  if (error) {
    if (isMissingRelationError(error)) return
    throw error
  }
}
