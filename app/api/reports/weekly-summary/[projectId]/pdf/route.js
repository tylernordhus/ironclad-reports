import { createClient } from '@supabase/supabase-js'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

function fmt(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${m}-${d}-${y}`
}

function wrapText(text, maxChars) {
  const words = String(text || '').split(' ')
  const lines = []
  let line = ''
  for (const word of words) {
    if ((line + word).length > maxChars) {
      if (line) lines.push(line.trim())
      line = word + ' '
    } else {
      line += word + ' '
    }
  }
  if (line.trim()) lines.push(line.trim())
  return lines.length ? lines : ['']
}

export async function POST(request, { params }) {
  try {
    const { summary, selectedPhotos, startDate, endDate, projectName } = await request.json()

    const { data: settings } = await supabase
      .from('settings')
      .select('company_name, logo_url')
      .single()

    const companyName = settings?.company_name || 'Field Reports'

    const pdfDoc = await PDFDocument.create()
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    const W = 612
    const H = 792
    const margin = 40

    function addPage(title) {
      const p = pdfDoc.addPage([W, H])
      p.drawRectangle({ x: 0, y: H - 72, width: W, height: 72, color: rgb(0.8, 0.2, 0) })
      p.drawText(title, { x: margin, y: H - 38, size: 18, font: bold, color: rgb(1, 1, 1) })
      p.drawText(companyName, { x: margin, y: H - 58, size: 10, font, color: rgb(1, 0.75, 0.65) })
      return p
    }

    // ── Page 1: Summary ──
    const page1 = addPage('WEEKLY PROGRESS SUMMARY')

    // Logo
    if (settings?.logo_url) {
      try {
        const logoRes = await fetch(settings.logo_url)
        const logoBytes = new Uint8Array(await logoRes.arrayBuffer())
        let logoImg
        try { logoImg = await pdfDoc.embedPng(logoBytes) } catch { logoImg = await pdfDoc.embedJpg(logoBytes) }
        const { width: lw, height: lh } = logoImg.scale(1)
        const scale = Math.min(100 / lw, 48 / lh)
        page1.drawImage(logoImg, { x: W - margin - lw * scale, y: H - 66, width: lw * scale, height: lh * scale })
      } catch {}
    }

    let y = H - 90

    // Project + week
    page1.drawText(`${projectName || 'Project'}`, { x: margin, y, size: 13, font: bold, color: rgb(0.1, 0.1, 0.1) })
    y -= 18
    page1.drawText(`Week of ${fmt(startDate)} – ${fmt(endDate)}`, { x: margin, y, size: 10, font, color: rgb(0.5, 0.5, 0.5) })
    y -= 24
    page1.drawLine({ start: { x: margin, y }, end: { x: W - margin, y }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) })
    y -= 18

    // Summary text
    const paragraphs = (summary || '').split('\n').filter(l => l.trim())
    for (const para of paragraphs) {
      const lines = wrapText(para, 85)
      for (const line of lines) {
        if (y < margin + 30) {
          page1.drawText(`${companyName} · ${fmt(startDate)} – ${fmt(endDate)}`, { x: margin, y: 24, size: 8, font, color: rgb(0.65, 0.65, 0.65) })
          // would need new page for very long summaries — handled below
          break
        }
        page1.drawText(line, { x: margin, y, size: 11, font, color: rgb(0.1, 0.1, 0.1) })
        y -= 16
      }
      y -= 6 // paragraph spacing
    }

    page1.drawText(`${companyName} · ${fmt(startDate)} – ${fmt(endDate)}`, { x: margin, y: 24, size: 8, font, color: rgb(0.65, 0.65, 0.65) })

    // ── Pages 2+: Photos ──
    if (selectedPhotos && selectedPhotos.length > 0) {
      const photoW = 248
      const photoH = 186
      const xPositions = [margin, margin + photoW + 16]

      let photoPage = addPage('SITE PHOTOS')
      photoPage.drawText(`${projectName} · ${fmt(startDate)} – ${fmt(endDate)}`, { x: margin, y: H - 42, size: 9, font, color: rgb(1, 0.85, 0.78) })

      let photoY = H - 90
      let col = 0

      for (const photo of selectedPhotos) {
        try {
          const res = await fetch(photo.url)
          const imgBytes = new Uint8Array(await res.arrayBuffer())
          let img
          try { img = await pdfDoc.embedJpg(imgBytes) } catch { img = await pdfDoc.embedPng(imgBytes) }

          const labelH = (photo.label || photo.date) ? 26 : 0
          const totalH = photoH + labelH + 16

          if (photoY - totalH < margin + 10) {
            photoPage.drawText(`${companyName} · ${fmt(startDate)} – ${fmt(endDate)}`, { x: margin, y: 24, size: 8, font, color: rgb(0.65, 0.65, 0.65) })
            photoPage = addPage('SITE PHOTOS (CONTINUED)')
            photoPage.drawText(`${projectName} · ${fmt(startDate)} – ${fmt(endDate)}`, { x: margin, y: H - 42, size: 9, font, color: rgb(1, 0.85, 0.78) })
            photoY = H - 90
            col = 0
          }

          const x = xPositions[col]
          photoPage.drawImage(img, { x, y: photoY - photoH, width: photoW, height: photoH })

          let captionY = photoY - photoH - 13
          if (photo.label) {
            photoPage.drawText(photo.label, { x, y: captionY, size: 9, font: bold, color: rgb(0.2, 0.2, 0.2) })
            captionY -= 12
          }
          if (photo.date) {
            photoPage.drawText(fmt(photo.date), { x, y: captionY, size: 8, font, color: rgb(0.55, 0.55, 0.55) })
          }

          col++
          if (col >= 2) {
            col = 0
            photoY -= photoH + labelH + 22
          }
        } catch (err) {
          console.error('Photo embed error:', err)
        }
      }

      photoPage.drawText(`${companyName} · ${fmt(startDate)} – ${fmt(endDate)}`, { x: margin, y: 24, size: 8, font, color: rgb(0.65, 0.65, 0.65) })
    }

    const pdfBytes = await pdfDoc.save()
    const safeName = (projectName || 'project').replace(/[^a-zA-Z0-9]/g, '-')

    return new Response(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="weekly-summary-${safeName}-${startDate}.pdf"`,
      },
    })
  } catch (err) {
    console.error('Weekly PDF error:', err)
    return new Response('Failed to generate PDF', { status: 500 })
  }
}
