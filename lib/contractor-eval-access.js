import { getAccessScope, getOwnedRowById } from '@/lib/organizations'

export async function getAccessibleContractorEvaluationById(supabase, { evalId, userId, select = '*' }) {
  if (!userId || !evalId) {
    return { evaluation: null, error: null, accessScope: null }
  }

  const accessScope = await getAccessScope(supabase, userId)
  const { data, error } = await getOwnedRowById(
    supabase,
    'contractor_evaluations',
    evalId,
    userId,
    accessScope.scopedOrganizationIds,
    select,
    accessScope.scopedProjectIds,
    {
      projectIdColumn: 'project_id',
      restrictToAssignedProjects: accessScope.restrictToAssignedProjects,
    }
  )

  return { evaluation: data || null, error, accessScope }
}
