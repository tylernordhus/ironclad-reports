import { isMissingColumnError, isMissingRelationError } from '@/lib/supabase-errors'

function workspaceNameFromUser(userId, email) {
  if (email) {
    const localPart = String(email).split('@')[0].trim()
    if (localPart) {
      return `${localPart} Workspace`
    }
  }

  return `Workspace ${String(userId || '').slice(0, 8)}`
}

export function normalizeOrganizationAccessRole(role) {
  const normalizedRole = String(role || '').trim().toLowerCase()

  if (normalizedRole === 'owner' || normalizedRole === 'admin') return 'owner'
  if (normalizedRole === 'member' || normalizedRole === 'inspector') return 'member'
  if (normalizedRole === 'viewer') return 'viewer'

  return 'viewer'
}

export function getMembershipAccessRole(membership) {
  return normalizeOrganizationAccessRole(membership?.access_role || membership?.role)
}

export function getLegacyMembershipRole(accessRole) {
  const normalizedRole = normalizeOrganizationAccessRole(accessRole)
  if (normalizedRole === 'owner') return 'owner'
  if (normalizedRole === 'viewer') return 'viewer'
  return 'inspector'
}

function decorateMembership(membership) {
  if (!membership) return null

  return {
    ...membership,
    access_role: getMembershipAccessRole(membership),
    organization_name: membership?.organizations?.name || 'Organization',
    organization_slug: membership?.organizations?.slug || null,
  }
}

async function runMembershipQuery(queryFactory) {
  const currentSelect = 'id, organization_id, user_id, role, access_role, is_active, mobile_access_enabled, created_at'
  const legacySelect = 'id, organization_id, user_id, role, is_active, mobile_access_enabled, created_at'

  let { data, error } = await queryFactory(currentSelect)

  if (error && isMissingColumnError(error)) {
    ;({ data, error } = await queryFactory(legacySelect))
  }

  if (error) {
    if (isMissingRelationError(error)) return []
    throw error
  }

  return (data || []).map(decorateMembership)
}

async function runSingleMembershipQuery(queryFactory) {
  const rows = await runMembershipQuery(queryFactory)
  return rows[0] || null
}

async function getOrganizationMembershipsForUser(supabase, userId) {
  if (!userId) return []

  return runMembershipQuery(selectFields =>
    supabase
      .from('organization_memberships')
      .select(`${selectFields}, organizations(id, name, slug)`)
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
  )
}

async function getStoredActiveOrganizationId(supabase, userId) {
  if (!userId) return null

  const { data, error } = await supabase
    .from('user_profiles')
    .select('active_organization_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    if (isMissingRelationError(error)) return null
    throw error
  }

  return data?.active_organization_id || null
}

export async function getCurrentOrganizationContext(supabase, userId) {
  if (!userId) {
    return {
      memberships: [],
      currentMembership: null,
      explicitMembership: null,
      accessibleOrganizationIds: [],
      scopedOrganizationIds: [],
      currentOrganizationId: null,
      currentOrganizationName: null,
      hasExplicitSelection: false,
    }
  }

  const memberships = await getOrganizationMembershipsForUser(supabase, userId)
  const accessibleOrganizationIds = [...new Set(memberships.map(row => row.organization_id).filter(Boolean))]
  const selectedOrganizationId = await getStoredActiveOrganizationId(supabase, userId)
  const explicitMembership = memberships.find(row => row.organization_id === selectedOrganizationId) || null
  const currentMembership = explicitMembership || memberships[0] || null

  return {
    memberships,
    currentMembership,
    explicitMembership,
    accessibleOrganizationIds,
    scopedOrganizationIds: explicitMembership ? [explicitMembership.organization_id] : accessibleOrganizationIds,
    currentOrganizationId: explicitMembership?.organization_id || null,
    currentOrganizationName: explicitMembership?.organization_name || null,
    hasExplicitSelection: Boolean(explicitMembership),
  }
}

export async function getAccessibleOrganizationIds(supabase, userId) {
  const context = await getCurrentOrganizationContext(supabase, userId)
  return context.scopedOrganizationIds
}

export async function getAccessScope(supabase, userId) {
  const context = await getCurrentOrganizationContext(supabase, userId)
  const currentAccessRole = getMembershipAccessRole(context.currentMembership)

  if (!userId || !context.currentMembership || currentAccessRole === 'owner') {
    return {
      ...context,
      currentAccessRole,
      scopedProjectIds: [],
      restrictToAssignedProjects: false,
    }
  }

  const safeOrgIds = normalizeScopeIds(context.scopedOrganizationIds)
  if (safeOrgIds.length === 0) {
    return {
      ...context,
      currentAccessRole,
      scopedProjectIds: [],
      restrictToAssignedProjects: false,
    }
  }

  const { data, error } = await supabase
    .from('project_memberships')
    .select('project_id')
    .eq('user_id', userId)
    .in('organization_id', safeOrgIds)

  if (error) {
    if (isMissingRelationError(error)) {
      return {
        ...context,
        currentAccessRole,
        scopedProjectIds: [],
        restrictToAssignedProjects: false,
      }
    }
    throw error
  }

  return {
    ...context,
    currentAccessRole,
    scopedProjectIds: [...new Set((data || []).map(row => row.project_id).filter(Boolean))],
    // Transitional behavior: if a member/viewer has no project assignments yet, keep legacy org-wide visibility
    // until an owner starts saving explicit project assignments for that user.
    restrictToAssignedProjects: (data || []).length > 0,
  }
}

