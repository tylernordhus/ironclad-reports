import { createClient } from '@supabase/supabase-js'
import { recordAuditEvent } from '@/lib/audit-log'
import { getUserId } from '@/lib/get-user-id'
import { getAccessibleReportById } from '@/lib/report-access'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export async function POST(request, { params }) {
  try {
    const userId = await getUserId()
    const { report } = await getAccessibleReportById(supabase, { reportId: params.id, userId })
    if (!report) {
      return new Response(JSON.stringify({ error: 'Report not found.' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    }

    const { error } = await supabase
      .from('reports')
      .delete()
      .eq('id', params.id)

    if (error) throw error

    await recordAuditEvent(supabase, {
      organizationId: report.organization_id,
      actorUserId: userId,
      entityType: 'report',
      entityId: params.id,
      action: 'delete',
      metadata: {
        project_id: report.project_id,
        project_name: report.project_name,
      },
    })

    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
