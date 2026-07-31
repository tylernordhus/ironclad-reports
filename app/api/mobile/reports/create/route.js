import { createClient } from '@supabase/supabase-js'
import { requireMobileUser } from '@/lib/mobile-auth'
import { getCreateProjectContext } from '@/lib/project-access'
import { recordAuditEvent } from '@/lib/audit-log'
import {
  buildDailyReportInsert,
  normalizeDailyReportPayload,
} from '@/lib/daily-reports'

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
    const userId = mobileUser.userId
    const payload = normalizeDailyReportPayload(body)
    const projectId = payload.project_id
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

    const { data: inserted, error } = await supabase
      .from('reports')
      .insert(buildDailyReportInsert(payload, {
        userId,
        organizationId,
      }))
      .select('id')
      .single()

    if (error) throw error

    await recordAuditEvent(supabase, {
      organizationId,
      actorUserId: userId,
      entityType: 'report',
      entityId: inserted.id,
      action: 'create',
      metadata: {
        route: 'mobile_report_create',
        project_id: projectId,
        project_name: payload.project_name,
        report_date: payload.report_date,
      },
    })

    return Response.json(
      { id: inserted.id },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  } catch (error) {
    console.error('mobile report create failed', error)
    return Response.json(
      { error: 'Could not create the daily report.' },
      { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  }
}
