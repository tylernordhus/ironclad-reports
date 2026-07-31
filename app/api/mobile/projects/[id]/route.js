import { createClient } from '@supabase/supabase-js'
import { requireMobileUser } from '@/lib/mobile-auth'
import { applyAccessScope, getAccessScope, getOwnedProjectById } from '@/lib/organizations'
import { getQaFormsAvailability } from '@/lib/supabase-errors'
import {
  getProjectReportTypeForQaForm,
  getProjectReportTypeSettings,
  isProjectReportTypeEnabled,
} from '@/lib/project-report-types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export async function GET(request, { params }) {
  const mobileUser = await requireMobileUser(request)
  if (mobileUser.response) return mobileUser.response
  const user_id = mobileUser.userId
  const accessScope = await getAccessScope(supabase, user_id)

  const { data: project, error: projectError } = await getOwnedProjectById(
    supabase,
    user_id,
    params.id,
    accessScope.scopedOrganizationIds,
    '*',
    accessScope.scopedProjectIds,
    { restrictToAssignedProjects: accessScope.restrictToAssignedProjects }
  )

  if (projectError || !project) {
    return Response.json(
      { error: 'Project not found.' },
      {
        status: 404,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      }
    )
  }

  const reportTypeSettings = await getProjectReportTypeSettings(supabase, project.id)
  const showDailyReports = isProjectReportTypeEnabled(reportTypeSettings, 'daily_report')
  const showPourLogs = isProjectReportTypeEnabled(reportTypeSettings, 'pour_log')
  const showContractorEvaluations = isProjectReportTypeEnabled(reportTypeSettings, 'contractor_evaluation')

  const [reportsResult, pourLogsResult, contractorEvalsResult, qaFormsResult] = await Promise.all([
    applyAccessScope(
      supabase
        .from('reports')
        .select('id, report_date, submitted_by, crew_count')
        .eq('project_id', project.id)
        .order('report_date', { ascending: false }),
      user_id,
      accessScope.scopedOrganizationIds,
      accessScope.scopedProjectIds,
      { restrictToAssignedProjects: accessScope.restrictToAssignedProjects }
    ),
    applyAccessScope(
      supabase
        .from('pour_logs')
        .select('id, log_date, log_type, submitted_by')
        .eq('project_id', project.id)
        .order('log_date', { ascending: false }),
      user_id,
      accessScope.scopedOrganizationIds,
      accessScope.scopedProjectIds,
      { restrictToAssignedProjects: accessScope.restrictToAssignedProjects }
    ),
    applyAccessScope(
      supabase
        .from('contractor_evaluations')
        .select('id, inspection_date, contractor_name, inspector_name, overall_rating')
        .eq('project_id', project.id)
        .order('inspection_date', { ascending: false }),
      user_id,
      accessScope.scopedOrganizationIds,
      accessScope.scopedProjectIds,
      { restrictToAssignedProjects: accessScope.restrictToAssignedProjects }
    ),
    applyAccessScope(
      supabase
        .from('qa_forms')
        .select('id, work_date, form_type, submitted_by')
        .eq('project_id', project.id)
        .order('work_date', { ascending: false }),
      user_id,
      accessScope.scopedOrganizationIds,
      accessScope.scopedProjectIds,
      { restrictToAssignedProjects: accessScope.restrictToAssignedProjects }
    ),
  ])

  const qaFormsAvailability = getQaFormsAvailability(qaFormsResult.error)

  const summaryError =
    reportsResult.error ||
    pourLogsResult.error ||
    contractorEvalsResult.error ||
    (qaFormsResult.error && qaFormsAvailability.reason === 'query_failed' ? qaFormsResult.error : null)

  if (summaryError) {
    return Response.json(
      { error: summaryError.message || 'Failed to load project details.' },
      {
        status: 500,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      }
    )
  }

  return Response.json(
    {
      project,
      report_type_settings: reportTypeSettings,
      reports: showDailyReports ? (reportsResult.data || []) : [],
      pour_logs: showPourLogs ? (pourLogsResult.data || []) : [],
      contractor_evaluations: showContractorEvaluations ? (contractorEvalsResult.data || []) : [],
      qa_forms: qaFormsAvailability.available
        ? (qaFormsResult.data || []).filter(form =>
            isProjectReportTypeEnabled(reportTypeSettings, getProjectReportTypeForQaForm(form.form_type))
          )
        : [],
      qa_forms_available: qaFormsAvailability.available,
      qa_forms_unavailable_reason: qaFormsAvailability.reason,
    },
    {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    }
  )
}
