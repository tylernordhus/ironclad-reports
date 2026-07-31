import { createClient } from '@supabase/supabase-js'
import { requireMobileUser } from '@/lib/mobile-auth'
import { getAccessiblePourLogById, getPourLogChildren } from '@/lib/pour-log-access'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export async function GET(request, { params }) {
  const mobileUser = await requireMobileUser(request)
  if (mobileUser.response) return mobileUser.response
  const user_id = mobileUser.userId

  const { log, error } = await getAccessiblePourLogById(supabase, { logId: params.id, userId: user_id })

  if (error || !log) {
    return Response.json(
      { error: 'Pour log not found.' },
      {
        status: 404,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      }
    )
  }

  const { foundations, trucks } = await getPourLogChildren(supabase, params.id)

  return Response.json(
    {
      log,
      foundations,
      trucks,
    },
    {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    }
  )
}
