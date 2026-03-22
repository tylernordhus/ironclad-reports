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
  brandSoft: rgb(0.9, 0.94, 0.98),
  accent: rgb(0.83, 0.34, 0.12),
  success: rgb(0.2, 0.53, 0.26),
  warn: rgb(0.75, 0.45, 0.1),
}

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

function parseTemperature(weather) {
  const match = String(weather || '').match(/(-?\d+)\s*°?\s*F/i)
  return match ? Number(match[1]) : null
}

function normalizeCondition(weather) {
  const raw = String(weather || '').toLowerCase()
  if (!raw) return 'Unknown'
  if (raw.includes('thunder')) return 'Thunderstorm'
  if (raw.includes('snow')) return 'Snow'
  if (raw.includes('rain') || raw.includes('drizzle') || raw.includes('shower')) return 'Rain'
  if (raw.includes('fog') || raw.includes('mist')) return 'Fog'
  if (raw.includes('overcast') || raw.includes('cloud')) return 'Cloudy'
  if (raw.includes('clear') || raw.includes('sun')) return 'Clear'
  return 'Mixed'
}

function conditionAccent(condition) {
  if (condition === 'Thunderstorm') return rgb(0.93, 0.73, 0.22)
  if (condition === 'Rain') return rgb(0.2, 0.57, 0.82)
  if (condition === 'Snow') return rgb(0.69, 0.82, 0.93)
  if (condition === 'Fog') return rgb(0.62, 0.67, 0.74)
  if (condition === 'Cloudy') return rgb(0.47, 0.58, 0.7)
  if (condition === 'Clear') return rgb(0.95, 0.77, 0.26)
  return rgb(0.45, 0.55, 0.68)
}

