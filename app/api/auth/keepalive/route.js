import { getUserId } from '@/lib/get-user-id'

export async function GET() {
  const userId = await getUserId()
  if (!userId) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  return Response.json({ ok: true, at: Date.now() })
}
