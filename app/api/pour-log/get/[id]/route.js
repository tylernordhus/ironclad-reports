import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export async function GET(request, { params }) {
  const { data: log, error } = await supabase
    .from('pour_logs')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !log) {
    return new Response('Not found', { status: 404 })
  }

  const { data: foundations } = await supabase
    .from('pour_log_foundations')
    .select('*')
    .eq('pour_log_id', params.id)

  const { data: trucks } = await supabase
    .from('pour_log_trucks')
    .select('*')
    .eq('pour_log_id', params.id)
    .order('truck_number', { ascending: true })

  return Response.json({ log, foundations: foundations || [], trucks: trucks || [] })
}
