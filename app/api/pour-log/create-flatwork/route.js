import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export async function POST(request) {
  try {
    const body = await request.json()

    const {
      project_id,
      project_name,
      log_date,
      log_type,
      weather,
      ambient_temp,
      concrete_supplier,
      submitted_by,
      area_location,
      square_footage,
      thickness,
      total_yards,
      finish_type,
      general_notes,
      photo_urls,
      trucks
    } = body

    const { data: pourLog, error: logError } = await supabase
      .from('pour_logs')
      .insert({
        project_id: project_id || null,
        project_name,
        log_date,
        log_type: 'flatwork',
        weather,
        ambient_temp,
        concrete_supplier,
        submitted_by,
        area_location,
        square_footage,
        thickness,
        total_yards,
        finish_type,
        general_notes,
        photo_urls: photo_urls && photo_urls.length > 0 ? photo_urls : null
      })
      .select()
      .single()

    if (logError) throw logError

    if (trucks && trucks.length > 0) {
      const { error: truckError } = await supabase
        .from('pour_log_trucks')
        .insert(
          trucks.map(t => ({
            pour_log_id: pourLog.id,
            truck_number: t.truck_number,
            arrival_time: t.arrival_time,
            pour_start: t.pour_start,
            pour_complete: t.pour_complete,
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

    return Response.json({ id: pourLog.id })

  } catch (err) {
    console.error(err)
    return new Response('Something went wrong.', { status: 500 })
  }
}
