import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export async function POST(request, { params }) {
  try {
    const { error } = await supabase
      .from('contractor_evaluations')
      .delete()
      .eq('id', params.id)

    if (error) throw error

    return NextResponse.redirect(new URL('/reports', request.url), 303)
  } catch (err) {
    console.error(err)
    return new Response('Delete failed.', { status: 500 })
  }
}