function drawWeatherIcon(page, condition, x, y, scale = 1) {
  const sun = rgb(0.97, 0.8, 0.31)
  const cloudFill = rgb(0.95, 0.96, 0.98)
  const cloudStroke = rgb(0.78, 0.81, 0.86)
  const rain = rgb(0.22, 0.61, 0.87)

  if (condition === 'Clear' || condition === 'Mixed') {
    page.drawCircle({ x: x + 18 * scale, y: y + 18 * scale, size: 15 * scale, color: sun })
  }

  if (condition === 'Cloudy' || condition === 'Rain' || condition === 'Thunderstorm' || condition === 'Fog' || condition === 'Snow' || condition === 'Mixed') {
    if (condition !== 'Cloudy' && condition !== 'Fog') {
      page.drawCircle({ x: x + 14 * scale, y: y + 20 * scale, size: 12 * scale, color: sun, opacity: 0.9 })
    }
    page.drawCircle({ x: x + 22 * scale, y: y + 16 * scale, size: 12 * scale, color: cloudFill, borderColor: cloudStroke, borderWidth: 1 })
    page.drawCircle({ x: x + 34 * scale, y: y + 20 * scale, size: 16 * scale, color: cloudFill, borderColor: cloudStroke, borderWidth: 1 })
    page.drawCircle({ x: x + 48 * scale, y: y + 16 * scale, size: 12 * scale, color: cloudFill, borderColor: cloudStroke, borderWidth: 1 })
    page.drawRectangle({ x: x + 18 * scale, y: y + 6 * scale, width: 34 * scale, height: 15 * scale, color: cloudFill, borderColor: cloudStroke, borderWidth: 1 })
  }

  if (condition === 'Rain' || condition === 'Thunderstorm') {
    page.drawLine({ start: { x: x + 24 * scale, y: y + 2 * scale }, end: { x: x + 20 * scale, y: y - 8 * scale }, thickness: 2, color: rain })
    page.drawLine({ start: { x: x + 36 * scale, y: y + 2 * scale }, end: { x: x + 32 * scale, y: y - 8 * scale }, thickness: 2, color: rain })
    page.drawLine({ start: { x: x + 48 * scale, y: y + 2 * scale }, end: { x: x + 44 * scale, y: y - 8 * scale }, thickness: 2, color: rain })
  }

  if (condition === 'Thunderstorm') {
    page.drawLine({ start: { x: x + 31 * scale, y: y + 2 * scale }, end: { x: x + 24 * scale, y: y - 9 * scale }, thickness: 2.5, color: sun })
    page.drawLine({ start: { x: x + 24 * scale, y: y - 9 * scale }, end: { x: x + 33 * scale, y: y - 9 * scale }, thickness: 2.5, color: sun })
    page.drawLine({ start: { x: x + 33 * scale, y: y - 9 * scale }, end: { x: x + 27 * scale, y: y - 19 * scale }, thickness: 2.5, color: sun })
  }

  if (condition === 'Fog') {
    for (const offset of [0, -6, -12]) {
      page.drawLine({ start: { x: x + 14 * scale, y: y + offset }, end: { x: x + 54 * scale, y: y + offset }, thickness: 1.5, color: cloudStroke })
    }
  }

  if (condition === 'Snow') {
    for (const cx of [24, 36, 48]) {
      page.drawCircle({ x: x + cx * scale, y: y - 4 * scale, size: 2.5 * scale, color: rgb(0.73, 0.86, 0.97) })
    }
  }
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

  function drawLogo(page) {
    if (!settings?.logo_url) return
    try {
      return fetch(settings.logo_url)
        .then(res => res.arrayBuffer())
        .then(async buffer => {
          const bytes = new Uint8Array(buffer)
          let logoImg
          try { logoImg = await pdfDoc.embedPng(bytes) } catch { logoImg = await pdfDoc.embedJpg(bytes) }
          const { width: lw, height: lh } = logoImg.scale(1)
          const scale = Math.min(104 / lw, 46 / lh)
          page.drawImage(logoImg, { x: W - margin - lw * scale, y: H - 62, width: lw * scale, height: lh * scale })
        })
        .catch(() => {})
    } catch {}
  }

  function addPage(title, subtitle) {
    const page = pdfDoc.addPage([W, H])
    page.drawRectangle({ x: 0, y: H - 72, width: W, height: 72, color: COLORS.brand })
    page.drawText(title, { x: margin, y: H - 38, size: 20, font: bold, color: rgb(1, 1, 1) })
    page.drawText(subtitle || companyName, { x: margin, y: H - 58, size: 10, font, color: rgb(0.84, 0.9, 0.96) })
    return page
  }

  function drawFooter(page, pageLabel = '') {
    const footer = pageLabel ? `${companyName} · ${pageLabel}` : companyName
    page.drawText(footer, { x: margin, y: 22, size: 8, font, color: COLORS.muted })
  }

  function drawMetricCard(page, x, y, width, label, value, tone) {
    page.drawRectangle({
      x,
      y,
      width,
      height: 54,
      color: rgb(1, 1, 1),
      borderColor: COLORS.line,
      borderWidth: 1,
    })
    page.drawRectangle({ x, y: y + 48, width, height: 6, color: tone || COLORS.accent })
    page.drawText(label, { x: x + 12, y: y + 33, size: 8, font: bold, color: COLORS.muted })
    page.drawText(String(value || '-'), { x: x + 12, y: y + 14, size: 13, font, color: COLORS.ink })
  }

  function drawSectionBar(page, text, y) {
    page.drawRectangle({ x: margin, y: y - 16, width: W - margin * 2, height: 18, color: COLORS.brand })
    page.drawText(text, { x: margin + 12, y: y - 11, size: 9, font: bold, color: rgb(1, 1, 1) })
    return y - 28
  }

  function drawParagraphBlock(page, label, value, y, maxChars = 84) {
    let currentY = drawSectionBar(page, label, y)
    page.drawRectangle({
      x: margin,
      y: currentY - 12,
      width: W - margin * 2,
      height: 12,
      color: COLORS.card,
    })
    currentY -= 6
    const lines = wrapText(value, maxChars)
    for (const line of lines) {
      page.drawText(line, { x: margin + 12, y: currentY, size: 10.5, font, color: COLORS.body })
      currentY -= 15
    }
    page.drawLine({ start: { x: margin, y: currentY - 4 }, end: { x: W - margin, y: currentY - 4 }, thickness: 0.7, color: COLORS.line })
    return currentY - 18
  }

  const page1 = addPage('DAILY FIELD REPORT', report.project_name || 'Project')
  await drawLogo(page1)

  let y = H - 104

  page1.drawText(report.project_name || 'Project', { x: margin, y, size: 17, font: bold, color: COLORS.ink })
  page1.drawText(formatDate(report.report_date), { x: W - margin - 72, y, size: 11, font: bold, color: COLORS.brand })
  y -= 24

  const cardW = (W - margin * 2 - 16) / 3
  drawMetricCard(page1, margin, y - 54, cardW, 'Submitted By', report.submitted_by, COLORS.brand)
  drawMetricCard(page1, margin + cardW + 8, y - 54, cardW, 'Crew On Site', report.crew_count, COLORS.accent)
  drawMetricCard(page1, margin + (cardW + 8) * 2, y - 54, cardW, 'Schedule', report.on_schedule === false ? 'Behind Schedule' : 'On Schedule', report.on_schedule === false ? COLORS.warn : COLORS.success)
  y -= 76

  const weatherCondition = normalizeCondition(report.weather)
  const weatherTemp = parseTemperature(report.weather)
  const weatherAccent = conditionAccent(weatherCondition)
  page1.drawRectangle({ x: margin, y: y - 18, width: W - margin * 2, height: 18, color: COLORS.brand })
  page1.drawText('WEATHER', { x: margin + 12, y: y - 13, size: 9, font: bold, color: rgb(1, 1, 1) })
  page1.drawRectangle({
    x: margin,
    y: y - 98,
    width: W - margin * 2,
    height: 72,
    color: COLORS.brandSoft,
    borderColor: COLORS.line,
    borderWidth: 1,
  })
  drawWeatherIcon(page1, weatherCondition, margin + 16, y - 82, 1)
  page1.drawText(weatherTemp !== null ? `${weatherTemp}°F` : (report.weather || 'Weather Logged'), {
    x: margin + 96,
    y: y - 58,
    size: 24,
    font: bold,
    color: COLORS.ink,
  })
  page1.drawText(weatherCondition, { x: margin + 96, y: y - 76, size: 10, font, color: COLORS.muted })
  page1.drawRectangle({
    x: W - margin - 140,
    y: y - 76,
    width: 128,
    height: 24,
    color: report.weather_delay ? rgb(0.99, 0.94, 0.88) : rgb(0.92, 0.97, 0.93),
    borderColor: report.weather_delay ? rgb(0.93, 0.72, 0.43) : rgb(0.61, 0.79, 0.64),
    borderWidth: 1,
  })
  page1.drawText(
    report.weather_delay
      ? `Delay${report.weather_delay_hours ? ` · ${report.weather_delay_hours} hrs` : ''}`
      : 'No Delay Logged',
    {
      x: W - margin - 128,
      y: y - 68,
      size: 8,
      font: bold,
      color: report.weather_delay ? COLORS.warn : COLORS.success,
    }
  )
  page1.drawText(report.weather || '-', { x: margin + 96, y: y - 90, size: 9, font, color: COLORS.body })
  page1.drawRectangle({ x: margin, y: y - 32, width: 8, height: 48, color: weatherAccent })
  y -= 118

  y = drawParagraphBlock(page1, 'WORK COMPLETED TODAY', report.work_completed, y)
  y = drawParagraphBlock(page1, 'EQUIPMENT USED', report.equipment_used, y)
  y = drawParagraphBlock(page1, 'SAFETY / ISSUES', report.safety_issues, y)

  drawFooter(page1, formatDate(report.report_date))

  if (report.photo_urls && report.photo_urls.length > 0) {
    const photoLabels = report.photo_labels || []
    const photoW = 248
    const photoH = 176
    const xPositions = [margin, margin + photoW + 16]

    let photoPage = addPage('SITE PHOTOS', `${report.project_name || 'Project'} · ${formatDate(report.report_date)}`)
    await drawLogo(photoPage)

    let photoY = H - 110
    let col = 0

    for (let i = 0; i < report.photo_urls.length; i++) {
      const url = report.photo_urls[i]
      const label = photoLabels[i] || ''
      try {
        const res = await fetch(url)
        const imgBytes = new Uint8Array(await res.arrayBuffer())
        let img
        try { img = await pdfDoc.embedJpg(imgBytes) } catch { img = await pdfDoc.embedPng(imgBytes) }

        const cardHeight = photoH + (label ? 34 : 18)
        if (photoY - cardHeight < 48) {
          drawFooter(photoPage, 'Site Photos')
          photoPage = addPage('SITE PHOTOS', `${report.project_name || 'Project'} · ${formatDate(report.report_date)}`)
          await drawLogo(photoPage)
          photoY = H - 110
          col = 0
        }

        const x = xPositions[col]
        photoPage.drawRectangle({
          x,
          y: photoY - cardHeight,
          width: photoW,
          height: cardHeight,
          color: rgb(1, 1, 1),
          borderColor: COLORS.line,
          borderWidth: 1,
        })
        photoPage.drawImage(img, { x: x + 8, y: photoY - photoH - 8, width: photoW - 16, height: photoH })
        if (label) {
          photoPage.drawText(label, { x: x + 10, y: photoY - cardHeight + 10, size: 8.5, font: bold, color: COLORS.body })
        }

        col++
        if (col >= 2) {
          col = 0
          photoY -= cardHeight + 18
        }
      } catch (err) {
        console.error('Failed to embed photo:', err)
      }
    }

    drawFooter(photoPage, 'Site Photos')
  }

  const pdfBytes = await pdfDoc.save()

  return new Response(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="daily-report-${report.project_name}-${report.report_date}.pdf"`,
    },
  })
}
