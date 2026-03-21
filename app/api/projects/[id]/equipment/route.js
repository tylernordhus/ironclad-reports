import { createClient } from '@supabase/supabase-js'
import { getUserId } from '@/lib/get-user-id'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export async function GET(request, { params }) {
  const user_id = await getUserId()
  const { data } = await supabase
    .from('projects')
    .select('equipment_list')
    .eq('id', params.id)
    .eq('user_id', user_id)
    .single()

  return Response.json({ equipment_list: data?.equipment_list || [] })
}

export async function POST(request, { params }) {
  const user_id = await getUserId()
  const { item } = await request.json()
  if (!item?.trim()) return Response.json({ ok: false })

  const { data } = await supabase
    .from('projects')
    .select('equipment_list')
    .eq('id', params.id)
    .eq('user_id', user_id)
    .single()

  const current = data?.equipment_list || []
  if (current.includes(item.trim())) return Response.json({ ok: true, equipment_list: current })

  const updated = [...current, item.trim()]
  await supabase
    .from('projects')
    .update({ equipment_list: updated })
    .eq('id', params.id)
    .eq('user_id', user_id)

  return Response.json({ ok: true, equipment_list: updated })
}
