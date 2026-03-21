import { createClient } from '@supabase/supabase-js'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const [year, month, day] = dateStr.split('-')
  return month + '-' + day + '-' + year
}

function wrapText(text, maxChars) {
  const words = String(text || '-').split(' ')
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
  return lines.length ? lines : ['-']
}

export async function GET(request, { params }) {
  const { data: report, error } = await supabase
    .from('reports')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !report) {
    return new Response('Report not found', { status: 404 })
  }

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
  const contentW = W - margin * 2

  function newPage() {
    const p = pdfDoc.addPage([W, H])
    // Header bar
    p.drawRectangle({ x: 0, y: H - 72, width: W, height: 72, color: rgb(0.8, 0.2, 0) })
    p.drawText('DAILY FIELD REPORT', { x: margin, y: H - 38, size: 20, font: bold, color: rgb(1, 1, 1) })
    p.drawText(companyName, { x: margin, y: H - 58, size: 10, font, color: rgb(1, 0.75, 0.65) })
    return p
  }

  const page1 = newPage()

  // Embed logo
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
  const page = page1

  // ── Two-column grid for short fields ──
  const col1X = margin
  const col2X = margin + contentW / 2 + 10
  const colW = contentW / 2 - 10

  function drawCell(p, label, value, x, yPos, w) {
    p.drawText(label, { x, y: yPos, size: 8, font: bold, color: rgb(0.55, 0.55, 0.55) })
    p.drawText(String(value || '-'), { x, y: yPos - 15, size: 11, font, color: rgb(0.1, 0.1, 0.1) })
    p.drawLine({ start: { x, y: yPos - 26 }, end: { x: x + w, y: yPos - 26 }, thickness: 0.5, color: rgb(0.88, 0.88, 0.88) })
    return yPos - 44
  }

  function drawFullField(p, label, value, yPos) {
    p.drawText(label, { x: margin, y: yPos, size: 8, font: bold, color: rgb(0.55, 0.55, 0.55) })
    const lines = wrapText(value, 85)
    let ly = yPos - 15
    for (const line of lines) {
      p.drawText(line, { x: margin, y: ly, size: 11, font, color: rgb(0.1, 0.1, 0.1) })
      ly -= 15
    }
    p.drawLine({ start: { x: margin, y: ly - 4 }, end: { x: W - margin, y: ly - 4 }, thickness: 0.5, color: rgb(0.88, 0.88, 0.88) })
    return ly - 20
  }

  // Row 1: Project Name (full width)
  y = drawFullField(page, 'PROJECT NAME', report.project_name, y)

  // Row 2: Date + Submitted By
  const r2y = y
  drawCell(page, 'REPORT DATE', formatDate(report.report_date), col1X, r2y, colW)
  y = drawCell(page, 'SUBMITTED BY', report.submitted_by, col2X, r2y, colW) - 0
  // pick lowest y
  y = r2y - 44

  // Row 3: Crew + Weather
  const r3y = y
  drawCell(page, 'CREW COUNT ON SITE', report.crew_count, col1X, r3y, colW)
  drawCell(page, 'WEATHER CONDITIONS', report.weather, col2X, r3y, colW)
  y = r3y - 44

  y -= 4

  // Full-width fields
  y = drawFullField(page, 'WORK COMPLETED TODAY', report.work_completed, y)
  y = drawFullField(page, 'EQUIPMENT USED', report.equipment_used, y)
  y = drawFullField(page, 'SAFETY / ISSUES', report.safety_issues, y)

  // Footer on page 1
  page.drawText(
    `Generated ${new Date().toLocaleDateString()} · ${companyName}`,
    { x: margin, y: 24, size: 8, font, color: rgb(0.65, 0.65, 0.65) }
  )
  page.drawText(String(pdfDoc.getPageCount()), { x: W - margin - 10, y: 24, size: 8, font, color: rgb(0.65, 0.65, 0.65) })

  // ── Photos section ──
  if (report.photo_urls && report.photo_urls.length > 0) {
    const photoLabels = report.photo_labels || []
    const photoW = 248
    const photoH = 186
    const xPositions = [margin, margin + photoW + 16]

    let photoPage = newPage()
    photoPage.drawText('SITE PHOTOS', { x: margin, y: H - 40, size: 16, font: bold, color: rgb(1, 1, 1) })

    let photoY = H - 90
    let col = 0

    for (let i = 0; i < report.photo_urls.length; i++) {
      const url = report.photo_urls[i]
      const label = photoLabels[i] || ''
      try {
        const res = await fetch(url)
        const imgBytes = new Uint8Array(await res.arrayBuffer())
        let img
        try { img = await pdfDoc.embedJpg(imgBytes) } catch { img = await pdfDoc.embedPng(imgBytes) }

        const x = xPositions[col]
        const labelHeight = label ? 14 : 0
        const totalH = photoH + labelHeight + 6

        if (photoY - totalH < margin + 20) {
          // Footer on current photo page
          photoPage.drawText(
            `Generated ${new Date().toLocaleDateString()} · ${companyName}`,
            { x: margin, y: 24, size: 8, font, color: rgb(0.65, 0.65, 0.65) }
          )
          photoPage = newPage()
          photoPage.drawText('SITE PHOTOS (CONTINUED)', { x: margin, y: H - 40, size: 16, font: bold, color: rgb(1, 1, 1) })
          photoY = H - 90
          col = 0
        }

        photoPage.drawImage(img, { x, y: photoY - photoH, width: photoW, height: photoH })

        if (label) {
          photoPage.drawText(label, {
            x,
            y: photoY - photoH - 12,
            size: 9,
            font,
            color: rgb(0.35, 0.35, 0.35),
          })
        }

        col++
        if (col >= 2) {
          col = 0
          photoY -= photoH + labelHeight + 22
        }
      } catch (err) {
        console.error('Failed to embed photo:', err)
      }
    }

    photoPage.drawText(
      `Generated ${new Date().toLocaleDateString()} · ${companyName}`,
      { x: margin, y: 24, size: 8, font, color: rgb(0.65, 0.65, 0.65) }
    )
  }

  const pdfBytes = await pdfDoc.save()

  return new Response(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="daily-report-${report.project_name}-${report.report_date}.pdf"`,
    },
  })
}
