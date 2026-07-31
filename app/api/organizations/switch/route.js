import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserId } from '@/lib/get-user-id'
import { getOrganizationMembershipByOrgAndUser } from '@/lib/organizations'
import { isMissingRelationError } from '@/lib/supabase-errors'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

function normalizeNextPath(nextPath) {
  const value = String(nextPath || '').trim()
  return value.startsWith('/') ? value : '/projects'
}

export async function POST(request) {
  const userId = await getUserId()
  const formData = await request.formData()
  const nextPath = normalizeNextPath(formData.get('next'))

  if (!userId) {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(nextPath)}`, request.url), 303)
  }

  const organizationId = String(formData.get('organization_id') || '').trim()

  if (organizationId) {
    const membership = await getOrganizationMembershipByOrgAndUser(supabase, organizationId, userId)
    if (!membership || membership.is_active === false) {
      return NextResponse.redirect(new URL(nextPath, request.url), 303)
    }
  }

  const { error } = await supabase
    .from('user_profiles')
    .upsert({
      user_id: userId,
      active_organization_id: organizationId || null,
    }, { onConflict: 'user_id' })

  if (error && !isMissingRelationError(error)) {
    console.error('Organization switch failed:', error)
  }

  return NextResponse.redirect(new URL(nextPath, request.url), 303)
}
