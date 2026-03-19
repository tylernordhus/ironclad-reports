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
  const page = pdfDoc.addPage([612, 792])
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const { height } = page.getSize()

  let y = height - 50

  page.drawRectangle({ x: 0, y: height - 80, width: 612, height: 80, color: rgb(0.8, 0.2, 0) })
  page.drawText('DAILY FIELD REPORT', { x: 40, y: height - 45, size: 22, font: boldFont, color: rgb(1, 1, 1) })
  page.drawText(companyName, { x: 40, y: height - 65, size: 11, font, color: rgb(1, 1, 1) })

  if (settings?.logo_url) {
    try {
      const logoRes = await fetch(settings.logo_url)
      const logoBytes = new Uint8Array(await logoRes.arrayBuffer())
      let logoImg
      try { logoImg = await pdfDoc.embedPng(logoBytes) } catch { logoImg = await pdfDoc.embedJpg(logoBytes) }
      const { width: lw, height: lh } = logoImg.scale(1)
      const maxH = 50, maxW = 120
      const scale = Math.min(maxW / lw, maxH / lh)
      page.drawImage(logoImg, { x: 612 - 40 - lw * scale, y: height - 70, width: lw * scale, height: lh * scale })
    } catch (e) { console.error('Logo embed error:', e) }
  }

  y = height - 110

  const drawField = (label, value, yPos) => {
    page.drawText(label, { x: 40, y: yPos, size: 10, font: boldFont, color: rgb(0.4, 0.4, 0.4) })
    page.drawText(String(value || '-'), { x: 40, y: yPos - 18, size: 12, font, color: rgb(0.1, 0.1, 0.1) })
    page.drawLine({ start: { x: 40, y: yPos - 28 }, end: { x: 572, y: yPos - 28 }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) })
    return yPos - 50
  }

  const drawLongField = (label, value, yPos) => {
    page.drawText(label, { x: 40, y: yPos, size: 10, font: boldFont, color: rgb(0.4, 0.4, 0.4) })
    const words = String(value || '-').split(' ')
    let line = ''
    let lineY = yPos - 18
    for (const word of words) {
      const test = line + word + ' '
      if (test.length > 72) {
        page.drawText(line.trim(), { x: 40, y: lineY, size: 12, font, color: rgb(0.1, 0.1, 0.1) })
        lineY -= 16
        line = word + ' '
      } else {
        line = test
      }
    }
    if (line.trim()) {
      page.drawText(line.trim(), { x: 40, y: lineY, size: 12, font, color: rgb(0.1, 0.1, 0.1) })
      lineY -= 16
    }
    page.drawLine({ start: { x: 40, y: lineY - 6 }, end: { x: 572, y: lineY - 6 }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) })
    return lineY - 26
  }

  y = drawField('PROJECT NAME', report.project_name, y)
  y = drawField('REPORT DATE', formatDate(report.report_date), y)
  y = drawField('SUBMITTED BY', report.submitted_by, y)
  y = drawField('CREW COUNT ON SITE', report.crew_count, y)
  y = drawField('WEATHER CONDITIONS', report.weather, y)
  y = drawLongField('WORK COMPLETED TODAY', report.work_completed, y)
  y = drawField('EQUIPMENT USED', report.equipment_used, y)
  y = drawLongField('SAFETY / ISSUES', report.safety_issues, y)

  // Photos section
  if (report.photo_urls && report.photo_urls.length > 0) {
    const photoWidth = 245
    const photoHeight = 180
    const cols = 2
    const xPositions = [40, 307]

    let photoPage = pdfDoc.addPage([612, 792])
    photoPage.drawRectangle({ x: 0, y: 792 - 50, width: 612, height: 50, color: rgb(0.8, 0.2, 0) })
    photoPage.drawText('PHOTOS', { x: 40, y: 792 - 35, size: 16, font: boldFont, color: rgb(1, 1, 1) })

    let photoY = 792 - 80
    let col = 0

    for (const url of report.photo_urls) {
      try {
        const res = await fetch(url)
        const arrayBuffer = await res.arrayBuffer()
        const imgBytes = new Uint8Array(arrayBuffer)

        let img
        try {
          img = await pdfDoc.embedJpg(imgBytes)
        } catch {
          img = await pdfDoc.embedPng(imgBytes)
        }

        const x = xPositions[col]

        if (photoY - photoHeight < 40) {
          photoPage = pdfDoc.addPage([612, 792])
          photoY = 792 - 60
        }

        photoPage.drawImage(img, { x, y: photoY - photoHeight, width: photoWidth, height: photoHeight })

        col++
        if (col >= cols) {
          col = 0
          photoY -= photoHeight + 20
        }
      } catch (err) {
        console.error('Failed to embed photo:', err)
      }
    }
  }

  page.drawText('Generated by ' + companyName + ' - ' + new Date().toLocaleDateString(), {
    x: 40, y: 30, size: 9, font, color: rgb(0.6, 0.6, 0.6)
  })

  const pdfBytes = await pdfDoc.save()

  return new Response(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="daily-report-' + report.project_name + '-' + report.report_date + '.pdf"'
    }
  })
}
