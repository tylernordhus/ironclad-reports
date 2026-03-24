import { createClient } from '@supabase/supabase-js'
import { getUserId } from '@/lib/get-user-id'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export async function POST(request) {
  try {
    const user_id = await getUserId()
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
      photo_urls,
      sections,
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
        photo_urls: photo_urls && photo_urls.length > 0 ? photo_urls : null,
        user_id
      })
      .select()
      .single()

    if (logError) throw logError

    if (sections && sections.length > 0) {
      const { error: sectionsError } = await supabase
        .from('pour_log_foundations')
        .insert(
          sections.map(s => ({
            pour_log_id: pourLog.id,
            foundation_id: s.foundation_id,
            finish_type: s.section_type,      // 'Slab' or 'Spread Footer'
            square_footage: s.square_footage || null,
            total_depth: s.total_depth || null,  // thickness
            estimated_yards: s.estimated_yards || null,
            notes: s.notes || null
          }))
        )
      if (sectionsError) throw sectionsError
    }

    if (trucks && trucks.length > 0) {
      const { error: truckError } = await supabase
        .from('pour_log_trucks')
        .insert(
          trucks.map(t => ({
            pour_log_id: pourLog.id,
            truck_number: t.truck_number,
            arrival_time: t.arrival_time || null,
            pour_start: t.pour_start || null,
            pour_complete: t.pour_complete || null,
            yards: t.yards || null,
            concrete_temp: t.concrete_temp || null,
            slump: t.slump || null,
            air_content: t.air_content || null,
            water_added: t.water_added || null,
            cylinders_cast: t.cylinders_cast || null,
            notes: t.notes || null
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
