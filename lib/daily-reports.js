function asText(value, fallback = '') {
  if (value == null) return fallback
  return String(value)
}

function asNullableText(value, fallback = null) {
  if (value == null) return fallback
  const text = String(value).trim()
  return text === '' ? fallback : text
}

function asNullableNumber(value, fallback = null) {
  if (value == null || value === '') return fallback
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function asBoolean(value, fallback = false) {
  if (value == null) return fallback
  if (typeof value === 'boolean') return value
  const normalized = String(value).trim().toLowerCase()
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true
  if (['false', '0', 'no', 'off'].includes(normalized)) return false
  return fallback
}

function formValue(formData, key) {
  return formData.has(key) ? formData.get(key) : undefined
}

export function getDailyReportInputFromFormData(formData) {
  return {
    project_id: formValue(formData, 'project_id'),
    project_name: formValue(formData, 'project_name'),
    report_date: formValue(formData, 'report_date'),
    crew_count: formValue(formData, 'crew_count'),
    work_completed: formValue(formData, 'work_completed'),
    equipment_used: formValue(formData, 'equipment_used'),
    safety_issues: formValue(formData, 'safety_issues'),
    weather: formValue(formData, 'weather'),
    submitted_by: formValue(formData, 'submitted_by'),
    weather_delay: formValue(formData, 'weather_delay'),
    weather_delay_hours: formValue(formData, 'weather_delay_hours'),
    on_schedule: formValue(formData, 'on_schedule'),
  }
}

export function normalizeDailyReportPayload(input = {}, existing = {}) {
  const weatherDelay = asBoolean(input.weather_delay, existing.weather_delay ?? false)

  return {
    project_id: asNullableText(input.project_id, existing.project_id ?? null),
    project_name: asText(input.project_name, existing.project_name ?? ''),
    report_date: asNullableText(input.report_date, existing.report_date ?? null),
    crew_count: asNullableNumber(input.crew_count, existing.crew_count ?? null),
    work_completed: asText(input.work_completed, existing.work_completed ?? ''),
    equipment_used: asText(input.equipment_used, existing.equipment_used ?? ''),
    safety_issues: asText(input.safety_issues, existing.safety_issues ?? ''),
    weather: asText(input.weather, existing.weather ?? ''),
    submitted_by: asText(input.submitted_by, existing.submitted_by ?? ''),
    weather_delay: weatherDelay,
    weather_delay_hours: weatherDelay
      ? asNullableNumber(input.weather_delay_hours, existing.weather_delay_hours ?? null)
      : null,
    on_schedule: asBoolean(input.on_schedule, existing.on_schedule ?? true),
  }
}

export function buildDailyReportInsert(payload, { userId, organizationId, photoUrls = null, photoLabels = null } = {}) {
  return {
    ...payload,
    user_id: userId,
    organization_id: organizationId,
    photo_urls: photoUrls?.length ? photoUrls : null,
    photo_labels: photoLabels?.length ? photoLabels : null,
  }
}

export function buildDailyReportUpdate(payload, { photoUrls, photoLabels } = {}) {
  return {
    project_name: payload.project_name,
    report_date: payload.report_date,
    crew_count: payload.crew_count,
    work_completed: payload.work_completed,
    equipment_used: payload.equipment_used,
    safety_issues: payload.safety_issues,
    weather: payload.weather,
    submitted_by: payload.submitted_by,
    weather_delay: payload.weather_delay,
    weather_delay_hours: payload.weather_delay_hours,
    on_schedule: payload.on_schedule,
    ...(photoUrls ? { photo_urls: photoUrls.length > 0 ? photoUrls : null } : {}),
    ...(photoLabels ? { photo_labels: photoLabels.length > 0 ? photoLabels : null } : {}),
  }
}
