import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export async function POST(request, { params }) {
  try {
    // Delete all related records first
    const { data: logs } = await supabase.from('pour_logs').select('id').eq('project_id', params.id)
    if (logs?.length) {
      const logIds = logs.map(l => l.id)
      await supabase.from('pour_log_foundations').delete().in('pour_log_id', logIds)
      await supabase.from('pour_log_trucks').delete().in('pour_log_id', logIds)
    }
    await supabase.from('pour_logs').delete().eq('project_id', params.id)
    await supabase.from('reports').delete().eq('project_id', params.id)
    await supabase.from('contractor_evaluations').delete().eq('project_id', params.id)
    await supabase.from('projects').delete().eq('id', params.id)

    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