export function canManageOrganizationRole(roleOrMembership) {
  const role = typeof roleOrMembership === 'string'
    ? normalizeOrganizationAccessRole(roleOrMembership)
    : getMembershipAccessRole(roleOrMembership)

  return role === 'owner'
}

export async function getPrimaryOrganizationMembership(supabase, userId) {
  const context = await getCurrentOrganizationContext(supabase, userId)
  return context.currentMembership
}

export async function getOrganizationMembers(supabase, organizationId) {
  if (!organizationId) return []

  return runMembershipQuery(selectFields =>
    supabase
      .from('organization_memberships')
      .select(selectFields)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true })
  )
}

export async function getOrganizationMembershipById(supabase, membershipId) {
  if (!membershipId) return null

  return runSingleMembershipQuery(selectFields =>
    supabase
      .from('organization_memberships')
      .select(selectFields)
      .eq('id', membershipId)
      .limit(1)
  )
}

export async function getOrganizationMembershipByOrgAndUser(supabase, organizationId, userId) {
  if (!organizationId || !userId) return null

  return runSingleMembershipQuery(selectFields =>
    supabase
      .from('organization_memberships')
      .select(selectFields)
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .limit(1)
  )
}

export async function findAuthUserByEmail(supabase, email) {
  const targetEmail = String(email || '').trim().toLowerCase()
  if (!targetEmail) return null

  let page = 1
  const perPage = 200

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) throw error

    const users = data?.users || []
    const matchingUser = users.find(user => String(user.email || '').trim().toLowerCase() === targetEmail)
    if (matchingUser) return matchingUser

    if (users.length < perPage) return null
    page += 1
  }
}

function normalizeScopeIds(ids) {
  return [...new Set((ids || []).filter(value => /^[a-zA-Z0-9-]+$/.test(String(value || ''))))]
}

export function applyOwnershipScope(query, userId, organizationIds = []) {
  const safeUserId = /^[a-zA-Z0-9-]+$/.test(String(userId || '')) ? String(userId) : ''
  const safeOrgIds = normalizeScopeIds(organizationIds)

  if (!safeUserId && safeOrgIds.length === 0) {
    return query.eq('user_id', '__no_user__')
  }

  if (safeOrgIds.length === 0) {
    return query.eq('user_id', safeUserId)
  }

  if (!safeUserId) {
    return query.in('organization_id', safeOrgIds)
  }

  return query.or(`user_id.eq.${safeUserId},organization_id.in.(${safeOrgIds.join(',')})`)
}

export function applyAccessScope(
  query,
  userId,
  organizationIds = [],
  projectIds = [],
  options = {}
) {
  const {
    projectIdColumn = 'project_id',
    restrictToAssignedProjects = false,
  } = options

  const safeProjectIds = normalizeScopeIds(projectIds)
  if (restrictToAssignedProjects) {
    if (safeProjectIds.length === 0) {
      return query.eq(projectIdColumn, '__no_project__')
    }

    return query.in(projectIdColumn, safeProjectIds)
  }

  let scopedQuery = applyOwnershipScope(query, userId, organizationIds)
  if (safeProjectIds.length === 0) {
    return scopedQuery
  }

  return scopedQuery
}

export async function getOrCreateDefaultOrganizationId(supabase, userId) {
  const accessibleIds = await getAccessibleOrganizationIds(supabase, userId)
  if (accessibleIds.length > 0) return accessibleIds[0]

  let userEmail = ''
  try {
    const { data } = await supabase.auth.admin.getUserById(userId)
    userEmail = data?.user?.email || ''
  } catch {}

  const { data: createdOrg, error: orgError } = await supabase
    .from('organizations')
    .insert({
      name: workspaceNameFromUser(userId, userEmail),
      created_by_user_id: userId,
    })
    .select('id')
    .single()

  if (orgError) throw orgError

  const { error: membershipError } = await supabase
    .from('organization_memberships')
    .insert({
      organization_id: createdOrg.id,
      user_id: userId,
      role: 'owner',
      access_role: 'owner',
      is_active: true,
      invited_by_user_id: userId,
    })

  if (membershipError) {
    if (isMissingColumnError(membershipError)) {
      const { error: legacyMembershipError } = await supabase
        .from('organization_memberships')
        .insert({
          organization_id: createdOrg.id,
          user_id: userId,
          role: 'owner',
          is_active: true,
          invited_by_user_id: userId,
        })

      if (legacyMembershipError) throw legacyMembershipError
    } else {
      throw membershipError
    }
  }

  return createdOrg.id
}

