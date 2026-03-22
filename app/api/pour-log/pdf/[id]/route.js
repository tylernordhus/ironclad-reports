import { createClient } from '@supabase/supabase-js'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

const COLORS = {
  ink: rgb(0.12, 0.15, 0.19),
  body: rgb(0.28, 0.33, 0.39),
  muted: rgb(0.46, 0.5, 0.56),
  line: rgb(0.87, 0.89, 0.92),
  card: rgb(0.975, 0.98, 0.985),
  brand: rgb(0.16, 0.31, 0.45),
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const [year, month, day] = dateStr.split('-')
  return month + '-' + day + '-' + year
}

function formatTime(time) {
  if (!time) return '-'
  const [hourStr, minute] = time.split(':')
  const hour = parseInt(hourStr)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12
  return hour12 + ':' + minute + ' ' + ampm
}

export async function GET(request, { params }) {
  const { data: log, error } = await supabase
    .from('pour_logs')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !log) {
    return new Response('Pour log not found', { status: 404 })
  }

  const { data: foundations } = await supabase
    .from('pour_log_foundations')
    .select('*')
    .eq('pour_log_id', log.id)

  const { data: trucks } = await supabase
    .from('pour_log_trucks')
    .select('*')
    .eq('pour_log_id', log.id)
    .order('truck_number', { ascending: true })

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

  page.drawRectangle({ x: 0, y: height - 80, width: 612, height: 80, color: COLORS.brand })
  page.drawText('DRILLED SHAFT POUR LOG', { x: 40, y: height - 45, size: 20, font: boldFont, color: rgb(1, 1, 1) })
  page.drawText(companyName, { x: 40, y: height - 65, size: 11, font, color: rgb(0.84, 0.9, 0.96) })

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

  let y = height - 100

  const drawLine = (yPos) => {
    page.drawLine({ start: { x: 40, y: yPos }, end: { x: 572, y: yPos }, thickness: 0.7, color: COLORS.line })
  }

  const drawSectionHeader = (text, yPos) => {
    page.drawRectangle({ x: 40, y: yPos - 4, width: 532, height: 18, color: COLORS.brand })
    page.drawText(text, { x: 44, y: yPos, size: 10, font: boldFont, color: rgb(1, 1, 1) })
    return yPos - 24
  }

  y = drawSectionHeader('JOB INFO', y)
  page.drawRectangle({ x: 40, y: y - 58, width: 532, height: 60, color: COLORS.card, borderColor: COLORS.line, borderWidth: 1 })
  page.drawText('PROJECT: ' + (log.project_name || '-'), { x: 52, y: y - 14, size: 10, font: boldFont, color: COLORS.ink })
  y -= 16
  page.drawText('DATE: ' + formatDate(log.log_date) + '   WEATHER: ' + (log.weather || '-') + '   TEMP: ' + (log.ambient_temp || '-'), { x: 52, y: y - 14, size: 9, font, color: COLORS.body })
  y -= 14
  page.drawText('SUPPLIER: ' + (log.concrete_supplier || '-') + '   SUBMITTED BY: ' + (log.submitted_by || '-'), { x: 52, y: y - 14, size: 9, font, color: COLORS.body })
  y -= 32
  drawLine(y)
  y -= 14

  if (foundations && foundations.length > 0) {
    y = drawSectionHeader('FOUNDATIONS POURED', y)
    for (const f of foundations) {
      if (y < 100) break
      page.drawText(f.foundation_id || '-', { x: 40, y, size: 11, font: boldFont, color: COLORS.ink })
      y -= 16
      page.drawText('Depth: ' + (f.total_depth || '-') + '   Est. Yards: ' + (f.estimated_yards || '-'), { x: 44, y, size: 9, font, color: COLORS.body })
      y -= 14
      if (f.notes) {
        page.drawText('Notes: ' + f.notes, { x: 44, y, size: 9, font, color: COLORS.body })
        y -= 14
      }
      y -= 6
    }
    drawLine(y)
    y -= 14
  }

  if (trucks && trucks.length > 0) {
    y = drawSectionHeader('CONCRETE TRUCKS', y)
    for (const t of trucks) {
      if (y < 120) break
      page.drawText('TRUCK ' + t.truck_number, { x: 40, y, size: 11, font: boldFont, color: COLORS.ink })
      y -= 16
      page.drawText('Arrival: ' + formatTime(t.arrival_time) + '   Start: ' + formatTime(t.pour_start) + '   Complete: ' + formatTime(t.pour_complete), { x: 44, y, size: 9, font, color: COLORS.body })
      y -= 14
      page.drawText('Yards: ' + (t.yards || '-') + '   Temp: ' + (t.concrete_temp || '-') + '   Slump: ' + (t.slump || '-') + '   Air: ' + (t.air_content || '-'), { x: 44, y, size: 9, font, color: COLORS.body })
      y -= 14
      page.drawText('Water Added: ' + (t.water_added || '-') + '   Cylinders: ' + (t.cylinders_cast || '-') + '   Depth Reading: ' + (t.depth_reading || '-'), { x: 44, y, size: 9, font, color: COLORS.body })
      y -= 14
      if (t.foundations_served) {
        page.drawText('Foundations Served: ' + t.foundations_served, { x: 44, y, size: 9, font, color: COLORS.body })
        y -= 14
      }
      if (t.notes) {
        page.drawText('Notes: ' + t.notes, { x: 44, y, size: 9, font, color: COLORS.body })
        y -= 14
      }
      y -= 8
      drawLine(y)
      y -= 12
    }
  }

  // Photos section
  if (log.photo_urls && log.photo_urls.length > 0) {
    const photoWidth = 245
    const photoHeight = 180
    const xPositions = [40, 307]

    let photoPage = pdfDoc.addPage([612, 792])
    photoPage.drawRectangle({ x: 0, y: 792 - 50, width: 612, height: 50, color: COLORS.brand })
    photoPage.drawText('PHOTOS', { x: 40, y: 792 - 35, size: 16, font: boldFont, color: rgb(1, 1, 1) })

    let photoY = 792 - 80
    let col = 0

    for (const url of log.photo_urls) {
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

        if (photoY - photoHeight < 40) {
          photoPage = pdfDoc.addPage([612, 792])
          photoY = 792 - 60
          col = 0
        }

        photoPage.drawRectangle({
          x: xPositions[col],
          y: photoY - photoHeight - 8,
          width: photoWidth,
          height: photoHeight + 16,
          color: rgb(1, 1, 1),
          borderColor: COLORS.line,
          borderWidth: 1,
        })
        photoPage.drawImage(img, { x: xPositions[col] + 8, y: photoY - photoHeight, width: photoWidth - 16, height: photoHeight - 8 })

        col++
        if (col >= 2) {
          col = 0
          photoY -= photoHeight + 20
        }
      } catch (err) {
        console.error('Failed to embed photo:', err)
      }
    }
  }

  page.drawText('Generated by ' + companyName + ' - ' + new Date().toLocaleDateString(), {
    x: 40, y: 25, size: 8, font, color: COLORS.muted
  })

  const pdfBytes = await pdfDoc.save()

  return new Response(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="pour-log-' + log.project_name + '-' + log.log_date + '.pdf"'
    }
  })
}
