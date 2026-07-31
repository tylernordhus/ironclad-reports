import { createClient } from '@supabase/supabase-js'
import { requireMobileUser } from '@/lib/mobile-auth'
import { getCreateProjectContext } from '@/lib/project-access'
import { recordAuditEvent } from '@/lib/audit-log'

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
    const projectId = body?.project_id || null
    const userId = mobileUser.userId
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

    const { data: created, error } = await supabase
      .from('contractor_evaluations')
      .insert({
        project_id: projectId,
        organization_id: organizationId,
        user_id: userId,
        inspector_name: body?.inspector_name || '',
        inspection_date: body?.inspection_date || null,
        inspection_location: body?.inspection_location || '',
        contractor_name: body?.contractor_name || '',
        project_name: body?.project_name || '',
        supervisor_name: body?.supervisor_name || '',
        ppe_compliant: body?.ppe_compliant ?? null,
        safety_signs: body?.safety_signs ?? null,
        emergency_procedures: body?.emergency_procedures ?? null,
        safety_comments: body?.safety_comments || '',
        work_specs: body?.work_specs ?? null,
        materials_quality: body?.materials_quality ?? null,
        workmanship: body?.workmanship ?? null,
        work_quality_comments: body?.work_quality_comments || '',
        on_schedule: body?.on_schedule ?? null,
        milestones_met: body?.milestones_met ?? null,
        timeliness_comments: body?.timeliness_comments || '',
        contractor_responsive: body?.contractor_responsive ?? null,
        progress_reports: body?.progress_reports ?? null,
        communication_comments: body?.communication_comments || '',
        regulations_compliant: body?.regulations_compliant ?? null,
        permits_current: body?.permits_current ?? null,
        compliance_comments: body?.compliance_comments || '',
        env_impact_minimized: body?.env_impact_minimized ?? null,
        waste_disposal: body?.waste_disposal ?? null,
        environmental_comments: body?.environmental_comments || '',
        overall_rating: body?.overall_rating || '',
        overall_comments: body?.overall_comments || '',
        inspector_signature: body?.inspector_signature || '',
        signature_date: body?.signature_date || null,
      })
      .select('id')
      .single()

    if (error) throw error

    await recordAuditEvent(supabase, {
      organizationId,
      actorUserId: userId,
      entityType: 'contractor_evaluation',
      entityId: created.id,
      action: 'create',
      metadata: {
        route: 'mobile_contractor_eval_create',
        project_id: projectId,
        project_name: body?.project_name || '',
        inspection_date: body?.inspection_date || null,
      },
    })

    return Response.json(
      { id: created.id },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  } catch (error) {
    console.error('mobile contractor eval create failed', error)
    return Response.json(
      { error: 'Could not create the contractor evaluation.' },
      { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  }
}
