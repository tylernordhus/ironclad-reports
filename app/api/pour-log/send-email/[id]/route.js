import { createClient } from '@supabase/supabase-js'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import sharp from 'sharp'
import { getTruckEstimatedLeftover, isRejectedTruck, stripRejectedMarker } from '@/lib/pour-log-trucks'
import { recordAuditEvent } from '@/lib/audit-log'
import { getUserId } from '@/lib/get-user-id'
import { getAccessiblePourLogById, getPourLogChildren } from '@/lib/pour-log-access'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

function formatTime(time) {
  if (!time) return '-'
  const [hourStr, minute] = time.split(':')
  const hour = parseInt(hourStr)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12
  return hour12 + ':' + minute + ' ' + ampm
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const [year, month, day] = dateStr.split('-')
  return month + '-' + day + '-' + year
}

async function sendEmailWithResend(payload) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || 'Failed to send email.')
  }
}

async function embedPhotoFromUrl(pdfDoc, url) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch photo: ${res.status}`)
  }

  const arrayBuffer = await res.arrayBuffer()
  const normalizedBytes = await sharp(Buffer.from(arrayBuffer))
    .rotate()
    .jpeg({ quality: 85 })
    .toBuffer()

  return pdfDoc.embedJpg(normalizedBytes)
}

function fitImageWithinBox(img, maxWidth, maxHeight) {
  const { width, height } = img.scale(1)
  const scale = Math.min(maxWidth / width, maxHeight / height)
  return {
    width: width * scale,
    height: height * scale,
  }
}

function drawPhotoGridPage(pdfDoc, photos, font, boldFont) {
  const page = pdfDoc.addPage([612, 792])
  const pageHeight = 792
  const pageWidth = 612
  const marginX = 40
  const headerHeight = 50
  const topStart = pageHeight - 80
  const gapX = 18
  const gapY = 28
  const columns = 2
  const rows = 2
  const cellWidth = (pageWidth - (marginX * 2) - gapX) / columns
  const cellHeight = 290
  const imageAreaHeight = 248

  page.drawRectangle({ x: 0, y: pageHeight - headerHeight, width: pageWidth, height: headerHeight, color: rgb(0.1, 0.1, 0.1) })
  page.drawText('PHOTOS', { x: 40, y: pageHeight - 35, size: 16, font: boldFont, color: rgb(1, 1, 1) })

  photos.forEach((photo, index) => {
    const row = Math.floor(index / columns)
    const col = index % columns
    if (row >= rows) return

    const x = marginX + (col * (cellWidth + gapX))
    const topY = topStart - (row * (cellHeight + gapY))
    const fitted = fitImageWithinBox(photo.img, cellWidth, imageAreaHeight)
    const imageX = x + ((cellWidth - fitted.width) / 2)
    const imageY = topY - fitted.height - ((imageAreaHeight - fitted.height) / 2)

    page.drawImage(photo.img, {
      x: imageX,
      y: imageY,
      width: fitted.width,
      height: fitted.height,
    })

    if (photo.label) {
      page.drawText(photo.label, {
        x,
        y: topY - imageAreaHeight - 18,
        size: 9,
        font,
        color: rgb(0.3, 0.3, 0.3),
        maxWidth: cellWidth,
        lineHeight: 11,
      })
    }
  })
}

export async function GET(request, { params }) {
  const actorUserId = await getUserId()
  if (!actorUserId) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { log, error } = await getAccessiblePourLogById(supabase, { logId: params.id, userId: actorUserId })
  if (error || !log) {
    return new Response('Pour log not found', { status: 404 })
  }

  const { foundations, trucks: sortedTrucks } = await getPourLogChildren(supabase, log.id)

  const { data: project } = log.project_id ? await supabase
    .from('projects')
    .select('client_email, client_name')
    .eq('id', log.project_id)
    .single() : { data: null }

  const { data: settings } = await supabase
    .from('settings')
    .select('company_name')
    .single()

  const companyName = settings?.company_name || 'Ironclad Construction LLC'

  // Generate PDF
  const pdfDoc = await PDFDocument.create()
  let page = pdfDoc.addPage([612, 792])
  const contentPages = [page]
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const { height } = page.getSize()

  const drawPageHeader = (targetPage) => {
    targetPage.drawRectangle({ x: 0, y: height - 80, width: 612, height: 80, color: rgb(0.1, 0.1, 0.1) })
    targetPage.drawText('DRILLED SHAFT POUR LOG', { x: 40, y: height - 45, size: 20, font: boldFont, color: rgb(1, 1, 1) })
    targetPage.drawText(companyName, { x: 40, y: height - 65, size: 11, font, color: rgb(0.8, 0.8, 0.8) })
  }

  const addContentPage = () => {
    page = pdfDoc.addPage([612, 792])
    contentPages.push(page)
    drawPageHeader(page)
    return height - 100
  }

  drawPageHeader(page)

  let y = height - 100

  const drawLine = (yPos) => {
    page.drawLine({ start: { x: 40, y: yPos }, end: { x: 572, y: yPos }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) })
  }

  const drawSectionHeader = (text, yPos) => {
    page.drawRectangle({ x: 40, y: yPos - 4, width: 532, height: 18, color: rgb(0.95, 0.95, 0.95) })
    page.drawText(text, { x: 44, y: yPos, size: 10, font: boldFont, color: rgb(0.2, 0.2, 0.2) })
    return yPos - 24
  }

  const ensureSpace = (requiredHeight, sectionTitle) => {
    if (y - requiredHeight < 40) {
      y = addContentPage()
      if (sectionTitle) {
        y = drawSectionHeader(sectionTitle, y)
      }
    }
  }

  y = drawSectionHeader('JOB INFO', y)
  page.drawText('PROJECT: ' + (log.project_name || '-'), { x: 40, y, size: 10, font: boldFont, color: rgb(0.1, 0.1, 0.1) })
  y -= 16
  page.drawText('DATE: ' + formatDate(log.log_date) + '   WEATHER: ' + (log.weather || '-') + '   TEMP: ' + (log.ambient_temp || '-'), { x: 40, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) })
  y -= 14
  page.drawText('SUPPLIER: ' + (log.concrete_supplier || '-') + '   SUBMITTED BY: ' + (log.submitted_by || '-'), { x: 40, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) })
  y -= 18
  drawLine(y)
  y -= 14

  if (foundations && foundations.length > 0) {
    y = drawSectionHeader('FOUNDATIONS POURED', y)
    for (const f of foundations) {
      const itemHeight = f.notes ? 78 : 64
      ensureSpace(itemHeight, 'FOUNDATIONS POURED')
      page.drawText(f.foundation_id || '-', { x: 40, y, size: 11, font: boldFont, color: rgb(0.1, 0.1, 0.1) })
      y -= 16
      page.drawText('Design Depth: ' + (f.total_depth || '-') + '   Actual Depth: ' + (f.actual_hole_depth || '-'), { x: 44, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) })
      y -= 14
      page.drawText('Est. Yards: ' + (f.estimated_yards || '-') + '   Shaft Diameter: ' + (f.shaft_diameter || '-'), { x: 44, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) })
      y -= 14
      page.drawText('Anchor Bolt Projection: ' + (f.anchor_bolt_projection || '-'), { x: 44, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) })
      y -= 14
      if (f.notes) {
        page.drawText('Notes: ' + f.notes, { x: 44, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) })
        y -= 14
      }
      y -= 6
    }
    drawLine(y)
    y -= 14
  }

  if (sortedTrucks.length > 0) {
    y = drawSectionHeader('CONCRETE TRUCKS', y)
    for (const t of sortedTrucks) {
      const estimatedLeftover = getTruckEstimatedLeftover(t)
      let itemHeight = 80
      if (isRejectedTruck(t)) itemHeight += 14
      if (t.foundations_served && !isRejectedTruck(t)) itemHeight += 14
      if (estimatedLeftover) itemHeight += 14
      if (stripRejectedMarker(t.notes)) itemHeight += 14
      ensureSpace(itemHeight, 'CONCRETE TRUCKS')
      page.drawText('TRUCK ' + t.truck_number, { x: 40, y, size: 11, font: boldFont, color: rgb(0.1, 0.1, 0.1) })
      y -= 16
      page.drawText('Truck No.: ' + (t.truck_number || '-') + '   Batch: ' + formatTime(t.batch_time) + '   Arrival: ' + formatTime(t.arrival_time), { x: 44, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) })
      y -= 14
      page.drawText('Start: ' + formatTime(t.pour_start) + '   Complete: ' + formatTime(t.pour_complete), { x: 44, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) })
      y -= 14
      page.drawText('Yards: ' + (t.yards || '-') + '   Temp: ' + (t.concrete_temp || '-') + '   Slump: ' + (t.slump || '-') + '   Air: ' + (t.air_content || '-'), { x: 44, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) })
      y -= 14
      page.drawText('Water Added: ' + (t.water_added || '-') + '   Cylinders: ' + (t.cylinders_cast || '-'), { x: 44, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) })
      y -= 14
      if (isRejectedTruck(t)) {
        page.drawText('Status: Rejected load - not placed in shaft', { x: 44, y, size: 9, font: boldFont, color: rgb(0.48, 0.07, 0.07) })
        y -= 14
      }
      if (t.foundations_served && !isRejectedTruck(t)) {
        page.drawText('Foundations Served: ' + t.foundations_served, { x: 44, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) })
        y -= 14
      }
      if (estimatedLeftover) {
        page.drawText('Estimated Left On Truck: ' + estimatedLeftover + ' yd', { x: 44, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) })
        y -= 14
      }
      if (stripRejectedMarker(t.notes)) {
        page.drawText('Notes: ' + stripRejectedMarker(t.notes), { x: 44, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) })
        y -= 14
      }
      y -= 8
      drawLine(y)
      y -= 12
    }
  }

  if (log.photo_urls && log.photo_urls.length > 0) {
    const photoEntries = []
    for (let i = 0; i < log.photo_urls.length; i++) {
      try {
        const url = log.photo_urls[i]
        const label = log.photo_labels?.[i]
        const img = await embedPhotoFromUrl(pdfDoc, url)
        photoEntries.push({
          img,
          label,
        })
      } catch (err) {
        console.error('Failed to embed photo in email PDF:', err)
      }
    }

    for (let i = 0; i < photoEntries.length; i += 4) {
      drawPhotoGridPage(pdfDoc, photoEntries.slice(i, i + 4), font, boldFont)
    }
  }

  contentPages.forEach(contentPage => {
    contentPage.drawText('Generated by ' + companyName + ' - ' + new Date().toLocaleDateString(), {
      x: 40, y: 25, size: 8, font, color: rgb(0.6, 0.6, 0.6)
    })
  })

  const pdfBytes = await pdfDoc.save()
  const pdfBuffer = Buffer.from(pdfBytes)

  const toEmail = project?.client_email || process.env.REPORT_DELIVERY_EMAIL

  await sendEmailWithResend({
    from: 'Reports <onboarding@resend.dev>',
    to: toEmail,
    subject: 'Pour Log - ' + log.project_name + ' - ' + formatDate(log.log_date),
    html: `
      <h2>Drilled Shaft Pour Log</h2>
      <p><strong>Project:</strong> ${log.project_name}</p>
      <p><strong>Date:</strong> ${formatDate(log.log_date)}</p>
      <p><strong>Submitted By:</strong> ${log.submitted_by}</p>
      <p><strong>Concrete Supplier:</strong> ${log.concrete_supplier || '-'}</p>
      <p><strong>Weather:</strong> ${log.weather || '-'} | <strong>Temp:</strong> ${log.ambient_temp || '-'}</p>
      <p><strong>Foundations Poured:</strong> ${foundations ? foundations.map(f => f.foundation_id).join(', ') : '-'}</p>
      <p><strong>Total Trucks:</strong> ${sortedTrucks.length}</p>
      <p style="color:#999; font-size:12px;">PDF attached.</p>
    `,
    attachments: [{
      filename: 'pour-log-' + log.project_name + '-' + log.log_date + '.pdf',
      content: pdfBuffer.toString('base64'),
      content_type: 'application/pdf'
    }]
  })

  await recordAuditEvent(supabase, {
    organizationId: log.organization_id,
    actorUserId,
    entityType: 'pour_log',
    entityId: log.id,
    action: 'email_sent',
    metadata: {
      route: 'pour_log_email',
      project_id: log.project_id,
      to_email: toEmail,
      log_date: log.log_date,
    },
  })

  return Response.redirect(new URL('/pour-logs/' + log.id + '?sent=true', request.url))
}
