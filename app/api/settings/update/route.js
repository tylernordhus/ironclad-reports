import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import sharp from 'sharp'

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
    const logoFile = formData.get('logo')

    let logo_url = undefined

    if (logoFile && logoFile.size > 0) {
      const bytes = await logoFile.arrayBuffer()
      let buffer = Buffer.from(bytes)
      let safeName = logoFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      let contentType = logoFile.type

      const isHeic = safeName.toLowerCase().endsWith('.heic') || safeName.toLowerCase().endsWith('.heif')
      if (isHeic) {
        buffer = await sharp(buffer).jpeg({ quality: 90 }).toBuffer()
        safeName = safeName.replace(/\.(heic|heif)$/i, '.jpg')
        contentType = 'image/jpeg'
      }

      const path = `logos/${Date.now()}_${safeName}`
      const { error: uploadError } = await supabase.storage
        .from('report-photos')
        .upload(path, buffer, { contentType, upsert: true })

      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage.from('report-photos').getPublicUrl(path)
        logo_url = publicUrl
      } else {
        console.error('Logo upload error:', uploadError)
      }
    }

    const { data: existing } = await supabase.from('settings').select('id').single()

    const updateData = {
      company_name, company_email, company_phone,
      updated_at: new Date().toISOString(),
      ...(logo_url !== undefined && { logo_url })
    }

    if (existing) {
      await supabase.from('settings').update(updateData).eq('id', existing.id)
    } else {
      await supabase.from('settings').insert({ company_name, company_email, company_phone, logo_url })
    }

    return NextResponse.redirect(new URL('/settings', request.url), 303)
  } catch (err) {
    console.error(err)
    return new Response('Something went wrong.', { status: 500 })
  }
}
