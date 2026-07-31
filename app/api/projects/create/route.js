import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { recordAuditEvent } from '@/lib/audit-log'
import { getUserId } from '@/lib/get-user-id'
import {
  canManageOrganizationRole,
  getOrCreateDefaultOrganizationId,
  getPrimaryOrganizationMembership,
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

export async function POST(request) {
  try {
    const formData = await request.formData()
    const user_id = await getUserId()
    if (!user_id) {
      return NextResponse.redirect(new URL('/login', request.url), 303)
    }

    const currentMembership = await getPrimaryOrganizationMembership(supabase, user_id)

    if (currentMembership && !canManageOrganizationRole(currentMembership)) {
      return NextResponse.redirect(new URL('/projects', request.url), 303)
    }

    const organization_id = await getOrCreateDefaultOrganizationId(supabase, user_id)

    const project_name = formData.get('project_name')
    const location = formData.get('location')
    const address = nullableValue(formData.get('address'))
    const client_name = nullableValue(formData.get('client_name'))
    const client_email = nullableValue(formData.get('client_email'))
    const start_date = formData.get('start_date') || null
    const notes = nullableValue(formData.get('notes'))
    const status = formData.get('status')
    const reportTypeSettings = parseProjectReportTypeSettings(formData)

    const { data, error } = await supabase
      .from('projects')
      .insert({
        project_name,
        location,
        address,
        client_name,
        client_email,
        start_date,
        notes,
        status,
        user_id,
        organization_id
      })
      .select()
      .single()

    if (error) throw error

    await saveProjectReportTypeSettings(supabase, data.id, reportTypeSettings)

    await recordAuditEvent(supabase, {
      organizationId: organization_id,
      actorUserId: user_id,
      entityType: 'project',
      entityId: data.id,
      action: 'create',
      metadata: {
        project_name,
        status,
        report_type_settings: reportTypeSettings,
      },
    })

    return NextResponse.redirect(new URL(`/projects/${data.id}`, request.url), 303)

  } catch (err) {
    console.error(err)
    return new Response('Something went wrong. Please try again.', { status: 500 })
  }
}
