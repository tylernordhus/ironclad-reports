import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

async function processImage(buffer, filename) {
  const isHeic = filename.toLowerCase().endsWith('.heic') ||
    filename.toLowerCase().endsWith('.heif')

  if (isHeic) {
    const converted = await sharp(buffer).jpeg({ quality: 85 }).toBuffer()
    const newName = filename.replace(/\.(heic|heif)$/i, '.jpg')
    return { buffer: converted, filename: newName, contentType: 'image/jpeg' }
  }

  return { buffer, filename, contentType: 'image/jpeg' }
}

export async function POST(request) {
  try {
    const formData = await request.formData()
    const folder = formData.get('folder') || 'misc'
    const files = formData.getAll('files').filter(f => f && f.size > 0)

    const urls = []

    for (const file of files) {
      const bytes = await file.arrayBuffer()
      const rawBuffer = Buffer.from(bytes)
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')

      const { buffer, filename, contentType } = await processImage(rawBuffer, safeName)
      const path = `${folder}/${Date.now()}_${filename}`

      const { error } = await supabase.storage
        .from('report-photos')
        .upload(path, buffer, { contentType })

      if (!error) {
        const { data: { publicUrl } } = supabase.storage
          .from('report-photos')
          .getPublicUrl(path)
        urls.push(publicUrl)
      } else {
        console.error('Upload error:', error)
      }
    }

    return Response.json({ urls })
  } catch (err) {
    console.error(err)
    return new Response('Upload failed.', { status: 500 })
  }
}
