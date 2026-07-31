import { createClient } from '@supabase/supabase-js'
import { getUserId } from '@/lib/get-user-id'
import { getAccessibleContractorEvaluationById } from '@/lib/contractor-eval-access'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export async function GET(request, { params }) {
  const userId = await getUserId()
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const { evaluation: eval_, error } = await getAccessibleContractorEvaluationById(supabase, { evalId: params.id, userId })

  if (error || !eval_) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
  }

  return new Response(JSON.stringify({ eval_ }), {
    headers: { 'Content-Type': 'application/json' }
  })
}
