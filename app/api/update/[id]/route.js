import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import sharp from 'sharp'
import { recordAuditEvent } from '@/lib/audit-log'
import {
  buildDailyReportUpdate,
  getDailyReportInputFromFormData,
  normalizeDailyReportPayload,
} from '@/lib/daily-reports'
import { getUserId } from '@/lib/get-user-id'
import { getAccessibleReportById } from '@/lib/report-access'

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
    const userId = await getUserId()
    if (!userId) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { report: existing } = await getAccessibleReportById(supabase, { reportId: params.id, userId })
    if (!existing) {
      return new Response('Report not found.', { status: 404 })
    }

    const payload = normalizeDailyReportPayload(getDailyReportInputFromFormData(formData), existing)
    const newPhotoFiles = formData.getAll('add_photos').filter(file => file && file.size > 0)

    let photo_urls = existing?.photo_urls || []
    let photo_labels = existing?.photo_labels || []
    if (newPhotoFiles.length > 0) {
      const uploaded = await uploadNewPhotos(newPhotoFiles)
      photo_urls = [...photo_urls, ...uploaded.photo_urls]
      photo_labels = [...photo_labels, ...uploaded.photo_labels]
    }

    const { error } = await supabase
      .from('reports')
      .update(buildDailyReportUpdate(payload, { photoUrls: photo_urls, photoLabels: photo_labels }))
      .eq('id', params.id)

    if (error) throw error

    await recordAuditEvent(supabase, {
      organizationId: existing.organization_id,
      actorUserId: userId,
      entityType: 'report',
      entityId: params.id,
      action: 'update',
      metadata: {
        project_name: payload.project_name,
        report_date: payload.report_date,
      },
    })

    return NextResponse.redirect(new URL(`/reports/${params.id}`, request.url), 303)

  } catch (err) {
    console.error(err)
    return new Response('Something went wrong. Please try again.', { status: 500 })
  }
}
