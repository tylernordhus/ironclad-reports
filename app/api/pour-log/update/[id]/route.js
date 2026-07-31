import { createClient } from '@supabase/supabase-js'
import { recordAuditEvent } from '@/lib/audit-log'
import { getUserId } from '@/lib/get-user-id'
import { getAccessiblePourLogById } from '@/lib/pour-log-access'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

function asRequiredText(value) {
  return String(value ?? '').trim()
}

function asOptionalText(value) {
  const text = String(value ?? '').trim()
  return text ? text : null
}

function asText(value) {
  return String(value ?? '').trim()
}

function isMissingTremieColumnError(error) {
  const message = String(error?.message || error?.details || '')
  return message.includes('tremie_break_guide') || message.includes('schema cache')
}

export async function POST(request, { params }) {
  try {
    const userId = await getUserId()
    const { log } = await getAccessiblePourLogById(supabase, { logId: params.id, userId })
    if (!log) {
      return Response.json({ error: 'Pour log not found.' }, { status: 404 })
    }

    const body = await request.json()
    const isAutosave = body.autosave === true
    const project_name = asRequiredText(body.project_name)
    const log_date = asRequiredText(body.log_date)
    const weather = asOptionalText(body.weather)
    const ambient_temp = asOptionalText(body.ambient_temp)
    const concrete_supplier = asOptionalText(body.concrete_supplier)
    const submitted_by = asRequiredText(body.submitted_by)
    const tremie_break_guide = body.tremie_break_guide && typeof body.tremie_break_guide === 'object'
      ? body.tremie_break_guide
      : null
    const foundations = Array.isArray(body.foundations) ? body.foundations : []
    const trucks = Array.isArray(body.trucks) ? body.trucks : []
    const photoUrls = Array.isArray(body.photo_urls)
      ? body.photo_urls.filter(url => typeof url === 'string' && url.trim())
      : []
    const photoLabels = photoUrls.map((_, index) => asText(body.photo_labels?.[index]))

    const normalizedFoundations = foundations
      .map(f => ({
        foundation_id: asRequiredText(f.foundation_id),
        total_depth: asOptionalText(f.total_depth),
        actual_hole_depth: asOptionalText(f.actual_hole_depth),
        estimated_yards: asOptionalText(f.estimated_yards),
        shaft_diameter: asOptionalText(f.shaft_diameter),
        anchor_bolt_projection: asOptionalText(f.anchor_bolt_projection),
        notes: asOptionalText(f.notes),
      }))
      .filter(f => f.foundation_id || f.total_depth || f.actual_hole_depth || f.estimated_yards || f.shaft_diameter || f.anchor_bolt_projection || f.notes)

    if (normalizedFoundations.some(f => !f.foundation_id)) {
      return Response.json({ error: 'Each foundation must have a shaft ID.' }, { status: 400 })
    }

    const normalizedTrucks = trucks.map((t, index) => ({
      truck_number: asRequiredText(t.truck_number) || String(index + 1),
      batch_time: asOptionalText(t.batch_time),
      arrival_time: asOptionalText(t.arrival_time),
      pour_start: asOptionalText(t.pour_start),
      pour_complete: asOptionalText(t.pour_complete),
      yards: asOptionalText(t.yards),
      foundations_served: asOptionalText(t.foundations_served),
      concrete_temp: asOptionalText(t.concrete_temp),
      slump: asOptionalText(t.slump),
      air_content: asOptionalText(t.air_content),
      water_added: asOptionalText(t.water_added),
      cylinders_cast: asOptionalText(t.cylinders_cast),
      notes: asOptionalText(t.notes),
    }))

    const logUpdate = {
      project_name,
      log_date,
      weather,
      ambient_temp,
      concrete_supplier,
      submitted_by,
      photo_urls: photoUrls.length > 0 ? photoUrls : null,
      photo_labels: photoUrls.length > 0 ? photoLabels : null,
      tremie_break_guide,
    }

    let { error: logError } = await supabase
      .from('pour_logs')
      .update(logUpdate)
      .eq('id', params.id)

    if (logError && isMissingTremieColumnError(logError)) {
      const { tremie_break_guide: _tremieBreakGuide, ...fallbackUpdate } = logUpdate
      const retry = await supabase
        .from('pour_logs')
        .update(fallbackUpdate)
        .eq('id', params.id)
      logError = retry.error
    }

    if (logError) throw logError

    const { error: deleteFoundationsError } = await supabase
      .from('pour_log_foundations')
      .delete()
      .eq('pour_log_id', params.id)

    if (deleteFoundationsError) throw deleteFoundationsError

    if (normalizedFoundations.length > 0) {
      const { error: insertFoundationsError } = await supabase
        .from('pour_log_foundations')
        .insert(
          normalizedFoundations.map(f => ({
            pour_log_id: params.id,
            foundation_id: f.foundation_id,
            total_depth: f.total_depth,
            actual_hole_depth: f.actual_hole_depth,
            estimated_yards: f.estimated_yards,
            shaft_diameter: f.shaft_diameter,
            anchor_bolt_projection: f.anchor_bolt_projection,
            notes: f.notes,
          }))
        )

      if (insertFoundationsError) throw insertFoundationsError
    }

    const { error: deleteTrucksError } = await supabase
      .from('pour_log_trucks')
      .delete()
      .eq('pour_log_id', params.id)

    if (deleteTrucksError) throw deleteTrucksError

    if (normalizedTrucks.length > 0) {
      const { error: insertTrucksError } = await supabase
        .from('pour_log_trucks')
        .insert(
          normalizedTrucks.map(t => ({
            pour_log_id: params.id,
            truck_number: t.truck_number,
            batch_time: t.batch_time,
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
            notes: t.notes,
          }))
        )

      if (insertTrucksError) throw insertTrucksError
    }

    if (!isAutosave) {
      await recordAuditEvent(supabase, {
        organizationId: log.organization_id,
        actorUserId: userId,
        entityType: 'pour_log',
        entityId: params.id,
        action: 'update',
        metadata: {
          project_name,
          log_date,
          log_type: 'drilled_shaft',
        },
      })
    }

    return Response.json({ success: true })
  } catch (err) {
    console.error(err)
    return Response.json({ error: err.message || 'Something went wrong.' }, { status: 500 })
  }
}
