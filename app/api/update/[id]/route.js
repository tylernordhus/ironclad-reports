import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export async function POST(request, { params }) {
  try {
    const formData = await request.formData()

    const project_name = formData.get('project_name')
    const report_date = formData.get('report_date')
    const crew_count = parseInt(formData.get('crew_count'))
    const work_completed = formData.get('work_completed')
    const equipment_used = formData.get('equipment_used')
    const safety_issues = formData.get('safety_issues')
    const weather = formData.get('weather')
    const submitted_by = formData.get('submitted_by')

    const { error } = await supabase
      .from('reports')
      .update({
        project_name,
        report_date,
        crew_count,
        work_completed,
        equipment_used,
        safety_issues,
        weather,
        submitted_by
      })
      .eq('id', params.id)

    if (error) throw error

    return Response.redirect(new URL(`/reports/${params.id}`, request.url))

  } catch (err) {
    console.error(err)
    return new Response('Something went wrong. Please try again.', { status: 500 })
  }
}
