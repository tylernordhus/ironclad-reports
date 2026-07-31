import { createClient } from '@supabase/supabase-js'
import { getUserId } from '@/lib/get-user-id'
import { applyAccessScope, getAccessScope } from '@/lib/organizations'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export async function GET(request, { params }) {
  const user_id = await getUserId()
  if (!user_id) {
    return new Response(JSON.stringify({ report: null }), { headers: { 'Content-Type': 'application/json' }, status: 401 })
  }

  const accessScope = await getAccessScope(supabase, user_id)
  const { searchParams } = new URL(request.url)
  const beforeDate = searchParams.get('before')

  let query = applyAccessScope(
    supabase
      .from('reports')
      .select('crew_count, work_completed, equipment_used, safety_issues, weather, submitted_by, project_name, report_date')
      .eq('project_id', params.projectId)
      .order('report_date', { ascending: false })
      .limit(1),
    user_id,
    accessScope.scopedOrganizationIds,
    accessScope.scopedProjectIds,
    {
      restrictToAssignedProjects: accessScope.restrictToAssignedProjects,
    }
  )

  if (beforeDate) {
    query = query.lt('report_date', beforeDate)
  }

  const { data, error } = await query.single()

  if (error || !data) {
    return new Response(JSON.stringify({ report: null }), { headers: { 'Content-Type': 'application/json' } })
  }

  return new Response(JSON.stringify({ report: data }), { headers: { 'Content-Type': 'application/json' } })
}
