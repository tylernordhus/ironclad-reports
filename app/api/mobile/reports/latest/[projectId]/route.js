import { createClient } from '@supabase/supabase-js'
import { requireMobileUser } from '@/lib/mobile-auth'
import { applyAccessScope, getAccessScope } from '@/lib/organizations'

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
  const accessScope = await getAccessScope(supabase, userId)
  const { searchParams } = new URL(request.url)
  const beforeDate = searchParams.get('before')

  let query = applyAccessScope(
    supabase
      .from('reports')
      .select('crew_count, equipment_used, submitted_by, report_date')
      .eq('project_id', params.projectId)
      .order('report_date', { ascending: false })
      .limit(1),
    userId,
    accessScope.scopedOrganizationIds,
    accessScope.scopedProjectIds,
    { restrictToAssignedProjects: accessScope.restrictToAssignedProjects }
  )

  if (beforeDate) {
    query = query.lt('report_date', beforeDate)
  }

  const { data, error } = await query.single()
  if (error || !data) {
    return Response.json(
      { report: null },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  }

  return Response.json(
    { report: data },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  )
}
