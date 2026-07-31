import { getAccessScope, getOwnedRowById } from '@/lib/organizations'

export async function getAccessibleQaFormById(
  supabase,
  {
    formId,
    userId,
    select = '*',
  }
) {
  if (!userId || !formId) {
    return { qaForm: null, error: null, accessScope: null }
  }

  const accessScope = await getAccessScope(supabase, userId)
  const { data, error } = await getOwnedRowById(
    supabase,
    'qa_forms',
    formId,
    userId,
    accessScope.scopedOrganizationIds,
    select,
    accessScope.scopedProjectIds,
    {
      projectIdColumn: 'project_id',
      restrictToAssignedProjects: accessScope.restrictToAssignedProjects,
    }
  )

  return { qaForm: data || null, error, accessScope }
}
