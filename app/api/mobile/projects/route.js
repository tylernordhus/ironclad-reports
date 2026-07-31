import { createClient } from '@supabase/supabase-js'
import { SHOW_SUBMISSION_DASHBOARD } from '@/lib/feature-flags'
import { requireMobileUser } from '@/lib/mobile-auth'
import { applyAccessScope, getAccessScope } from '@/lib/organizations'
import { getSubmissionDashboardData } from '@/lib/submission-dashboard'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export async function GET(request) {
  const mobileUser = await requireMobileUser(request)
  if (mobileUser.response) return mobileUser.response
  const user_id = mobileUser.userId
  const accessScope = await getAccessScope(supabase, user_id)

  const [{ data: settings }, { data: projects, error: projectsError }] = await Promise.all([
    supabase
      .from('settings')
      .select('company_name, logo_url')
      .single(),
    applyAccessScope(
      supabase
      .from('projects')
      .select('id, project_name, location, address, client_name, status, start_date, created_at')
      .order('created_at', { ascending: false }),
      user_id,
      accessScope.scopedOrganizationIds,
      accessScope.scopedProjectIds,
      {
        projectIdColumn: 'id',
        restrictToAssignedProjects: accessScope.restrictToAssignedProjects,
      }
    ),
  ])

  if (projectsError) {
    return Response.json(
      { error: projectsError.message || 'Failed to load projects.' },
      {
        status: 500,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      }
    )
  }

  const dashboard = SHOW_SUBMISSION_DASHBOARD
    ? await getSubmissionDashboardData(
        supabase,
        user_id,
        accessScope.scopedOrganizationIds,
        projects || [],
        accessScope.scopedProjectIds,
        accessScope.restrictToAssignedProjects
      )
    : null
  const projectStatusById = dashboard
    ? Object.fromEntries(dashboard.rows.map(row => [row.project.id, row.today_status]))
    : {}

  return Response.json(
    {
      dashboard: SHOW_SUBMISSION_DASHBOARD && dashboard
        ? {
            today_summary: dashboard.todaySummary,
          }
        : null,
      settings: {
        company_name: settings?.company_name || 'Ironclad Construction LLC',
        logo_url: settings?.logo_url || '',
      },
      projects: (projects || []).map(project => ({
        ...project,
        today_daily_report_status: projectStatusById[project.id] || null,
      })),
    },
    {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    }
  )
}
