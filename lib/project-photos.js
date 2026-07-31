import { applyAccessScope } from '@/lib/organizations'

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function toTimestamp(value) {
  if (!value) return 0
  const date = new Date(value)
  const time = date.getTime()
  return Number.isFinite(time) ? time : 0
}

function qaFormLabel(formType) {
  switch (formType) {
    case 'mono_pole_framing':
      return 'QA-009'
    case 'vibratory_caisson':
      return 'QA-010'
    case 'pole_setting':
      return 'QA-011'
    case 'grounding_resistance':
      return 'QA-013'
    default:
      return 'QA Form'
  }
}

function mapPhotoEntries(records, options) {
  return (records || []).flatMap(record => {
    const urls = asArray(record.photo_urls)
    const labels = asArray(record.photo_labels)

    return urls
      .filter(Boolean)
      .map((url, index) => ({
        id: `${options.source}:${record.id}:${index}`,
        url,
        label: labels[index] || '',
        source: options.source,
        source_label: options.sourceLabel(record),
        source_date: options.dateValue(record) || null,
        submitted_by: record.submitted_by || null,
        detail_path: options.detailPath(record),
      }))
  })
}

export async function getProjectPhotoGallery(
  supabase,
  projectId,
  userId,
  organizationIds,
  projectIds = [],
  restrictToAssignedProjects = false
) {
  if (!projectId) {
    return { photos: [], counts: { total: 0, daily_reports: 0, pour_logs: 0, qa_forms: 0 } }
  }

  const [reportsResult, pourLogsResult, qaFormsResult] = await Promise.all([
    applyAccessScope(
      supabase
        .from('reports')
        .select('id, report_date, submitted_by, photo_urls, photo_labels')
        .eq('project_id', projectId)
        .order('report_date', { ascending: false }),
      userId,
      organizationIds,
      projectIds,
      { restrictToAssignedProjects }
    ),
    applyAccessScope(
      supabase
        .from('pour_logs')
        .select('id, log_date, log_type, submitted_by, photo_urls, photo_labels')
        .eq('project_id', projectId)
        .order('log_date', { ascending: false }),
      userId,
      organizationIds,
      projectIds,
      { restrictToAssignedProjects }
    ),
    applyAccessScope(
      supabase
        .from('qa_forms')
        .select('id, work_date, form_type, submitted_by, photo_urls, photo_labels')
        .eq('project_id', projectId)
        .order('work_date', { ascending: false }),
      userId,
      organizationIds,
      projectIds,
      { restrictToAssignedProjects }
    ),
  ])

  const firstError = reportsResult.error || pourLogsResult.error || qaFormsResult.error
  if (firstError) throw firstError

  const dailyPhotos = mapPhotoEntries(reportsResult.data, {
    source: 'daily_report',
    sourceLabel: () => 'Daily Report',
    dateValue: record => record.report_date,
    detailPath: record => `/reports/${record.id}`,
  })

  const pourLogPhotos = mapPhotoEntries(pourLogsResult.data, {
    source: 'pour_log',
    sourceLabel: record => record.log_type === 'flatwork' ? 'Flatwork Pour Log' : 'Pour Log',
    dateValue: record => record.log_date,
    detailPath: record => `/pour-logs/${record.id}`,
  })

  const qaFormPhotos = mapPhotoEntries(qaFormsResult.data, {
    source: 'qa_form',
    sourceLabel: record => qaFormLabel(record.form_type),
    dateValue: record => record.work_date,
    detailPath: record => `/qa-forms/${record.id}`,
  })

  const photos = [...dailyPhotos, ...pourLogPhotos, ...qaFormPhotos].sort(
    (left, right) => toTimestamp(right.source_date) - toTimestamp(left.source_date)
  )

  return {
    photos,
    counts: {
      total: photos.length,
      daily_reports: dailyPhotos.length,
      pour_logs: pourLogPhotos.length,
      qa_forms: qaFormPhotos.length,
    },
  }
}
