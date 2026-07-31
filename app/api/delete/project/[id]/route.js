import { createClient } from '@supabase/supabase-js'
import { recordAuditEvent } from '@/lib/audit-log'
import { getUserId } from '@/lib/get-user-id'
import {
  canManageOrganizationRole,
  getAccessScope,
  getOrganizationMembershipByOrgAndUser,
  getOwnedProjectById,
} from '@/lib/organizations'
import { isMissingRelationError } from '@/lib/supabase-errors'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export async function POST(request, { params }) {
  try {
    const userId = await getUserId()
    const accessScope = await getAccessScope(supabase, userId)
    const { data: project } = await getOwnedProjectById(
      supabase,
      userId,
      params.id,
      accessScope.scopedOrganizationIds,
      '*',
      accessScope.scopedProjectIds,
      { restrictToAssignedProjects: accessScope.restrictToAssignedProjects }
    )
    if (!project) {
      return new Response(JSON.stringify({ error: 'Project not found.' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    }

    const projectMembership = await getOrganizationMembershipByOrgAndUser(
      supabase,
      project.organization_id,
      userId
    )
    if (!canManageOrganizationRole(projectMembership)) {
      return new Response(JSON.stringify({ error: 'Owner access required.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Delete all related records first
    const { data: logs } = await supabase.from('pour_logs').select('id').eq('project_id', params.id)
    if (logs?.length) {
      const logIds = logs.map(l => l.id)
      await supabase.from('pour_log_foundations').delete().in('pour_log_id', logIds)
      await supabase.from('pour_log_trucks').delete().in('pour_log_id', logIds)
    }
    await supabase.from('pour_logs').delete().eq('project_id', params.id)
    await supabase.from('reports').delete().eq('project_id', params.id)
    await supabase.from('contractor_evaluations').delete().eq('project_id', params.id)
    const { error: qaFormsDeleteError } = await supabase.from('qa_forms').delete().eq('project_id', params.id)
    if (qaFormsDeleteError && !isMissingRelationError(qaFormsDeleteError)) {
      throw qaFormsDeleteError
    }
    await supabase.from('projects').delete().eq('id', params.id)

    await recordAuditEvent(supabase, {
      organizationId: project.organization_id,
      actorUserId: userId,
      entityType: 'project',
      entityId: params.id,
      action: 'delete',
      metadata: {
        project_name: project.project_name,
      },
    })

    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
