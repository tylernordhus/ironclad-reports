import { getAccessScope, getOwnedRowById } from '@/lib/organizations'

export async function getAccessibleReportById(
  supabase,
  {
    reportId,
    userId,
    select = '*',
  }
) {
  if (!userId || !reportId) {
    return { report: null, error: null, accessScope: null }
  }

  const accessScope = await getAccessScope(supabase, userId)
  const { data, error } = await getOwnedRowById(
    supabase,
    'reports',
    reportId,
    userId,
    accessScope.scopedOrganizationIds,
    select,
    accessScope.scopedProjectIds,
    {
      projectIdColumn: 'project_id',
      restrictToAssignedProjects: accessScope.restrictToAssignedProjects,
    }
  )

  return { report: data || null, error, accessScope }
}
