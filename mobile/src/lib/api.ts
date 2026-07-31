import type { Session } from '@supabase/supabase-js'

export type UploadPhotoFile = {
  uri: string
  name: string
  type: string
}

export type MobileSettings = {
  company_name: string
  logo_url: string
}

export type ProjectSummary = {
  id: string
  project_name: string
  location: string | null
  address: string | null
  client_name: string | null
  status: string | null
  start_date: string | null
  created_at: string | null
  today_daily_report_status?: 'submitted' | 'missing' | 'inactive' | null
}

export type SubmissionDashboardSummary = {
  submitted: number
  missing: number
  inactive: number
}

export type DailyReportSummary = {
  id: string
  report_date: string | null
  submitted_by: string | null
  crew_count: number | null
}

export type PourLogSummary = {
  id: string
  log_date: string | null
  log_type: string | null
  submitted_by: string | null
}

export type ContractorEvalSummary = {
  id: string
  inspection_date: string | null
  contractor_name: string | null
  inspector_name: string | null
  overall_rating: string | null
}

export type QaFormSummary = {
  id: string
  work_date: string | null
  form_type: string | null
  submitted_by: string | null
}

export type ProjectDetail = {
  project: {
    id: string
    project_name: string
    location: string | null
    address: string | null
    client_name: string | null
    client_email: string | null
    status: string | null
    start_date: string | null
    notes: string | null
  }
  report_type_settings?: Record<string, boolean>
  reports: DailyReportSummary[]
  pour_logs: PourLogSummary[]
  contractor_evaluations: ContractorEvalSummary[]
  qa_forms: QaFormSummary[]
  qa_forms_available?: boolean
  qa_forms_unavailable_reason?: string | null
}

export type ReportDetail = {
  id: string
  project_id: string | null
  project_name: string | null
  report_date: string | null
  submitted_by: string | null
  crew_count: number | null
  weather: string | null
  weather_delay: boolean | null
  weather_delay_hours: string | number | null
  on_schedule: boolean | null
  work_completed: string | null
  equipment_used: string | null
  safety_issues: string | null
  photo_urls: string[] | null
  photo_labels: string[] | null
}

export type PourLogFoundation = {
  id?: string
  foundation_id: string | null
  total_depth: string | null
  actual_hole_depth: string | null
  estimated_yards: string | number | null
  shaft_diameter: string | null
  anchor_bolt_projection: string | null
  notes: string | null
}

export type PourLogTruck = {
  id?: string
  truck_number: string | null
  batch_time: string | null
  arrival_time: string | null
  pour_start: string | null
  pour_complete: string | null
  yards: string | number | null
  concrete_temp: string | number | null
  slump: string | number | null
  air_content: string | number | null
  water_added: string | number | null
  cylinders_cast: string | number | null
  foundations_served: string | null
  notes: string | null
}

export type PourLogDetail = {
  log: {
    id: string
    project_id: string | null
    project_name: string | null
    log_date: string | null
    log_type: string | null
    submitted_by: string | null
    concrete_supplier: string | null
    weather: string | null
    ambient_temp: string | null
    photo_urls: string[] | null
    photo_labels: string[] | null
  }
  foundations: PourLogFoundation[]
  trucks: PourLogTruck[]
}

export type ContractorEvalDetail = {
  id: string
  project_id: string | null
  project_name: string | null
  inspection_date: string | null
  inspection_location: string | null
  contractor_name: string | null
  supervisor_name: string | null
  inspector_name: string | null
  ppe_compliant: boolean | null
  safety_signs: boolean | null
  emergency_procedures: boolean | null
  safety_comments: string | null
  work_specs: boolean | null
  materials_quality: boolean | null
  workmanship: boolean | null
  work_quality_comments: string | null
  on_schedule: boolean | null
  milestones_met: boolean | null
  timeliness_comments: string | null
  contractor_responsive: boolean | null
  progress_reports: boolean | null
  communication_comments: string | null
  regulations_compliant: boolean | null
  permits_current: boolean | null
  compliance_comments: string | null
  env_impact_minimized: boolean | null
  waste_disposal: boolean | null
  environmental_comments: string | null
  overall_rating: string | null
  overall_comments: string | null
  inspector_signature: string | null
  signature_date: string | null
}