export async function getOrganizationIdForProject(supabase, userId, projectId) {
  if (!projectId) {
    return getOrCreateDefaultOrganizationId(supabase, userId)
  }

  const { data, error } = await supabase
    .from('projects')
    .select('organization_id, user_id')
    .eq('id', projectId)
    .single()

  if (error) {
    if (isMissingRelationError(error)) return null
    throw error
  }

  if (data?.organization_id) {
    return data.organization_id
  }

  return null
}

export async function getOwnedProjectById(
  supabase,
  userId,
  projectId,
  organizationIds = [],
  select = '*',
  projectIds = [],
  options = {}
) {
  return getOwnedRowById(
    supabase,
    'projects',
    projectId,
    userId,
    organizationIds,
    select,
    projectIds,
    { projectIdColumn: 'id', ...options }
  )
}

export async function getOwnedRowById(
  supabase,
  tableName,
  rowId,
  userId,
  organizationIds = [],
  select = '*',
  projectIds = [],
  options = {}
) {
  if (!rowId) return { data: null, error: null }

  let query = supabase
    .from(tableName)
    .select(select)
    .eq('id', rowId)

  query = applyAccessScope(query, userId, organizationIds, projectIds, {
    projectIdColumn: options.projectIdColumn || 'id',
    restrictToAssignedProjects: options.restrictToAssignedProjects || false,
  })

  return query.single()
}

export async function getOrganizationProjects(supabase, organizationId) {
  if (!organizationId) return []

  const { data: orgProjects, error } = await supabase
    .from('projects')
    .select('id, project_name, status, organization_id')
    .eq('organization_id', organizationId)
    .order('project_name', { ascending: true })

  if (error) {
    if (isMissingRelationError(error)) return []
    throw error
  }

  const { data: members, error: membersError } = await supabase
    .from('organization_memberships')
    .select('user_id')
    .eq('organization_id', organizationId)
    .eq('is_active', true)

  if (membersError) {
    if (isMissingRelationError(membersError)) return orgProjects || []
    throw membersError
  }

  const memberUserIds = [...new Set((members || []).map((row) => row.user_id).filter(Boolean))]
  if (memberUserIds.length === 0) return orgProjects || []

  const { data: legacyProjects, error: legacyError } = await supabase
    .from('projects')
    .select('id, project_name, status, organization_id')
    .in('user_id', memberUserIds)
    .is('organization_id', null)
    .order('project_name', { ascending: true })

  if (legacyError) {
    if (isMissingRelationError(legacyError)) return orgProjects || []
    throw legacyError
  }

  const combined = [...(orgProjects || []), ...(legacyProjects || [])]
  const deduped = Array.from(new Map(combined.map((project) => [project.id, project])).values())

  return deduped.sort((a, b) => String(a.project_name || '').localeCompare(String(b.project_name || '')))
}

export async function getProjectAssignmentsForOrganization(supabase, organizationId) {
  if (!organizationId) return {}

  const { data, error } = await supabase
    .from('project_memberships')
    .select('user_id, project_id')
    .eq('organization_id', organizationId)

  if (error) {
    if (isMissingRelationError(error)) return {}
    throw error
  }

  const assignments = {}
  for (const row of data || []) {
    if (!assignments[row.user_id]) assignments[row.user_id] = []
    assignments[row.user_id].push(row.project_id)
  }

  return assignments
}

export async function replaceProjectAssignmentsForUser(
  supabase,
  {
    organizationId,
    userId,
    accessRole,
    projectIds = [],
    assignedByUserId = null,
  }
) {
  if (!organizationId || !userId) return

  const normalizedRole = normalizeOrganizationAccessRole(accessRole)
  const safeProjectIds = normalizeScopeIds(projectIds)

  const { error: deleteError } = await supabase
    .from('project_memberships')
    .delete()
    .eq('organization_id', organizationId)
    .eq('user_id', userId)

  if (deleteError && !isMissingRelationError(deleteError)) {
    throw deleteError
  }

  if (normalizedRole === 'owner' || safeProjectIds.length === 0) return

  const { error: insertError } = await supabase
    .from('project_memberships')
    .insert(
      safeProjectIds.map(projectId => ({
        organization_id: organizationId,
        project_id: projectId,
        user_id: userId,
        access_role: normalizedRole === 'viewer' ? 'viewer' : 'member',
        assigned_by_user_id: assignedByUserId,
      }))
    )

  if (insertError && !isMissingRelationError(insertError)) {
    throw insertError
  }
}
