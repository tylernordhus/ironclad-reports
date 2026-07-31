import { createClient } from '@supabase/supabase-js'
import { getUserId } from '@/lib/get-user-id'
import { getAccessiblePourLogById, getPourLogChildren } from '@/lib/pour-log-access'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export async function GET(request, { params }) {
  const userId = await getUserId()
  if (!userId) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { log, error } = await getAccessiblePourLogById(supabase, { logId: params.id, userId })
  if (error || !log) {
    return new Response('Not found', { status: 404 })
  }

  const { foundations, trucks } = await getPourLogChildren(supabase, params.id)

  return Response.json(
    { log, foundations, trucks },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  )
}