export type WeeklySummaryData = {
  weekly_report?: {
    id: string
    week_start: string | null
    week_end: string | null
    generated_from_daily_reports?: boolean | null
    report_count?: number | null
  } | null
  summary: string | null
  source?: 'saved' | 'generated' | 'blank' | string
  reports: Array<{
    report_date: string | null
    submitted_by: string | null
    crew_count: number | null
    weather: string | null
    work_completed: string | null
    equipment_used: string | null
    safety_issues: string | null
    photo_urls: string[] | null
    photo_labels: string[] | null
  }>
  project_name: string | null
}

export type QaFormDetail = {
  id: string
  project_id: string | null
  project_name: string | null
  form_type: string | null
  work_date: string | null
  submitted_by: string | null
  form_data: Record<string, any> | null
  photo_urls: string[] | null
  photo_labels: string[] | null
}

export type ProjectPhoto = {
  id: string
  url: string
  label: string
  source: string
  source_label: string
  source_date: string | null
  submitted_by: string | null
  detail_path: string
}

export type ProjectPhotoGallery = {
  counts: {
    total: number
    daily_reports: number
    pour_logs: number
    qa_forms: number
  }
  photos: ProjectPhoto[]
}

export type QaFormDefinitionField = {
  path: string
  label: string
  type: string
  required?: boolean
}

export type QaFormDefinitionSection =
  | {
      kind: 'fields'
      title: string
      fields: QaFormDefinitionField[]
    }
  | {
      kind: 'checkbox_group'
      title: string
      path: string
      options: string[]
    }
  | {
      kind: 'tri_state_list'
      title: string
      path: string
      includeRemarks?: boolean
      items: string[]
    }
  | {
      kind: 'tri_state_matrix'
      title: string
      path: string
      columns: string[]
      rows: string[]
    }
  | {
      kind: 'table'
      title: string
      path: string
      rowLabels?: string[]
      rowCount?: number
      columns: Array<{ key: string; label: string; type: string }>
    }

export type QaFormDefinition = {
  key: string
  code: string
  title: string
  shortLabel: string
  accent: string
  sections: QaFormDefinitionSection[]
}

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://app.ironcladks.com'
const DETAIL_CACHE_TTL_MS = 5 * 60 * 1000

type CacheEntry<T> = {
  value: T
  cachedAt: number
}

const detailCache = new Map<string, CacheEntry<unknown>>()

function readCache<T>(key: string): T | null {
  const entry = detailCache.get(key)
  if (!entry) return null

  if (Date.now() - entry.cachedAt > DETAIL_CACHE_TTL_MS) {
    detailCache.delete(key)
    return null
  }

  return entry.value as T
}

function writeCache<T>(key: string, value: T): T {
  detailCache.set(key, {
    value,
    cachedAt: Date.now(),
  })

  return value
}

async function fetchMobileApi<T>(path: string, session: Session): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(data?.error || 'Mobile API request failed.')
  }

  return data as T
}

async function postMobileApi<T>(path: string, session: Session, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(data?.error || 'Mobile API request failed.')
  }

  return data as T
}

export async function fetchProjects(session: Session) {
  return fetchMobileApi<{ settings: MobileSettings; dashboard?: { today_summary?: SubmissionDashboardSummary }; projects: ProjectSummary[] }>(
    '/api/mobile/projects',
    session
  )
}

export async function fetchProjectDetail(projectId: string, session: Session) {
  const data = await fetchMobileApi<ProjectDetail>(
    `/api/mobile/projects/${projectId}`,
    session
  )

  return writeCache(`project:${projectId}`, data)
}

export async function fetchReportDetail(reportId: string, session: Session) {
  const data = await fetchMobileApi<{ report: ReportDetail }>(
    `/api/mobile/reports/${reportId}`,
    session
  )

  return writeCache(`report:${reportId}`, data.report)
}

export async function fetchPourLogDetail(logId: string, session: Session) {
  const data = await fetchMobileApi<PourLogDetail>(
    `/api/mobile/pour-logs/${logId}`,
    session
  )

  return writeCache(`pour-log:${logId}`, data)
}

export async function fetchContractorEvalDetail(evalId: string, session: Session) {
  const data = await fetchMobileApi<{ eval_: ContractorEvalDetail }>(
    `/api/mobile/contractor-evals/${evalId}`,
    session
  )

  return writeCache(`contractor-eval:${evalId}`, data.eval_)
}

