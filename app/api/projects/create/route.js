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
    const address = formData.get('address')
    const client_name = formData.get('client_name')
    const client_email = formData.get('client_email')
    const start_date = formData.get('start_date') || null
    const notes = formData.get('notes')
    const status = formData.get('status')

    const { data, error } = await supabase
      .from('projects')
      .insert({
        project_name,
        location,
        address,
        client_name,
        client_email,
        start_date,
        notes,
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
