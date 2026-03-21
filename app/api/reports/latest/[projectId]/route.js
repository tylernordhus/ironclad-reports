import { createClient } from '@supabase/supabase-js'
import { getUserId } from '@/lib/get-user-id'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export async function GET(request, { params }) {
  const user_id = await getUserId()

  const { data, error } = await supabase
    .from('reports')
    .select('crew_count, work_completed, equipment_used, safety_issues, weather, submitted_by, project_name')
    .eq('project_id', params.projectId)
    .eq('user_id', user_id)
    .order('report_date', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) {
    return new Response(JSON.stringify({ report: null }), { headers: { 'Content-Type': 'application/json' } })
  }

  return new Response(JSON.stringify({ report: data }), { headers: { 'Content-Type': 'application/json' } })
}
