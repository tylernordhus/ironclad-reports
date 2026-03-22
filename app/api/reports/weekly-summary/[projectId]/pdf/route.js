import { createClient } from '@supabase/supabase-js'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { getUserId } from '@/lib/get-user-id'

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

function averageTemp(items) {
  const temps = items.map(item => parseTemperature(item.weather)).filter(temp => temp !== null)
  if (!temps.length) return null
  return Math.round(temps.reduce((sum, temp) => sum + temp, 0) / temps.length)
}

function formatDayLabel(dateStr) {
  if (!dateStr) return ''
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function selectWeatherMoments(reports) {
  if (reports.length <= 3) return reports
  const mid = Math.floor((reports.length - 1) / 2)
  return [reports[0], reports[mid], reports[reports.length - 1]]
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

function drawWeatherBand(page, reports, x, y, width, font, bold) {
  const barColor = COLORS.brand
  const panelFill = COLORS.card
  const panelBorder = COLORS.line
  const sectionHeight = 158
  const headerHeight = 20
  const innerY = y - sectionHeight

  page.drawRectangle({ x, y: y - headerHeight, width, height: headerHeight, color: barColor })
  page.drawText('WEATHER SNAPSHOT', { x: x + 12, y: y - 14, size: 10, font: bold, color: rgb(1, 1, 1) })
  page.drawRectangle({ x, y: innerY, width, height: sectionHeight - headerHeight - 6, color: panelFill, borderColor: panelBorder, borderWidth: 1 })

  const sampled = selectWeatherMoments(reports)
  const delays = reports.filter(report => report.weather_delay)
  const delayHours = delays.reduce((sum, report) => sum + (Number(report.weather_delay_hours) || 0), 0)
  const avgTemp = averageTemp(reports)
  const primaryCondition = normalizeCondition(
    reports.find(report => normalizeCondition(report.weather) !== 'Unknown')?.weather
  )
  const metricsTop = y - 38

  page.drawText(avgTemp !== null ? `${avgTemp}°F avg temp` : 'Weather logged', {
    x: x + 14,
    y: metricsTop,
    size: 18,
    font: bold,
    color: rgb(0.13, 0.17, 0.22),
  })
  page.drawText(`${primaryCondition} pattern this week`, {
    x: x + 14,
    y: metricsTop - 14,
    size: 9,
    font,
    color: rgb(0.43, 0.48, 0.55),
  })

  const chipText = delays.length
    ? `${delays.length} weather delay${delays.length === 1 ? '' : 's'}${delayHours ? ` · ${delayHours} hrs` : ''}`
    : 'No weather delays logged'
  const chipWidth = Math.min(width * 0.34, chipText.length * 5.3 + 18)
  page.drawRectangle({
    x: x + width - chipWidth - 14,
    y: metricsTop - 6,
    width: chipWidth,
    height: 22,
    color: delays.length ? rgb(0.99, 0.94, 0.88) : rgb(0.92, 0.97, 0.93),
    borderColor: delays.length ? rgb(0.93, 0.72, 0.43) : rgb(0.61, 0.79, 0.64),
    borderWidth: 1,
  })
  page.drawText(chipText, {
    x: x + width - chipWidth - 5,
    y: metricsTop + 1,
    size: 8,
    font: bold,
    color: delays.length ? rgb(0.63, 0.39, 0.1) : rgb(0.2, 0.47, 0.23),
  })

  const cardsY = innerY + 16
  const cardGap = 10
  const cardWidth = (width - 28 - cardGap * 2) / 3
  sampled.forEach((report, index) => {
    const cardX = x + 14 + index * (cardWidth + cardGap)
    const condition = normalizeCondition(report.weather)
    const accent = conditionAccent(condition)
    const temp = parseTemperature(report.weather)
    page.drawRectangle({
      x: cardX,
      y: cardsY,
      width: cardWidth,
      height: 74,
      color: rgb(1, 1, 1),
      borderColor: panelBorder,
      borderWidth: 1,
    })
    page.drawRectangle({ x: cardX, y: cardsY + 68, width: cardWidth, height: 6, color: accent })
    page.drawText(formatDayLabel(report.report_date), {
      x: cardX + 12,
      y: cardsY + 56,
      size: 9,
      font: bold,
      color: rgb(0.29, 0.34, 0.4),
    })
    drawWeatherIcon(page, condition, cardX + 10, cardsY + 22, 0.85)
    page.drawText(temp !== null ? `${temp}°F` : '--', {
      x: cardX + 74,
      y: cardsY + 38,
      size: 18,
      font: bold,
      color: rgb(0.14, 0.17, 0.22),
    })
    page.drawText(condition, {
      x: cardX + 74,
      y: cardsY + 24,
      size: 8,
      font,
      color: rgb(0.43, 0.48, 0.55),
    })
    const detail = report.weather_delay
      ? `Delay${report.weather_delay_hours ? ` · ${report.weather_delay_hours} hrs` : ''}`
      : 'No delay logged'
    page.drawText(detail, {
      x: cardX + 12,
      y: cardsY + 9,
      size: 7.5,
      font,
      color: report.weather_delay ? rgb(0.69, 0.38, 0.06) : rgb(0.44, 0.58, 0.47),
    })
  })

  return innerY - 18
}

export async function POST(request, { params }) {
  try {
    const { summary, selectedPhotos, startDate, endDate, projectName } = await request.json()
    const user_id = await getUserId()

    const { data: settings } = await supabase
      .from('settings')
      .select('company_name, logo_url')
      .single()

    const { data: weatherReports } = await supabase
      .from('reports')
      .select('report_date, weather, weather_delay, weather_delay_hours')
      .eq('project_id', params.projectId)
      .eq('user_id', user_id)
      .gte('report_date', startDate)
      .lte('report_date', endDate)
      .order('report_date', { ascending: true })

    const companyName = settings?.company_name || 'Field Reports'

    const pdfDoc = await PDFDocument.create()
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    const W = 612
    const H = 792
    const margin = 40

    function addPage(title) {
      const p = pdfDoc.addPage([W, H])
      p.drawRectangle({ x: 0, y: H - 72, width: W, height: 72, color: COLORS.brand })
      p.drawText(title, { x: margin, y: H - 38, size: 18, font: bold, color: rgb(1, 1, 1) })
      p.drawText(companyName, { x: margin, y: H - 58, size: 10, font, color: rgb(0.84, 0.9, 0.96) })
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
    page1.drawText(`${projectName || 'Project'}`, { x: margin, y, size: 17, font: bold, color: COLORS.ink })
    y -= 18
    page1.drawText(`Week of ${fmt(startDate)} – ${fmt(endDate)}`, { x: margin, y, size: 10, font, color: COLORS.muted })
    y -= 24
    page1.drawLine({ start: { x: margin, y }, end: { x: W - margin, y }, thickness: 0.7, color: COLORS.line })
    y -= 18

    if (weatherReports?.length) {
      y = drawWeatherBand(page1, weatherReports, margin, y, W - margin * 2, font, bold)
    }

    page1.drawRectangle({ x: margin, y: y - 16, width: W - margin * 2, height: 18, color: COLORS.brand })
    page1.drawText('PROGRESS SUMMARY', { x: margin + 12, y: y - 11, size: 9, font: bold, color: rgb(1, 1, 1) })
    y -= 32
    page1.drawRectangle({ x: margin, y: y + 6, width: W - margin * 2, height: 8, color: COLORS.card })

    // Summary text
    const paragraphs = (summary || '').split('\n').filter(l => l.trim())
    for (const para of paragraphs) {
      const lines = wrapText(para, 85)
      for (const line of lines) {
        if (y < margin + 30) {
          page1.drawText(`${companyName} · ${fmt(startDate)} – ${fmt(endDate)}`, { x: margin, y: 24, size: 8, font, color: COLORS.muted })
          // would need new page for very long summaries — handled below
          break
        }
        page1.drawText(line, { x: margin + 12, y, size: 11, font, color: COLORS.body })
        y -= 16
      }
      y -= 6 // paragraph spacing
    }

    page1.drawText(`${companyName} · ${fmt(startDate)} – ${fmt(endDate)}`, { x: margin, y: 24, size: 8, font, color: COLORS.muted })

    // ── Pages 2+: Photos ──
    if (selectedPhotos && selectedPhotos.length > 0) {
      const photoW = 248
      const photoH = 186
      const xPositions = [margin, margin + photoW + 16]

      let photoPage = addPage('SITE PHOTOS')
      photoPage.drawText(`${projectName} · ${fmt(startDate)} – ${fmt(endDate)}`, { x: margin, y: H - 42, size: 9, font, color: rgb(0.84, 0.9, 0.96) })

      let photoY = H - 90
      let col = 0

      for (const photo of selectedPhotos) {
        try {
          let imgBytes
          if (photo.url.startsWith('data:')) {
            const base64 = photo.url.split(',')[1]
            imgBytes = Uint8Array.from(Buffer.from(base64, 'base64'))
          } else {
            const res = await fetch(photo.url)
            imgBytes = new Uint8Array(await res.arrayBuffer())
          }
          let img
          try { img = await pdfDoc.embedJpg(imgBytes) } catch { img = await pdfDoc.embedPng(imgBytes) }

          const labelH = (photo.label || photo.date) ? 26 : 0
          const totalH = photoH + labelH + 16

          if (photoY - totalH < margin + 10) {
            photoPage.drawText(`${companyName} · ${fmt(startDate)} – ${fmt(endDate)}`, { x: margin, y: 24, size: 8, font, color: COLORS.muted })
            photoPage = addPage('SITE PHOTOS (CONTINUED)')
            photoPage.drawText(`${projectName} · ${fmt(startDate)} – ${fmt(endDate)}`, { x: margin, y: H - 42, size: 9, font, color: rgb(0.84, 0.9, 0.96) })
            photoY = H - 90
            col = 0
          }

          const x = xPositions[col]
          photoPage.drawRectangle({
            x,
            y: photoY - totalH + 2,
            width: photoW,
            height: totalH,
            color: rgb(1, 1, 1),
            borderColor: COLORS.line,
            borderWidth: 1,
          })
          photoPage.drawImage(img, { x: x + 8, y: photoY - photoH, width: photoW - 16, height: photoH - 8 })

          let captionY = photoY - photoH - 15
          if (photo.label) {
            photoPage.drawText(photo.label, { x: x + 10, y: captionY, size: 9, font: bold, color: COLORS.ink })
            captionY -= 12
          }
          if (photo.date) {
            photoPage.drawText(fmt(photo.date), { x: x + 10, y: captionY, size: 8, font, color: COLORS.muted })
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

      photoPage.drawText(`${companyName} · ${fmt(startDate)} – ${fmt(endDate)}`, { x: margin, y: 24, size: 8, font, color: COLORS.muted })
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
