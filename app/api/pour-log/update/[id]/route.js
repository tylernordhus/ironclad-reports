import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export async function POST(request, { params }) {
  try {
    const body = await request.json()
    const { project_name, log_date, weather, ambient_temp, concrete_supplier, submitted_by, foundations, trucks } = body

    const { error: logError } = await supabase
      .from('pour_logs')
      .update({ project_name, log_date, weather, ambient_temp, concrete_supplier, submitted_by })
      .eq('id', params.id)

    if (logError) throw logError

    // Replace foundations
    await supabase.from('pour_log_foundations').delete().eq('pour_log_id', params.id)
    if (foundations && foundations.length > 0) {
      const { error: foundError } = await supabase.from('pour_log_foundations').insert(
        foundations.map(f => ({
          pour_log_id: params.id,
          foundation_id: f.foundation_id,
          total_depth: f.total_depth,
          estimated_yards: f.estimated_yards,
          notes: f.notes
        }))
      )
      if (foundError) throw foundError
    }

    // Replace trucks
    await supabase.from('pour_log_trucks').delete().eq('pour_log_id', params.id)
    if (trucks && trucks.length > 0) {
      const { error: truckError } = await supabase.from('pour_log_trucks').insert(
        trucks.map(t => ({
          pour_log_id: params.id,
          truck_number: t.truck_number,
          arrival_time: t.arrival_time || null,
          pour_start: t.pour_start || null,
          pour_complete: t.pour_complete || null,
          yards: t.yards,
          foundations_served: t.foundations_served,
          depth_reading: t.depth_reading,
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

    return Response.json({ success: true })
  } catch (err) {
    console.error(err)
    return new Response('Something went wrong.', { status: 500 })
  }
}
