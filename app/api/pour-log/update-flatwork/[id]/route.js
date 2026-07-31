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
      return Response.json({ error: 'Pour log not found.' }, { status: 404 })
    }

    const body = await request.json()
    const isAutosave = body.autosave === true
    const {
      project_name, log_date, weather, ambient_temp, concrete_supplier,
      submitted_by, area_location, square_footage, thickness,
      total_yards, finish_type, general_notes, trucks
    } = body

    const { error: logError } = await supabase
      .from('pour_logs')
      .update({
        project_name, log_date, weather, ambient_temp, concrete_supplier,
        submitted_by, area_location, square_footage, thickness,
        total_yards, finish_type, general_notes
      })
      .eq('id', params.id)

    if (logError) throw logError

    // Replace trucks
    const { error: deleteTrucksError } = await supabase
      .from('pour_log_trucks')
      .delete()
      .eq('pour_log_id', params.id)

    if (deleteTrucksError) throw deleteTrucksError

    if (trucks && trucks.length > 0) {
      const { error: truckError } = await supabase.from('pour_log_trucks').insert(
        trucks.map(t => ({
          pour_log_id: params.id,
          truck_number: t.truck_number,
          batch_time: t.batch_time || null,
          arrival_time: t.arrival_time || null,
          pour_start: t.pour_start || null,
          pour_complete: t.pour_complete || null,
          yards: t.yards,
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
          log_type: 'flatwork',
        },
      })
    }

    return Response.json({ success: true })
  } catch (err) {
    console.error(err)
    return Response.json({ error: err.message || 'Something went wrong.' }, { status: 500 })
  }
}
