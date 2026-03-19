import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

function toBool(val) {
  if (val === 'yes') return true
  if (val === 'no') return false
  return null
}

export async function POST(request) {
  try {
    const formData = await request.formData()
    const f = (name) => formData.get(name)

    const { error } = await supabase.from('contractor_evaluations').insert({
      project_id: f('project_id') || null,
      inspector_name: f('inspector_name'),
      inspection_date: f('inspection_date') || null,
      inspection_location: f('inspection_location'),
      contractor_name: f('contractor_name'),
      project_name: f('project_name'),
      supervisor_name: f('supervisor_name'),
      ppe_compliant: toBool(f('ppe_compliant')),
      safety_signs: toBool(f('safety_signs')),
      emergency_procedures: toBool(f('emergency_procedures')),
      safety_comments: f('safety_comments'),
      work_specs: toBool(f('work_specs')),
      materials_quality: toBool(f('materials_quality')),
      workmanship: toBool(f('workmanship')),
      work_quality_comments: f('work_quality_comments'),
      on_schedule: toBool(f('on_schedule')),
      milestones_met: toBool(f('milestones_met')),
      timeliness_comments: f('timeliness_comments'),
      contractor_responsive: toBool(f('contractor_responsive')),
      progress_reports: toBool(f('progress_reports')),
      communication_comments: f('communication_comments'),
      regulations_compliant: toBool(f('regulations_compliant')),
      permits_current: toBool(f('permits_current')),
      compliance_comments: f('compliance_comments'),
      env_impact_minimized: toBool(f('env_impact_minimized')),
      waste_disposal: toBool(f('waste_disposal')),
      environmental_comments: f('environmental_comments'),
      overall_rating: f('overall_rating'),
      overall_comments: f('overall_comments'),
      inspector_signature: f('inspector_signature'),
      signature_date: f('signature_date') || null,
    })

    if (error) throw error

    const project_id = f('project_id')
    return NextResponse.redirect(
      new URL(project_id ? `/projects/${project_id}` : '/reports', request.url),
      303
    )
  } catch (err) {
    console.error(err)
    return new Response('Something went wrong: ' + err.message, { status: 500 })
  }
}
