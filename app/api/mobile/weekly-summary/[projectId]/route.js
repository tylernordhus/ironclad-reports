import { createClient } from '@supabase/supabase-js'
import { requireMobileUser } from '@/lib/mobile-auth'
import { getAccessScope, getOwnedProjectById } from '@/lib/organizations'
import { getWeeklyReportRecord, getWeeklySourceReports } from '@/lib/weekly-reports'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export async function GET(request, { params }) {
  const mobileUser = await requireMobileUser(request)
  if (mobileUser.response) return mobileUser.response
  const userId = mobileUser.userId

  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start')
    const endDate = searchParams.get('end')
    const accessScope = await getAccessScope(supabase, userId)

    if (!startDate || !endDate) {
      return Response.json(
        { error: 'Start and end dates are required.' },
        {
          status: 400,
          headers: { 'Cache-Control': 'no-store, max-age=0' },
        }
      )
    }

    const { data: project } = await getOwnedProjectById(
      supabase,
      userId,
      params.projectId,
      accessScope.scopedOrganizationIds,
      'id, project_name, location, organization_id',
      accessScope.scopedProjectIds,
      { restrictToAssignedProjects: accessScope.restrictToAssignedProjects }
    )

    if (!project) {
      return Response.json(
        { error: 'Project not found.' },
        {
          status: 404,
          headers: { 'Cache-Control': 'no-store, max-age=0' },
        }
      )
    }

    const [weeklyReport, reports] = await Promise.all([
      getWeeklyReportRecord(
        supabase,
        project.id,
        userId,
        accessScope.scopedOrganizationIds,
        startDate,
        endDate,
        accessScope.scopedProjectIds,
        accessScope.restrictToAssignedProjects
      ),
      getWeeklySourceReports(
        supabase,
        project.id,
        userId,
        accessScope.scopedOrganizationIds,
        startDate,
        endDate,
        accessScope.scopedProjectIds,
        accessScope.restrictToAssignedProjects
      ),
    ])

    return Response.json(
      {
        weekly_report: weeklyReport,
        summary: weeklyReport?.summary || '',
        reports,
        project_name: project.project_name,
        source: weeklyReport ? 'saved' : 'blank',
      },
      {
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      }
    )
  } catch (error) {
    console.error('Mobile weekly summary error:', error)
    return Response.json(
      { error: 'Failed to generate weekly summary.' },
      {
        status: 500,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      }
    )
  }
}
