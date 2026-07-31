import { createClient } from '@supabase/supabase-js'
import { requireMobileUser } from '@/lib/mobile-auth'
import { getAccessScope, getOwnedProjectById } from '@/lib/organizations'
import { getProjectPhotoGallery } from '@/lib/project-photos'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export async function GET(request, { params }) {
  const mobileUser = await requireMobileUser(request)
  if (mobileUser.response) return mobileUser.response

  const userId = mobileUser.userId
  const accessScope = await getAccessScope(supabase, userId)
  const { data: project } = await getOwnedProjectById(
    supabase,
    userId,
    params.id,
    accessScope.scopedOrganizationIds,
    'id, project_name, location, organization_id',
    accessScope.scopedProjectIds,
    { restrictToAssignedProjects: accessScope.restrictToAssignedProjects }
  )

  if (!project) {
    return Response.json(
      { error: 'Project not found.' },
      { status: 404, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  }

  const gallery = await getProjectPhotoGallery(
    supabase,
    project.id,
    userId,
    accessScope.scopedOrganizationIds,
    accessScope.scopedProjectIds,
    accessScope.restrictToAssignedProjects
  )

  return Response.json(
    {
      project,
      gallery,
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  )
}
