import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

async function uploadNewPhotos(files) {
  const photo_urls = []

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

    const path = `pour-logs/${Date.now()}_${safeName}`
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
  }

  return photo_urls
}

export async function POST(request, { params }) {
  try {
    const formData = await request.formData()
    const project_name = formData.get('project_name')
    const log_date = formData.get('log_date')
    const weather = formData.get('weather')
    const ambient_temp = formData.get('ambient_temp')
    const concrete_supplier = formData.get('concrete_supplier')
    const submitted_by = formData.get('submitted_by')
    const foundations = JSON.parse(formData.get('foundations') || '[]')
    const trucks = JSON.parse(formData.get('trucks') || '[]')
    const newPhotoFiles = formData.getAll('add_photos').filter(file => file && file.size > 0)

    const { data: existing } = await supabase
      .from('pour_logs')
      .select('photo_urls')
      .eq('id', params.id)
      .single()

    let photo_urls = existing?.photo_urls || []
    if (newPhotoFiles.length > 0) {
      const uploaded = await uploadNewPhotos(newPhotoFiles)
      photo_urls = [...photo_urls, ...uploaded]
    }

    const { error: logError } = await supabase
      .from('pour_logs')
      .update({ project_name, log_date, weather, ambient_temp, concrete_supplier, submitted_by, photo_urls: photo_urls.length > 0 ? photo_urls : null })
      .eq('id', params.id)

    if (logError) throw logError

    // Replace foundations
    await supabase.from('pour_log_foundations').delete().eq('pour_log_id', params.id)
    if (foundations && foundations.length > 0) {
      const { error: foundError } = await supabase.from('pour_log_foundations').insert(
        foundations.map(f => ({
          pour_log_id: params.id,
          foundation_id: f.foundation_id,
          total_depth: f.total_depth,
          estimated_yards: f.estimated_yards,
          notes: f.notes
        }))
      )
      if (foundError) throw foundError
    }

    // Replace trucks
    await supabase.from('pour_log_trucks').delete().eq('pour_log_id', params.id)
    if (trucks && trucks.length > 0) {
      const { error: truckError } = await supabase.from('pour_log_trucks').insert(
        trucks.map(t => ({
          pour_log_id: params.id,
          truck_number: t.truck_number,
          arrival_time: t.arrival_time || null,
          pour_start: t.pour_start || null,
          pour_complete: t.pour_complete || null,
          yards: t.yards,
          foundations_served: t.foundations_served,
          depth_reading: t.depth_reading,
          concrete_temp: t.concrete_temp,
          slump: t.slump,
          air_content: t.air_content,
          water_added: t.water_added,
          cylinders_cast: t.cylinders_cast,
          notes: t.notes
        }))
      )
      if (truckError) throw truckError
    }

    return Response.json({ success: true })
  } catch (err) {
    console.error(err)
    return new Response('Something went wrong.', { status: 500 })
  }
}
