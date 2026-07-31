import { createClient } from '@supabase/supabase-js'
import { recordAuditEvent } from '@/lib/audit-log'
import { getUserId } from '@/lib/get-user-id'
import { getAccessibleContractorEvaluationById } from '@/lib/contractor-eval-access'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export async function POST(request, { params }) {
  try {
    const userId = await getUserId()
    const { evaluation: eval_ } = await getAccessibleContractorEvaluationById(supabase, { evalId: params.id, userId })
    if (!eval_) {
      return new Response(JSON.stringify({ error: 'Contractor evaluation not found.' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    }

    const { error } = await supabase
      .from('contractor_evaluations')
      .delete()
      .eq('id', params.id)

    if (error) throw error

    await recordAuditEvent(supabase, {
      organizationId: eval_.organization_id,
      actorUserId: userId,
      entityType: 'contractor_evaluation',
      entityId: params.id,
      action: 'delete',
      metadata: {
        project_name: eval_.project_name,
        inspection_date: eval_.inspection_date,
      },
    })

    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
