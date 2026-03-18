import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export async function POST(request) {
  try {
    const formData = await request.formData()

    const project_name = formData.get('project_name')
    const location = formData.get('location')
    const gc_name = formData.get('gc_name')
    const gc_email = formData.get('gc_email')
    const status = formData.get('status')

    const { data, error } = await supabase
      .from('projects')
      .insert({
        project_name,
        location,
        gc_name,
        gc_email,
        status
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.redirect(new URL(`/projects/${data.id}`, request.url), 303)

  } catch (err) {
    console.error(err)
    return new Response('Something went wrong. Please try again.', { status: 500 })
  }
}
