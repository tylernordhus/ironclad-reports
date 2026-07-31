import { createClient } from '@supabase/supabase-js'
import { requireMobileUser } from '@/lib/mobile-auth'
import { recordAuditEvent } from '@/lib/audit-log'
import {
  buildDailyReportUpdate,
  normalizeDailyReportPayload,
} from '@/lib/daily-reports'
import { getAccessibleReportById } from '@/lib/report-access'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export async function GET(request, { params }) {
  const mobileUser = await requireMobileUser(request)
  if (mobileUser.response) return mobileUser.response
  const user_id = mobileUser.userId

  const { report, error } = await getAccessibleReportById(supabase, { reportId: params.id, userId: user_id })

  if (error || !report) {
    return Response.json(
      { error: 'Report not found.' },
      {
        status: 404,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      }
    )
  }

  return Response.json(
    { report },
    {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    }
  )
}

async function updateMobileReport(request, { params }) {
  const mobileUser = await requireMobileUser(request)
  if (mobileUser.response) return mobileUser.response

  try {
    const userId = mobileUser.userId
    const { report: existing, error: existingError } = await getAccessibleReportById(supabase, { reportId: params.id, userId })

    if (existingError || !existing) {
      return Response.json(
        { error: 'Report not found.' },
        {
          status: 404,
          headers: { 'Cache-Control': 'no-store, max-age=0' },
        }
      )
    }

    const body = await request.json()
    const payload = normalizeDailyReportPayload(body, existing)

    const { data: report, error } = await supabase
      .from('reports')
      .update(buildDailyReportUpdate(payload))
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error

    await recordAuditEvent(supabase, {
      organizationId: existing.organization_id,
      actorUserId: userId,
      entityType: 'report',
      entityId: params.id,
      action: 'update',
      metadata: {
        route: 'mobile_report_update',
        project_id: report.project_id,
        project_name: report.project_name,
        report_date: report.report_date,
      },
      beforeState: existing,
      afterState: report,
    })

    return Response.json(
      { report },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  } catch (error) {
    console.error('mobile report update failed', error)
    return Response.json(
      { error: 'Could not update the daily report.' },
      { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  }
}

export async function PATCH(request, context) {
  return updateMobileReport(request, context)
}

export async function POST(request, context) {
  return updateMobileReport(request, context)
}
