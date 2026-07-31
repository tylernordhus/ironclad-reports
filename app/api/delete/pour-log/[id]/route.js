import { createClient } from '@supabase/supabase-js'
import { recordAuditEvent } from '@/lib/audit-log'
import { getUserId } from '@/lib/get-user-id'
import { getAccessiblePourLogById } from '@/lib/pour-log-access'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export async function POST(request, { params }) {
  try {
    const userId = await getUserId()
    const { log } = await getAccessiblePourLogById(supabase, { logId: params.id, userId })
    if (!log) {
      return new Response(JSON.stringify({ error: 'Pour log not found.' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    }

    await supabase.from('pour_log_foundations').delete().eq('pour_log_id', params.id)
    await supabase.from('pour_log_trucks').delete().eq('pour_log_id', params.id)

    const { error } = await supabase
      .from('pour_logs')
      .delete()
      .eq('id', params.id)

    if (error) throw error

    await recordAuditEvent(supabase, {
      organizationId: log.organization_id,
      actorUserId: userId,
      entityType: 'pour_log',
      entityId: params.id,
      action: 'delete',
      metadata: {
        project_id: log.project_id,
        project_name: log.project_name,
        log_date: log.log_date,
      },
    })

    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