export async function fetchWeeklySummary(projectId: string, startDate: string, endDate: string, session: Session) {
  const query = new URLSearchParams({ start: startDate, end: endDate }).toString()
  const data = await fetchMobileApi<WeeklySummaryData>(
    `/api/mobile/weekly-summary/${projectId}?${query}`,
    session
  )

  return writeCache(`weekly-summary:${projectId}:${startDate}:${endDate}`, data)
}

export async function fetchQaFormDetail(formId: string, session: Session) {
  const data = await fetchMobileApi<{ qa_form: QaFormDetail }>(
    `/api/mobile/qa-forms/${formId}`,
    session
  )

  return writeCache(`qa-form:${formId}`, data.qa_form)
}

export async function fetchLatestReportSummary(projectId: string, beforeDate: string, session: Session) {
  const query = new URLSearchParams()
  if (beforeDate) query.set('before', beforeDate)
  return fetchMobileApi<{ report: { crew_count: number | null; equipment_used: string | null; submitted_by: string | null; report_date: string | null } | null }>(
    `/api/mobile/reports/latest/${projectId}?${query.toString()}`,
    session
  )
}

export async function createDailyReport(payload: Record<string, unknown>, session: Session) {
  return postMobileApi<{ id: string }>(
    '/api/mobile/reports/create',
    session,
    payload
  )
}

export async function updateDailyReport(reportId: string, payload: Record<string, unknown>, session: Session) {
  const data = await postMobileApi<{ report: ReportDetail }>(
    `/api/mobile/reports/${reportId}`,
    session,
    payload
  )

  return writeCache(`report:${reportId}`, data.report)
}

export async function createContractorEvaluation(payload: Record<string, unknown>, session: Session) {
  return postMobileApi<{ id: string }>(
    '/api/mobile/contractor-evals/create',
    session,
    payload
  )
}

export async function fetchQaFormDefinition(formType: string, session: Session) {
  const query = new URLSearchParams({ type: formType }).toString()
  return fetchMobileApi<{ definition: QaFormDefinition; meta: { code: string; title: string; shortLabel: string; accent: string } }>(
    `/api/mobile/qa-forms/definition?${query}`,
    session
  )
}

export async function createQaForm(payload: Record<string, unknown>, session: Session) {
  return postMobileApi<{ id: string }>(
    '/api/mobile/qa-forms/create',
    session,
    payload
  )
}

export async function fetchProjectPhotoGallery(projectId: string, session: Session) {
  return fetchMobileApi<{ project: { id: string; project_name: string; location: string | null }; gallery: ProjectPhotoGallery }>(
    `/api/mobile/projects/${projectId}/photos`,
    session
  )
}

export async function createPourLog(payload: Record<string, unknown>, session: Session) {
  return postMobileApi<{ id: string }>(
    '/api/mobile/pour-logs/create',
    session,
    payload
  )
}

export async function uploadPhotos(folder: string, files: UploadPhotoFile[], session: Session, projectId?: string | null) {
  const formData = new FormData()
  formData.append('folder', folder)
  if (projectId) {
    formData.append('project_id', projectId)
  }

  files.forEach((file) => {
    formData.append('files', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as any)
  })

  const response = await fetch(`${API_BASE_URL}/api/upload-photos`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    body: formData,
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(data?.errors?.join('\n') || data?.error || 'Photo upload failed.')
  }

  return {
    urls: Array.isArray(data?.urls) ? data.urls.filter((url: unknown) => typeof url === 'string' && url.trim()) : [],
    errors: Array.isArray(data?.errors) ? data.errors : [],
  }
}

export function getCachedProjectDetail(projectId: string) {
  return readCache<ProjectDetail>(`project:${projectId}`)
}

export function getCachedReportDetail(reportId: string) {
  return readCache<ReportDetail>(`report:${reportId}`)
}

export function getCachedPourLogDetail(logId: string) {
  return readCache<PourLogDetail>(`pour-log:${logId}`)
}

export function getCachedContractorEvalDetail(evalId: string) {
  return readCache<ContractorEvalDetail>(`contractor-eval:${evalId}`)
}

export function getCachedWeeklySummary(projectId: string, startDate: string, endDate: string) {
  return readCache<WeeklySummaryData>(`weekly-summary:${projectId}:${startDate}:${endDate}`)
}

export function getCachedQaFormDetail(formId: string) {
  return readCache<QaFormDetail>(`qa-form:${formId}`)
}

export function buildWebUrl(path: string) {
  return `${API_BASE_URL}${path}`
}
