import { getQaFormDefinition, getQaFormTypeMeta } from '@/lib/qa-forms'
import { requireMobileUser } from '@/lib/mobile-auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request) {
  const mobileUser = await requireMobileUser(request)
  if (mobileUser.response) return mobileUser.response

  const { searchParams } = new URL(request.url)
  const formType = searchParams.get('type') || ''
  const definition = getQaFormDefinition(formType)

  if (!definition) {
    return Response.json(
      { error: 'Unknown QA form type.' },
      { status: 404, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  }

  return Response.json(
    {
      definition,
      meta: getQaFormTypeMeta(formType),
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  )
}
