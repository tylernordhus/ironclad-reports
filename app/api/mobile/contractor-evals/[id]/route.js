import { createClient } from '@supabase/supabase-js'
import { requireMobileUser } from '@/lib/mobile-auth'
import { getAccessibleContractorEvaluationById } from '@/lib/contractor-eval-access'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export async function GET(request, { params }) {
  const mobileUser = await requireMobileUser(request)
  if (mobileUser.response) return mobileUser.response

  const { evaluation: eval_, error } = await getAccessibleContractorEvaluationById(supabase, {
    evalId: params.id,
    userId: mobileUser.userId,
  })

  if (error || !eval_) {
    return Response.json(
      { error: 'Contractor evaluation not found.' },
      {
        status: 404,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      }
    )
  }

  return Response.json(
    { eval_ },
    {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    }
  )
}
