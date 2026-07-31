import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { recordAuditEvent } from '@/lib/audit-log'
import {
  buildDailyReportInsert,
  getDailyReportInputFromFormData,
  normalizeDailyReportPayload,
} from '@/lib/daily-reports'
import { getUserId } from '@/lib/get-user-id'
import { getCreateProjectContext } from '@/lib/project-access'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export async function POST(request) {
  try {
    const formData = await request.formData()
    const user_id = await getUserId()
    if (!user_id) {
      return new Response('Unauthorized', { status: 401 })
    }

    const payload = normalizeDailyReportPayload(getDailyReportInputFromFormData(formData))
    const project_id = payload.project_id
    const { project, organizationId: organization_id, error: projectError } = await getCreateProjectContext(supabase, {
      userId: user_id,
      projectId: project_id,
    })
    if (project_id && (projectError || !project)) {
      return new Response('Project not found.', { status: 404 })
    }

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

    const { data: inserted, error: dbError } = await supabase
      .from('reports')
      .insert(buildDailyReportInsert(payload, {
        userId: user_id,
        organizationId: organization_id,
        photoUrls: photo_urls,
        photoLabels: photo_labels,
      }))
      .select()
      .single()

    if (dbError) throw dbError

    await recordAuditEvent(supabase, {
      organizationId: organization_id,
      actorUserId: user_id,
      entityType: 'report',
      entityId: inserted.id,
      action: 'create',
      metadata: {
        project_id,
        project_name: payload.project_name,
        report_date: payload.report_date,
      },
    })

    return Response.json({ id: inserted.id })

  } catch (err) {
    console.error(err)
    return new Response('Something went wrong. Please try again.', { status: 500 })
  }
}
