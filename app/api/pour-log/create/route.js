import { createClient } from '@supabase/supabase-js'
import { recordAuditEvent } from '@/lib/audit-log'
import { getUserId } from '@/lib/get-user-id'
import { getCreateProjectContext } from '@/lib/project-access'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

function isMissingTremieColumnError(error) {
  const message = String(error?.message || error?.details || '')
  return message.includes('tremie_break_guide') || message.includes('schema cache')
}

export async function POST(request) {
  try {
    const user_id = await getUserId()
    if (!user_id) {
      return new Response('Unauthorized', { status: 401 })
    }

    const body = await request.json()

    const {
      project_id,
      project_name,
      log_date,
      weather,
      ambient_temp,
      concrete_supplier,
      submitted_by,
      photo_urls,
      foundations,
      tremie_break_guide,
      trucks
    } = body

    const { project, organizationId: organization_id, error: projectError } = await getCreateProjectContext(supabase, {
      userId: user_id,
      projectId: project_id,
    })
    if (project_id && (projectError || !project)) {
      return new Response('Project not found.', { status: 404 })
    }

    const logInsert = {
      project_id: project_id || null,
      project_name,
      log_date,
      weather,
      ambient_temp,
      concrete_supplier,
      submitted_by,
      photo_urls: photo_urls && photo_urls.length > 0 ? photo_urls : null,
      tremie_break_guide: tremie_break_guide || null,
      user_id,
      organization_id
    }

    let { data: pourLog, error: logError } = await supabase
      .from('pour_logs')
      .insert(logInsert)
      .select()
      .single()

    if (logError && isMissingTremieColumnError(logError)) {
      const { tremie_break_guide: _tremieBreakGuide, ...fallbackInsert } = logInsert
      const retry = await supabase
        .from('pour_logs')
        .insert(fallbackInsert)
        .select()
        .single()
      pourLog = retry.data
      logError = retry.error
    }

    if (logError) throw logError

    if (foundations && foundations.length > 0) {
      const { error: foundError } = await supabase
        .from('pour_log_foundations')
        .insert(
          foundations.map(f => ({
            pour_log_id: pourLog.id,
            foundation_id: f.foundation_id,
            total_depth: f.total_depth,
            actual_hole_depth: f.actual_hole_depth || null,
            estimated_yards: f.estimated_yards,
            shaft_diameter: f.shaft_diameter || null,
            anchor_bolt_projection: f.anchor_bolt_projection || null,
            notes: f.notes
          }))
        )
      if (foundError) throw foundError
    }

    if (trucks && trucks.length > 0) {
      const { error: truckError } = await supabase
        .from('pour_log_trucks')
        .insert(
          trucks.map(t => ({
            pour_log_id: pourLog.id,
            truck_number: t.truck_number,
            batch_time: t.batch_time || null,
            arrival_time: t.arrival_time,
            pour_start: t.pour_start,
            pour_complete: t.pour_complete,
            yards: t.yards,
            foundations_served: t.foundations_served,
            concrete_temp: t.concrete_temp,
            slump: t.slump,
            air_content: t.air_content,
            water_added: t.water_added,
            cylinders_cast: t.cylinders_cast,
            notes: t.notes
          }))
        )
      if (truckError) throw truckError
    }

    await recordAuditEvent(supabase, {
      organizationId: organization_id,
      actorUserId: user_id,
      entityType: 'pour_log',
      entityId: pourLog.id,
      action: 'create',
      metadata: {
        project_id,
        project_name,
        log_date,
        log_type: 'drilled_shaft',
      },
    })

    return Response.json({ id: pourLog.id })

  } catch (err) {
    console.error(err)
    return new Response('Something went wrong.', { status: 500 })
  }
}
