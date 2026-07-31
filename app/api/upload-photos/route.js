import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { getUserId } from '@/lib/get-user-id'
import { getAccessScope, getOwnedProjectById } from '@/lib/organizations'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

const ALLOWED_FOLDERS = new Set(['pour-logs', 'qa-forms'])
const MAX_FILES = 20
const MAX_FILE_BYTES = 20 * 1024 * 1024

async function getAuthenticatedUserId(request) {
  const authHeader = request.headers.get('authorization') || ''
  const match = authHeader.match(/^Bearer\s+(.+)$/i)

  if (match?.[1]) {
    const { data, error } = await supabase.auth.getUser(match[1])
    if (!error && data?.user?.id) return data.user.id
  }

  return getUserId()
}

function buildStoragePublicUrl(path) {
  const baseUrl = String(process.env.SUPABASE_URL || '').replace(/\/$/, '')
  const normalizedPath = String(path || '')
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/')

  return baseUrl
    ? `${baseUrl}/storage/v1/object/public/report-photos/${normalizedPath}`
    : null
}

function normalizeMimeType(value) {
  const text = String(value ?? '').trim().toLowerCase()
  if (!text) return null

  const [mime] = text.split(';')
  const allowed = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
    'image/avif',
  ])

  return allowed.has(mime) ? mime : null
}

function inferContentType(filename, fallbackType) {
  const normalizedFallback = normalizeMimeType(fallbackType)
  if (normalizedFallback) return normalizedFallback
  const ext = filename.toLowerCase().split('.').pop()
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'heic') return 'image/heic'
  if (ext === 'heif') return 'image/heif'
  if (ext === 'avif') return 'image/avif'
  return 'image/jpeg'
}

async function processImage(buffer, filename, mimeType) {
  const normalizedMimeType = normalizeMimeType(mimeType)
  const isHeic = filename.toLowerCase().endsWith('.heic') ||
    filename.toLowerCase().endsWith('.heif') ||
    normalizedMimeType === 'image/heic' ||
    normalizedMimeType === 'image/heif'

  if (isHeic) {
    try {
      const converted = await sharp(buffer).rotate().jpeg({ quality: 85 }).toBuffer()
      const newName = filename.replace(/\.(heic|heif)$/i, '.jpg')
      return { buffer: converted, filename: newName, contentType: 'image/jpeg' }
    } catch (error) {
      console.warn('HEIC conversion failed, storing original file instead:', error)
      return {
        buffer,
        filename,
        contentType: inferContentType(filename, normalizedMimeType),
      }
    }
  }

  return { buffer, filename, contentType: inferContentType(filename, normalizedMimeType) }
}

export async function POST(request) {
  try {
    const userId = await getAuthenticatedUserId(request)
    if (!userId) {
      return Response.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const formData = await request.formData()
    const requestedFolder = String(formData.get('folder') || '').trim()
    const folder = ALLOWED_FOLDERS.has(requestedFolder) ? requestedFolder : ''
    if (!folder) {
      return Response.json({ error: 'Invalid upload folder.' }, { status: 400 })
    }

    const projectId = String(formData.get('project_id') || '').trim()
    if (projectId) {
      const accessScope = await getAccessScope(supabase, userId)
      const { data: project, error: projectError } = await getOwnedProjectById(
        supabase,
        userId,
        projectId,
        accessScope.scopedOrganizationIds,
        'id',
        accessScope.scopedProjectIds,
        { restrictToAssignedProjects: accessScope.restrictToAssignedProjects }
      )

      if (projectError || !project) {
        return Response.json({ error: 'Project not found.' }, { status: 404 })
      }
    }

    const files = formData.getAll('files').filter(f => f && f.size > 0)
    if (files.length > MAX_FILES) {
      return Response.json({ error: `Upload is limited to ${MAX_FILES} files at a time.` }, { status: 400 })
    }

    const uploaded = []
    const errors = []

    for (const file of files) {
      try {
        if (file.size > MAX_FILE_BYTES) {
          errors.push(`${file.name}: File is larger than 20 MB.`)
          continue
        }

        const bytes = await file.arrayBuffer()
        const rawBuffer = Buffer.from(bytes)
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')

        const { buffer, filename, contentType } = await processImage(rawBuffer, safeName, file.type)
        const path = `${folder}/${Date.now()}_${filename}`

        const { error } = await supabase.storage
          .from('report-photos')
          .upload(path, buffer, { contentType })

        if (error) {
          console.error('Upload error:', error)
          errors.push(`${file.name}: ${error.message}`)
          continue
        }

        const { data } = supabase.storage
          .from('report-photos')
          .getPublicUrl(path)

        const publicUrl = data?.publicUrl || data?.publicURL || buildStoragePublicUrl(path)

        if (!publicUrl) {
          console.error('Photo upload succeeded but no public URL was returned.', { path, data })
          errors.push(`${file.name}: Uploaded successfully but could not build a photo URL.`)
          continue
        }

        uploaded.push({ url: publicUrl, originalName: file.name })
      } catch (error) {
        console.error('Photo processing error:', error)
        errors.push(`${file.name}: ${error.message || 'processing failed'}`)
      }
    }

    if (uploaded.length === 0 && errors.length > 0) {
      return Response.json({ error: 'Photo upload failed.', errors }, { status: 400 })
    }

    return Response.json({
      urls: uploaded.map(item => item.url),
      uploaded,
      errors,
    })
  } catch (err) {
    console.error(err)
    return new Response('Upload failed.', { status: 500 })
  }
}
