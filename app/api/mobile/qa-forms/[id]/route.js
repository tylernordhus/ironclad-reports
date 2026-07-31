import { createClient } from '@supabase/supabase-js'
import { requireMobileUser } from '@/lib/mobile-auth'
import { getAccessibleQaFormById } from '@/lib/qa-form-access'
import { getQaFormsAvailability, getQaFormsUnavailableMessage } from '@/lib/supabase-errors'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export async function GET(request, { params }) {
  const mobileUser = await requireMobileUser(request)
  if (mobileUser.response) return mobileUser.response

  const { qaForm: data, error } = await getAccessibleQaFormById(supabase, { formId: params.id, userId: mobileUser.userId })

  const qaFormsAvailability = getQaFormsAvailability(error)

  if (error && qaFormsAvailability.reason && qaFormsAvailability.reason !== 'query_failed') {
    return Response.json(
      {
        error: getQaFormsUnavailableMessage(qaFormsAvailability.reason) || 'QA forms are unavailable.',
        qa_forms_available: false,
        qa_forms_unavailable_reason: qaFormsAvailability.reason,
      },
      { status: 503, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  }

  if (error || !data) {
    return Response.json(
      { error: 'QA form not found.' },
      { status: 404, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  }

  return Response.json(
    { qa_form: data },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  )
}
