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

function asArray(value) {
  return Array.isArray(value) ? value : []
}

export async function POST(request) {
  const mobileUser = await requireMobileUser(request)
  if (mobileUser.response) return mobileUser.response

  try {
    const body = await request.json()
    const userId = mobileUser.userId
    const projectId = body?.project_id || null
    const logType = body?.log_type === 'flatwork' ? 'flatwork' : 'drilled_shaft'
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

    const { data: pourLog, error: logError } = await supabase
      .from('pour_logs')
      .insert({
        project_id: projectId,
        project_name: body?.project_name || '',
        log_date: body?.log_date || null,
        log_type: logType === 'flatwork' ? 'flatwork' : null,
        weather: body?.weather || '',
        ambient_temp: body?.ambient_temp || '',
        concrete_supplier: body?.concrete_supplier || '',
        submitted_by: body?.submitted_by || '',
        photo_urls: Array.isArray(body?.photo_urls) && body.photo_urls.length > 0 ? body.photo_urls : null,
        user_id: userId,
        organization_id: organizationId,
      })
      .select('id')
      .single()

    if (logError) throw logError

    if (logType === 'flatwork') {
      const sections = asArray(body?.sections)
      if (sections.length > 0) {
        const { error: sectionsError } = await supabase
          .from('pour_log_foundations')
          .insert(
            sections.map((section) => ({
              pour_log_id: pourLog.id,
              foundation_id: section.foundation_id || '',
              finish_type: section.section_type || 'Slab',
              square_footage: section.square_footage || null,
              total_depth: section.total_depth || null,
              estimated_yards: section.estimated_yards || null,
              notes: section.notes || null,
            }))
          )
        if (sectionsError) throw sectionsError
      }
    } else {
      const foundations = asArray(body?.foundations)
      if (foundations.length > 0) {
        const { error: foundError } = await supabase
          .from('pour_log_foundations')
          .insert(
            foundations.map((foundation) => ({
              pour_log_id: pourLog.id,
              foundation_id: foundation.foundation_id || '',
              total_depth: foundation.total_depth || null,
              actual_hole_depth: foundation.actual_hole_depth || null,
              estimated_yards: foundation.estimated_yards || null,
              shaft_diameter: foundation.shaft_diameter || null,
              anchor_bolt_projection: foundation.anchor_bolt_projection || null,
              notes: foundation.notes || null,
            }))
          )
        if (foundError) throw foundError
      }
    }

    const trucks = asArray(body?.trucks)
    if (trucks.length > 0) {
      const { error: truckError } = await supabase
        .from('pour_log_trucks')
        .insert(
          trucks.map((truck) => ({
            pour_log_id: pourLog.id,
            truck_number: truck.truck_number || '',
            batch_time: truck.batch_time || null,
            arrival_time: truck.arrival_time || null,
            pour_start: truck.pour_start || null,
            pour_complete: truck.pour_complete || null,
            yards: truck.yards || null,
            foundations_served: truck.foundations_served || null,
            concrete_temp: truck.concrete_temp || null,
            slump: truck.slump || null,
            air_content: truck.air_content || null,
            water_added: truck.water_added || null,
            cylinders_cast: truck.cylinders_cast || null,
            notes: truck.notes || null,
          }))
        )
      if (truckError) throw truckError
    }

    await recordAuditEvent(supabase, {
      organizationId,
      actorUserId: userId,
      entityType: 'pour_log',
      entityId: pourLog.id,
      action: 'create',
      metadata: {
        route: 'mobile_pour_log_create',
        project_id: projectId,
        project_name: body?.project_name || '',
        log_date: body?.log_date || null,
        log_type: logType,
      },
    })

    return Response.json(
      { id: pourLog.id },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  } catch (error) {
    console.error('mobile pour log create failed', error)
    return Response.json(
      { error: 'Could not create the pour log.' },
      { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  }
}
