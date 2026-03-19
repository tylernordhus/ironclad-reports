import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

const VALID_SLOTS = ['login', 'home', 'projects', 'daily-report', 'pour-log', 'reports']

export async function POST(request) {
  try {
    const formData = await request.formData()
    const slot = formData.get('slot')
    const file = formData.get('file')

    if (!VALID_SLOTS.includes(slot) || !file || file.size === 0) {
      return NextResponse.redirect(new URL('/settings', request.url), 303)
    }

    let buffer = Buffer.from(await file.arrayBuffer())
    let contentType = file.type
    const isHeic = file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')
    if (isHeic || contentType === 'image/heic' || contentType === 'image/heif') {
      buffer = await sharp(buffer).jpeg({ quality: 88 }).toBuffer()
      contentType = 'image/jpeg'
    }

    // Resize to max 1200px wide to keep PDF file size reasonable
    buffer = await sharp(buffer).resize({ width: 1200, withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer()
    contentType = 'image/jpeg'

    const path = `sop-screenshots/${slot}.jpg`
    await supabase.storage.from('report-photos').upload(path, buffer, { contentType, upsert: true })

    return NextResponse.redirect(new URL('/settings#screenshots', request.url), 303)
  } catch (err) {
    console.error(err)
    return NextResponse.redirect(new URL('/settings', request.url), 303)
  }
}
