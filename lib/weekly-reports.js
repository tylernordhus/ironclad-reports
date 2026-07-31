import { applyAccessScope } from '@/lib/organizations'
import { isMissingRelationError } from '@/lib/supabase-errors'

export function getWeekBounds(offsetWeeks = 0) {
  const now = new Date()
  now.setDate(now.getDate() + offsetWeeks * 7)
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
  }
}

export async function getWeeklyReportRecord(
  supabase,
  projectId,
  userId,
  organizationIds,
  weekStart,
  weekEnd,
  projectIds = [],
  restrictToAssignedProjects = false
) {
  let query = supabase
    .from('weekly_reports')
    .select('*')
    .eq('project_id', projectId)
    .eq('week_start', weekStart)
    .eq('week_end', weekEnd)

  query = applyAccessScope(query, userId, organizationIds, projectIds, { restrictToAssignedProjects })

  const { data, error } = await query.maybeSingle()
  if (error) {
    if (isMissingRelationError(error)) return null
    throw error
  }

  return data || null
}

export async function getWeeklySourceReports(
  supabase,
  projectId,
  userId,
  organizationIds,
  startDate,
  endDate,
  projectIds = [],
  restrictToAssignedProjects = false
) {
  let query = supabase
    .from('reports')
    .select('report_date, crew_count, work_completed, equipment_used, safety_issues, weather, submitted_by, weather_delay, weather_delay_hours, on_schedule, photo_urls, photo_labels')
    .eq('project_id', projectId)
    .gte('report_date', startDate)
    .lte('report_date', endDate)
    .order('report_date', { ascending: true })

  query = applyAccessScope(query, userId, organizationIds, projectIds, { restrictToAssignedProjects })

  const { data, error } = await query
  if (error) throw error
  return data || []
}
