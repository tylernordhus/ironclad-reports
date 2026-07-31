import { createClient } from '@supabase/supabase-js'
import { recordAuditEvent } from '@/lib/audit-log'
import { getUserId } from '@/lib/get-user-id'
import { getAccessibleQaFormById } from '@/lib/qa-form-access'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export async function POST(request, { params }) {
  try {
    const userId = await getUserId()
    const { qaForm } = await getAccessibleQaFormById(supabase, { formId: params.id, userId })
    if (!qaForm) {
      return Response.json({ error: 'QA form not found.' }, { status: 404 })
    }

    const { error } = await supabase
      .from('qa_forms')
      .delete()
      .eq('id', params.id)

    if (error) throw error

    await recordAuditEvent(supabase, {
      organizationId: qaForm.organization_id,
      actorUserId: userId,
      entityType: 'qa_form',
      entityId: params.id,
      action: 'delete',
      metadata: {
        project_name: qaForm.project_name,
        form_type: qaForm.form_type,
        work_date: qaForm.work_date,
      },
    })

    return Response.json({ ok: true })
  } catch (error) {
    console.error('QA form delete failed:', error)
    return Response.json({ error: 'Could not delete the QA form.' }, { status: 500 })
  }
}
