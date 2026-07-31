import { createClient } from '@supabase/supabase-js'
import { getUserId } from '@/lib/get-user-id'
import { getAccessScope, getOwnedProjectById } from '@/lib/organizations'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export async function GET(request, { params }) {
  const userId = await getUserId()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const accessScope = await getAccessScope(supabase, userId)
  const { data: project, error } = await getOwnedProjectById(
    supabase,
    userId,
    params.id,
    accessScope.scopedOrganizationIds,
    'equipment_list',
    accessScope.scopedProjectIds,
    { restrictToAssignedProjects: accessScope.restrictToAssignedProjects }
  )

  if (error || !project) {
    return Response.json({ error: 'Project not found.' }, { status: 404 })
  }

  return Response.json({ equipment_list: project.equipment_list || [] })
}

export async function POST(request, { params }) {
  const userId = await getUserId()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { item } = await request.json()
  const trimmedItem = item?.trim()
  if (!trimmedItem) return Response.json({ ok: false })

  const accessScope = await getAccessScope(supabase, userId)
  const { data: project, error } = await getOwnedProjectById(
    supabase,
    userId,
    params.id,
    accessScope.scopedOrganizationIds,
    'equipment_list',
    accessScope.scopedProjectIds,
    { restrictToAssignedProjects: accessScope.restrictToAssignedProjects }
  )

  if (error || !project) {
    return Response.json({ error: 'Project not found.' }, { status: 404 })
  }

  const current = project.equipment_list || []
  if (current.includes(trimmedItem)) return Response.json({ ok: true, equipment_list: current })

  const updated = [...current, trimmedItem]
  const { error: updateError } = await supabase
    .from('projects')
    .update({ equipment_list: updated })
    .eq('id', params.id)

  if (updateError) {
    return Response.json({ error: updateError.message || 'Failed to update equipment.' }, { status: 500 })
  }

  return Response.json({ ok: true, equipment_list: updated })
}
