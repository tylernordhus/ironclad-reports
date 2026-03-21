import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import sharp from 'sharp'
import { getUserId } from '@/lib/get-user-id'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export async function POST(request) {
  try {
    const formData = await request.formData()
    const user_id = await getUserId()

    const project_id = formData.get('project_id') || null
    const project_name = formData.get('project_name')
    const report_date = formData.get('report_date')
    const crew_count = parseInt(formData.get('crew_count'))
    const work_completed = formData.get('work_completed')
    const equipment_used = formData.get('equipment_used')
    const safety_issues = formData.get('safety_issues')
    const weather = formData.get('weather')
    const submitted_by = formData.get('submitted_by')

    const photoFiles = formData.getAll('photos').filter(f => f && f.size > 0)
    const photoLabelsRaw = formData.getAll('photo_labels')
    const photo_urls = []
    const photo_labels = []
    for (let i = 0; i < photoFiles.length; i++) {
      const photo = photoFiles[i]
      const label = photoLabelsRaw[i] || ''
      const bytes = await photo.arrayBuffer()
      let buffer = Buffer.from(bytes)
      let safeName = photo.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      let contentType = photo.type

      const isHeic = safeName.toLowerCase().endsWith('.heic') ||
        safeName.toLowerCase().endsWith('.heif')
      if (isHeic) {
        buffer = await sharp(buffer).jpeg({ quality: 85 }).toBuffer()
        safeName = safeName.replace(/\.(heic|heif)$/i, '.jpg')
        contentType = 'image/jpeg'
      }

      const path = `daily-reports/${Date.now()}_${safeName}`
      const { error: uploadError } = await supabase.storage
        .from('report-photos')
        .upload(path, buffer, { contentType })
      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage
          .from('report-photos')
          .getPublicUrl(path)
        photo_urls.push(publicUrl)
        photo_labels.push(label)
      } else {
        console.error('Photo upload error:', uploadError)
      }
    }

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
        submitted_by,
        photo_urls: photo_urls.length > 0 ? photo_urls : null,
        photo_labels: photo_labels.length > 0 ? photo_labels : null,
        user_id
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
