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

function drawWeatherBand(page, reports, x, y, width, font, bold) {
  const halfW = (width - 8) / 2
  const headerH = 18
  const bodyH = 44

  // Header
  page.drawRectangle({ x, y: y - headerH, width, height: headerH, color: COLORS.brand })
  page.drawText('WEATHER', { x: x + 12, y: y - 13, size: 9, font: bold, color: rgb(1, 1, 1) })

  // Compute summary values
  const temps = reports.map(r => {
    const m = String(r.weather || '').match(/(-?\d+)\s*°?\s*F/i)
    return m ? Number(m[1]) : null
  }).filter(t => t !== null)
  const avgTemp = temps.length ? Math.round(temps.reduce((a, b) => a + b, 0) / temps.length) : null

  const raw = String(reports.find(r => r.weather)?.weather || '').toLowerCase()
  let condition = 'Unknown'
  if (raw.includes('thunder')) condition = 'Thunderstorm'
  else if (raw.includes('snow')) condition = 'Snow'
  else if (raw.includes('rain') || raw.includes('drizzle')) condition = 'Rain'
  else if (raw.includes('fog') || raw.includes('mist')) condition = 'Fog'
  else if (raw.includes('overcast') || raw.includes('cloud')) condition = 'Cloudy'
  else if (raw.includes('clear') || raw.includes('sun')) condition = 'Clear'
  else if (raw) condition = 'Mixed'

  const delays = reports.filter(r => r.weather_delay)
  const delayHours = delays.reduce((sum, r) => sum + (Number(r.weather_delay_hours) || 0), 0)

  // Left cell: conditions
  page.drawRectangle({ x, y: y - headerH - bodyH, width: halfW, height: bodyH, color: rgb(1,1,1), borderColor: COLORS.line, borderWidth: 1 })
  page.drawText('CONDITIONS', { x: x + 10, y: y - headerH - 14, size: 7.5, font: bold, color: COLORS.muted })
  const condText = avgTemp !== null ? `${avgTemp}°F avg · ${condition}` : (condition !== 'Unknown' ? condition : 'Not recorded')
  page.drawText(condText, { x: x + 10, y: y - headerH - 32, size: 11, font, color: COLORS.ink })

  // Right cell: delay status
  const delayText = delays.length
    ? `${delays.length} delay${delays.length !== 1 ? 's' : ''}${delayHours ? ` · ${delayHours} hrs lost` : ''}`
    : 'No Weather Delays'
  const delayColor = delays.length ? COLORS.warn : COLORS.success
  page.drawRectangle({ x: x + halfW + 8, y: y - headerH - bodyH, width: halfW, height: bodyH, color: rgb(1,1,1), borderColor: COLORS.line, borderWidth: 1 })
  page.drawText('WEATHER DELAYS', { x: x + halfW + 18, y: y - headerH - 14, size: 7.5, font: bold, color: COLORS.muted })
  page.drawText(delayText, { x: x + halfW + 18, y: y - headerH - 32, size: 11, font: bold, color: delayColor })

  return y - headerH - bodyH - 18
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
