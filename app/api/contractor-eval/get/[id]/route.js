import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export async function GET(request, { params }) {
  const { data: eval_, error } = await supabase
    .from('contractor_evaluations')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !eval_) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
  }

  return new Response(JSON.stringify({ eval_ }), {
    headers: { 'Content-Type': 'application/json' }
  })
}
