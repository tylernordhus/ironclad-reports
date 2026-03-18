import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export async function POST(request) {
  try {
    const formData = await request.formData()
    const folder = formData.get('folder') || 'misc'
    const files = formData.getAll('files').filter(f => f && f.size > 0)

    const urls = []

    for (const file of files) {
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${folder}/${Date.now()}_${safeName}`

      const { error } = await supabase.storage
        .from('report-photos')
        .upload(path, buffer, { contentType: file.type })

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
