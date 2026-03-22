import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import sharp from 'sharp'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

async function uploadNewPhotos(files) {
  const photo_urls = []
  const photo_labels = []

  for (const photo of files) {
    const bytes = await photo.arrayBuffer()
    let buffer = Buffer.from(bytes)
    let safeName = photo.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    let contentType = photo.type || 'image/jpeg'

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

    if (uploadError) {
      console.error('Photo upload error:', uploadError)
      continue
    }

    const { data: { publicUrl } } = supabase.storage
      .from('report-photos')
      .getPublicUrl(path)

    photo_urls.push(publicUrl)
    photo_labels.push(photo.name)
  }

  return { photo_urls, photo_labels }
}

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
    const newPhotoFiles = formData.getAll('add_photos').filter(file => file && file.size > 0)

    const { data: existing } = await supabase
      .from('reports')
      .select('photo_urls, photo_labels')
      .eq('id', params.id)
      .single()

    let photo_urls = existing?.photo_urls || []
    let photo_labels = existing?.photo_labels || []
    if (newPhotoFiles.length > 0) {
      const uploaded = await uploadNewPhotos(newPhotoFiles)
      photo_urls = [...photo_urls, ...uploaded.photo_urls]
      photo_labels = [...photo_labels, ...uploaded.photo_labels]
    }

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
        submitted_by,
        photo_urls: photo_urls.length > 0 ? photo_urls : null,
        photo_labels: photo_labels.length > 0 ? photo_labels : null,
      })
      .eq('id', params.id)

    if (error) throw error

    return NextResponse.redirect(new URL(`/reports/${params.id}`, request.url), 303)

  } catch (err) {
    console.error(err)
    return new Response('Something went wrong. Please try again.', { status: 500 })
  }
}
