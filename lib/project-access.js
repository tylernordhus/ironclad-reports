import {
  getAccessScope,
  getOrCreateDefaultOrganizationId,
  getOwnedProjectById,
} from '@/lib/organizations'

export async function getCreateProjectContext(supabase, { userId, projectId, select = 'id, organization_id' }) {
  if (!userId) {
    return { project: null, organizationId: null, error: null, accessScope: null }
  }

  const normalizedProjectId = String(projectId || '').trim()
  if (!normalizedProjectId) {
    const organizationId = await getOrCreateDefaultOrganizationId(supabase, userId)
    return { project: null, organizationId, error: null, accessScope: null }
  }

  const accessScope = await getAccessScope(supabase, userId)
  const { data: project, error } = await getOwnedProjectById(
    supabase,
    userId,
    normalizedProjectId,
    accessScope.scopedOrganizationIds,
    select,
    accessScope.scopedProjectIds,
    { restrictToAssignedProjects: accessScope.restrictToAssignedProjects }
  )

  return {
    project: project || null,
    organizationId: project?.organization_id || null,
    error,
    accessScope,
  }
}
