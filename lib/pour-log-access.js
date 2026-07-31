import { getAccessScope, getOwnedRowById } from '@/lib/organizations'
import { sortTrucksByNumber } from '@/lib/truck-order'

export async function getAccessiblePourLogById(
  supabase,
  {
    logId,
    userId,
    select = '*',
  }
) {
  if (!userId || !logId) {
    return { log: null, error: null, accessScope: null }
  }

  const accessScope = await getAccessScope(supabase, userId)
  const { data, error } = await getOwnedRowById(
    supabase,
    'pour_logs',
    logId,
    userId,
    accessScope.scopedOrganizationIds,
    select,
    accessScope.scopedProjectIds,
    {
      projectIdColumn: 'project_id',
      restrictToAssignedProjects: accessScope.restrictToAssignedProjects,
    }
  )

  return { log: data || null, error, accessScope }
}

export async function getPourLogChildren(supabase, logId) {
  const [{ data: foundations }, { data: trucks }] = await Promise.all([
    supabase
      .from('pour_log_foundations')
      .select('*')
      .eq('pour_log_id', logId),
    supabase
      .from('pour_log_trucks')
      .select('*')
      .eq('pour_log_id', logId),
  ])

  return {
    foundations: foundations || [],
    trucks: sortTrucksByNumber(trucks),
  }
}
