import { createClient } from '@supabase/supabase-js'
import { recordAuditEvent } from '@/lib/audit-log'
import { getUserId } from '@/lib/get-user-id'
import { getCreateProjectContext } from '@/lib/project-access'
import { getAccessibleQaFormById } from '@/lib/qa-form-access'
import { validateQaFormPayload } from '@/lib/qa-forms'
import { isMissingRelationError } from '@/lib/supabase-errors'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export async function POST(request, { params }) {
  try {
    const userId = await getUserId()
    if (!userId) {
      return Response.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    const { qaForm: existing } = await getAccessibleQaFormById(supabase, { formId: params.id, userId })
    if (!existing) {
      return Response.json({ error: 'QA form not found.' }, { status: 404 })
    }

    const body = await request.json()
    const validationError = validateQaFormPayload(body)
    if (validationError) {
      return Response.json({ error: validationError }, { status: 400 })
    }
    const projectId = body.project_id || null
    const { project, organizationId, error: projectError } = await getCreateProjectContext(supabase, {
      userId,
      projectId,
    })
    if (projectId && (projectError || !project)) {
      return Response.json({ error: 'Project not found.' }, { status: 404 })
    }

    const { data, error } = await supabase
      .from('qa_forms')
      .update({
        project_id: body.project_id || null,
        project_name: body.project_name,
        form_type: body.form_type,
        work_date: body.work_date || null,
        submitted_by: body.submitted_by || null,
        form_data: body.form_data || {},
        photo_urls: Array.isArray(body.photo_urls) ? body.photo_urls : [],
        photo_labels: Array.isArray(body.photo_labels) ? body.photo_labels : [],
        organization_id: organizationId,
      })
      .eq('id', params.id)
      .select('id')
      .single()

    if (error) {
      if (isMissingRelationError(error)) {
        return Response.json({ error: 'QA forms database table is missing. Run sql/qa-forms.sql first.' }, { status: 400 })
      }
      throw error
    }

    await recordAuditEvent(supabase, {
      organizationId,
      actorUserId: userId,
      entityType: 'qa_form',
      entityId: params.id,
      action: 'update',
      metadata: {
        project_name: body.project_name,
        form_type: body.form_type,
        work_date: body.work_date || null,
      },
    })

    return Response.json({ id: data.id })
  } catch (error) {
    console.error('QA form update failed:', error)
    return Response.json({ error: 'Could not update the QA form.' }, { status: 500 })
  }
}
