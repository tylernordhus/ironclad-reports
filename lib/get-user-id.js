import { createClient } from '@/lib/supabase-server'

export async function getUserId() {
  try {
    const client = await createClient()
    const { data: { user } } = await client.auth.getUser()
    return user?.id || null
  } catch {
    return null
  }
}
