import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export async function POST(request) {
  try {
    const formData = await request.formData()

    const project_id = formData.get('project_id') || null
    const project_name = formData.get('project_name')
    const report_date = formData.get('report_date')
    const crew_count = parseInt(formData.get('crew_count'))
    const work_completed = formData.get('work_completed')
    const equipment_used = formData.get('equipment_used')
    const safety_issues = formData.get('safety_issues')
    const weather = formData.get('weather')
    const submitted_by = formData.get('submitted_by')

    const { error: dbError } = await supabase
      .from('reports')
      .insert({
        project_id,
        project_name,
        report_date,
        crew_count,
        work_completed,
        equipment_used,
        safety_issues,
        weather,
        submitted_by
      })

    if (dbError) throw dbError

    const redirectTo = project_id
      ? `/projects/${project_id}`
      : '/success'

    return NextResponse.redirect(new URL(redirectTo, request.url), 303)

  } catch (err) {
    console.error(err)
    return new Response('Something went wrong. Please try again.', { status: 500 })
  }
}
