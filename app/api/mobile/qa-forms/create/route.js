import { createClient } from '@supabase/supabase-js'
import { requireMobileUser } from '@/lib/mobile-auth'
import { getCreateProjectContext } from '@/lib/project-access'
import { validateQaFormPayload } from '@/lib/qa-forms'
import { recordAuditEvent } from '@/lib/audit-log'
import { isMissingRelationError } from '@/lib/supabase-errors'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export async function POST(request) {
  const mobileUser = await requireMobileUser(request)
  if (mobileUser.response) return mobileUser.response

  try {
    const body = await request.json()
    const validationError = validateQaFormPayload(body)
    if (validationError) {
      return Response.json(
        { error: validationError },
        { status: 400, headers: { 'Cache-Control': 'no-store, max-age=0' } }
      )
    }

    const userId = mobileUser.userId
    const projectId = body.project_id || null
    const { project, organizationId, error: projectError } = await getCreateProjectContext(supabase, {
      userId,
      projectId,
    })
    if (projectId && (projectError || !project)) {
      return Response.json(
        { error: 'Project not found.' },
        { status: 404, headers: { 'Cache-Control': 'no-store, max-age=0' } }
      )
    }

    const { data, error } = await supabase
      .from('qa_forms')
      .insert({
        project_id: body.project_id || null,
        project_name: body.project_name,
        form_type: body.form_type,
        work_date: body.work_date || null,
        submitted_by: body.submitted_by || null,
        form_data: body.form_data || {},
        photo_urls: [],
        photo_labels: [],
        user_id: userId,
        organization_id: organizationId,
      })
      .select('id')
      .single()

    if (error) {
      if (isMissingRelationError(error)) {
        return Response.json(
          { error: 'QA forms database table is missing. Run sql/qa-forms.sql first.' },
          { status: 400, headers: { 'Cache-Control': 'no-store, max-age=0' } }
        )
      }
      throw error
    }

    await recordAuditEvent(supabase, {
      organizationId,
      actorUserId: userId,
      entityType: 'qa_form',
      entityId: data.id,
      action: 'create',
      metadata: {
        route: 'mobile_qa_form_create',
        project_name: body.project_name,
        form_type: body.form_type,
        work_date: body.work_date || null,
      },
    })

    return Response.json(
      { id: data.id },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  } catch (error) {
    console.error('mobile qa form create failed', error)
    return Response.json(
      { error: 'Could not create the QA form.' },
      { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  }
}
