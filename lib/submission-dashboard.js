import { applyAccessScope } from '@/lib/organizations'
import { getProjectReportTypeSettingsMap, isProjectReportTypeEnabled } from '@/lib/project-report-types'

export function getDashboardDates(days = 7) {
  const dates = []
  const today = new Date()

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today)
    date.setDate(today.getDate() - offset)
    dates.push(date.toISOString().split('T')[0])
  }

  return dates
}

export async function getSubmissionDashboardData(
  supabase,
  userId,
  organizationIds,
  projects = [],
  scopedProjectIds = [],
  restrictToAssignedProjects = false
) {
  const allProjects = projects || []
  const allProjectIds = allProjects.map(project => project.id).filter(Boolean)
  const reportTypeSettingsMap = await getProjectReportTypeSettingsMap(supabase, allProjectIds)
  const dates = getDashboardDates(7)
  const [firstDate, lastDate] = [dates[0], dates[dates.length - 1]]

  const eligibleProjects = allProjects.filter(project =>
    isProjectReportTypeEnabled(reportTypeSettingsMap[project.id], 'daily_report')
  )

  let reports = []

  if (eligibleProjects.length > 0) {
    let reportsQuery = supabase
      .from('reports')
      .select('project_id, report_date')
      .in('project_id', eligibleProjects.map(project => project.id))
      .gte('report_date', firstDate)
      .lte('report_date', lastDate)

    reportsQuery = applyAccessScope(reportsQuery, userId, organizationIds, scopedProjectIds, {
      restrictToAssignedProjects,
    })
    const { data, error } = await reportsQuery
    if (error) throw error
    reports = data || []
  }

  const submittedKeys = new Set(
    reports
      .filter(report => report.project_id && report.report_date)
      .map(report => `${report.project_id}:${report.report_date}`)
  )

  const rows = eligibleProjects.map(project => {
    const projectIsActive = !project.status || project.status === 'active'
    const statuses = dates.map(date => {
      const isSubmitted = submittedKeys.has(`${project.id}:${date}`)
      if (isSubmitted) return { date, status: 'submitted' }
      return { date, status: projectIsActive ? 'missing' : 'inactive' }
    })

    return {
      project,
      statuses,
      today_status: statuses[statuses.length - 1]?.status || 'missing',
    }
  })

  return {
    dates,
    rows,
    todaySummary: {
      submitted: rows.filter(row => row.today_status === 'submitted').length,
      missing: rows.filter(row => row.today_status === 'missing').length,
      inactive: rows.filter(row => row.today_status === 'inactive').length,
    },
    hiddenProjectCount: allProjects.length - eligibleProjects.length,
  }
}
