import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { recordAuditEvent } from '@/lib/audit-log'
import { getUserId } from '@/lib/get-user-id'
import {
  canManageOrganizationRole,
  getAccessScope,
  getOrganizationMembershipByOrgAndUser,
  getOwnedProjectById,
} from '@/lib/organizations'
import { parseProjectReportTypeSettings, saveProjectReportTypeSettings } from '@/lib/project-report-types'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

function nullableValue(value) {
  const normalized = String(value || '').trim()
  return normalized || null
}

export async function POST(request, { params }) {
  try {
    const formData = await request.formData()
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
      return new Response('Project not found.', { status: 404 })
    }

    const projectMembership = await getOrganizationMembershipByOrgAndUser(
      supabase,
      project.organization_id,
      userId
    )
    if (!canManageOrganizationRole(projectMembership)) {
      return NextResponse.redirect(new URL(`/projects/${params.id}`, request.url), 303)
    }

    const project_name = formData.get('project_name')
    const location = formData.get('location')
    const address = nullableValue(formData.get('address'))
    const client_name = nullableValue(formData.get('client_name'))
    const client_email = nullableValue(formData.get('client_email'))
    const start_date = formData.get('start_date') || null
    const notes = nullableValue(formData.get('notes'))
    const status = formData.get('status')
    const reportTypeSettings = parseProjectReportTypeSettings(formData)

    const { error } = await supabase
      .from('projects')
      .update({
        project_name,
        location,
        address,
        client_name,
        client_email,
        start_date,
        notes,
        status
      })
      .eq('id', params.id)

    if (error) throw error

    await saveProjectReportTypeSettings(supabase, params.id, reportTypeSettings)

    await recordAuditEvent(supabase, {
      organizationId: project.organization_id,
      actorUserId: userId,
      entityType: 'project',
      entityId: params.id,
      action: 'update',
      metadata: {
        project_name,
        status,
        report_type_settings: reportTypeSettings,
      },
    })

    return NextResponse.redirect(new URL(`/projects/${params.id}`, request.url), 303)

  } catch (err) {
    console.error(err)
    return new Response('Something went wrong. Please try again.', { status: 500 })
  }
}
