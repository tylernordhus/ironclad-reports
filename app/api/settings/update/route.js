import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export async function POST(request) {
  try {
    const formData = await request.formData()

    const company_name = formData.get('company_name')
    const company_email = formData.get('company_email')
    const company_phone = formData.get('company_phone')

    const { data: existing } = await supabase
      .from('settings')
      .select('id')
      .single()

    if (existing) {
      await supabase
        .from('settings')
        .update({ company_name, company_email, company_phone, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
    } else {
      await supabase
        .from('settings')
        .insert({ company_name, company_email, company_phone })
    }

    return NextResponse.redirect(new URL('/settings', request.url), 303)

  } catch (err) {
    console.error(err)
    return new Response('Something went wrong.', { status: 500 })
  }
}
