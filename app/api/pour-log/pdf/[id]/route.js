import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import sharp from 'sharp'
import { getTruckEstimatedLeftover, isRejectedTruck, stripRejectedMarker } from '@/lib/pour-log-trucks'
import { buildVolumePlotData, formatVolumePlotIssues } from '@/lib/volume-plot'
import { appendVolumePlotPages } from '@/app/api/pour-log/volume-plot/[id]/route'
import { recordAuditEvent } from '@/lib/audit-log'
import { getUserId } from '@/lib/get-user-id'
import { getAccessiblePourLogById, getPourLogChildren } from '@/lib/pour-log-access'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

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

function parsePlainNumber(value) {
  const text = String(value ?? '').trim().replace(/,/g, '')
  if (!text) return null
  const number = Number(text)
  return Number.isFinite(number) ? number : null
}

function shouldAttemptAutoPlot(foundations = [], trucks = []) {
  const estimatedYards = (foundations || []).reduce((sum, foundation) => {
    const yards = parsePlainNumber(foundation?.estimated_yards)
    return sum + (yards || 0)
  }, 0)

  const acceptedTruckYards = (trucks || []).reduce((sum, truck) => {
    if (isRejectedTruck(truck)) return sum
    const yards = parsePlainNumber(truck?.yards)
    return sum + (yards || 0)
  }, 0)

  return estimatedYards > 10 || acceptedTruckYards > 10
}

function buildPendingPdfResponse(plotData) {
  return Response.json({
    error: plotData.issues.length > 0
      ? 'The volume plot needs more information before it can be added to this PDF.'
      : 'The volume plot is incomplete.',
    issues: plotData.issues,
    pendingInputs: plotData.pendingInputs,
    summary: formatVolumePlotIssues([
      ...plotData.issues,
      ...plotData.pendingInputs.map(item => item.message),
    ]),
  }, {
    status: 409,
    headers: { 'Cache-Control': 'no-store, max-age=0' }
  })
}

function fitImageWithinBox(img, maxWidth, maxHeight) {
  const { width, height } = img.scale(1)
  const scale = Math.min(maxWidth / width, maxHeight / height)
  return {
    width: width * scale,
    height: height * scale,
  }
}

function drawPhotoGridPage(pdfDoc, photos, font, boldFont, COLORS) {
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
  const labelHeight = 28

  page.drawRectangle({ x: 0, y: pageHeight - headerHeight, width: pageWidth, height: headerHeight, color: COLORS.brand })
  page.drawText('PHOTOS', { x: 40, y: pageHeight - 35, size: 16, font: boldFont, color: rgb(1, 1, 1) })

  photos.forEach((photo, index) => {
    const row = Math.floor(index / columns)
    const col = index % columns
    if (row >= rows) return

    const x = marginX + (col * (cellWidth + gapX))
    const topY = topStart - (row * (cellHeight + gapY))
    const maxImageWidth = cellWidth
    const maxImageHeight = imageAreaHeight
    const fitted = fitImageWithinBox(photo.img, maxImageWidth, maxImageHeight)
    const imageX = x + ((maxImageWidth - fitted.width) / 2)
    const imageY = topY - fitted.height - ((maxImageHeight - fitted.height) / 2)

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
        color: COLORS.body,
        maxWidth: cellWidth,
        lineHeight: 11,
      })
    }
  })
}

async function createPourLogPdfResponse({ params, userId, inputs = {}, skipVolumePlot = false, interactive = false }) {
  const COLORS = {
    ink: rgb(0.12, 0.15, 0.19),
    body: rgb(0.28, 0.33, 0.39),
    muted: rgb(0.46, 0.5, 0.56),
    line: rgb(0.87, 0.89, 0.92),
    card: rgb(0.975, 0.98, 0.985),
    brand: rgb(0.16, 0.31, 0.45),
    accent: rgb(0.68, 0.12, 0.12),
  }

  const { log, error } = await getAccessiblePourLogById(supabase, { logId: params.id, userId })

  if (error || !log) {
    return new Response('Pour log not found', { status: 404 })
  }

  const actorUserId = userId
  const { foundations, trucks: sortedTrucks } = await getPourLogChildren(supabase, log.id)

  const { data: settings } = await supabase
    .from('settings')
    .select('company_name, logo_url')
    .single()

  const companyName = settings?.company_name || 'Field Reports'

  const pdfDoc = await PDFDocument.create()
  let page = pdfDoc.addPage([612, 792])
  const contentPages = [page]
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const { height } = page.getSize()

  let logoImg = null
  if (settings?.logo_url) {
    try {
      const logoRes = await fetch(settings.logo_url)
      const logoBytes = new Uint8Array(await logoRes.arrayBuffer())
      try {
        logoImg = await pdfDoc.embedPng(logoBytes)
      } catch {
        logoImg = await pdfDoc.embedJpg(logoBytes)
      }
    } catch (e) {
      console.error('Logo embed error:', e)
    }
  }

  const drawPageHeader = (targetPage) => {
    targetPage.drawRectangle({ x: 0, y: height - 80, width: 612, height: 80, color: COLORS.brand })
    targetPage.drawText('DRILLED SHAFT POUR LOG', { x: 40, y: height - 45, size: 20, font: boldFont, color: rgb(1, 1, 1) })
    targetPage.drawText(companyName, { x: 40, y: height - 65, size: 11, font, color: rgb(0.84, 0.9, 0.96) })

    if (logoImg) {
      const { width: lw, height: lh } = logoImg.scale(1)
      const maxH = 50
      const maxW = 120
      const scale = Math.min(maxW / lw, maxH / lh)
      targetPage.drawImage(logoImg, {
        x: 612 - 40 - lw * scale,
        y: height - 70,
        width: lw * scale,
        height: lh * scale,
      })
    }
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
    page.drawLine({ start: { x: 40, y: yPos }, end: { x: 572, y: yPos }, thickness: 0.7, color: COLORS.line })
  }

  const drawSectionHeader = (text, yPos) => {
    page.drawRectangle({ x: 40, y: yPos - 4, width: 532, height: 18, color: COLORS.brand })
    page.drawText(text, { x: 44, y: yPos, size: 10, font: boldFont, color: rgb(1, 1, 1) })
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
      const itemHeight = f.notes ? 78 : 64
      ensureSpace(itemHeight, 'FOUNDATIONS POURED')
      page.drawText(f.foundation_id || '-', { x: 40, y, size: 11, font: boldFont, color: COLORS.ink })
      y -= 16
      page.drawText('Design Depth: ' + (f.total_depth || '-') + '   Actual Depth: ' + (f.actual_hole_depth || '-'), { x: 44, y, size: 9, font, color: COLORS.body })
      y -= 14
      page.drawText('Est. Yards: ' + (f.estimated_yards || '-') + '   Shaft Diameter: ' + (f.shaft_diameter || '-'), { x: 44, y, size: 9, font, color: COLORS.body })
      y -= 14
      page.drawText('Anchor Bolt Projection: ' + (f.anchor_bolt_projection || '-'), { x: 44, y, size: 9, font, color: COLORS.body })
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
      page.drawText('TRUCK ' + t.truck_number, { x: 40, y, size: 11, font: boldFont, color: COLORS.ink })
      y -= 16
      page.drawText('Truck No.: ' + (t.truck_number || '-') + '   Batch: ' + formatTime(t.batch_time) + '   Arrival: ' + formatTime(t.arrival_time), { x: 44, y, size: 9, font, color: COLORS.body })
      y -= 14
      page.drawText('Start: ' + formatTime(t.pour_start) + '   Complete: ' + formatTime(t.pour_complete), { x: 44, y, size: 9, font, color: COLORS.body })
      y -= 14
      page.drawText('Yards: ' + (t.yards || '-') + '   Temp: ' + (t.concrete_temp || '-') + '   Slump: ' + (t.slump || '-') + '   Air: ' + (t.air_content || '-'), { x: 44, y, size: 9, font, color: COLORS.body })
      y -= 14
      page.drawText('Water Added: ' + (t.water_added || '-') + '   Cylinders: ' + (t.cylinders_cast || '-'), { x: 44, y, size: 9, font, color: COLORS.body })
      y -= 14
      if (isRejectedTruck(t)) {
        page.drawText('Status: Rejected load - not placed in shaft', { x: 44, y, size: 9, font: boldFont, color: COLORS.accent })
        y -= 14
      }
      if (t.foundations_served && !isRejectedTruck(t)) {
        page.drawText('Foundations Served: ' + t.foundations_served, { x: 44, y, size: 9, font, color: COLORS.body })
        y -= 14
      }
      if (estimatedLeftover) {
        page.drawText('Estimated Left On Truck: ' + estimatedLeftover + ' yd', { x: 44, y, size: 9, font, color: COLORS.body })
        y -= 14
      }
      if (stripRejectedMarker(t.notes)) {
        page.drawText('Notes: ' + stripRejectedMarker(t.notes), { x: 44, y, size: 9, font, color: COLORS.body })
        y -= 14
      }
      y -= 8
      drawLine(y)
      y -= 12
    }
  }

  // Photos section
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
        console.error('Failed to embed photo:', err)
      }
    }

    for (let i = 0; i < photoEntries.length; i += 4) {
      drawPhotoGridPage(pdfDoc, photoEntries.slice(i, i + 4), font, boldFont, COLORS)
    }
  }

  contentPages.forEach(contentPage => {
    contentPage.drawText('Generated by ' + companyName + ' - ' + new Date().toLocaleDateString(), {
      x: 40, y: 25, size: 8, font, color: COLORS.muted
    })
  })

  if (!skipVolumePlot && shouldAttemptAutoPlot(foundations, sortedTrucks)) {
    const plotData = buildVolumePlotData({
      log,
      foundations: foundations || [],
      trucks: sortedTrucks,
      inputs,
    })

    const totalPlacedYards = plotData.shafts.reduce((sum, shaft) => sum + (shaft.totalPlacedYards || 0), 0)
    const plotReady = plotData.pendingInputs.length === 0 && plotData.issues.length === 0 && plotData.shafts.length > 0

    if (!plotReady) {
      if (interactive) {
        return buildPendingPdfResponse(plotData)
      }
    } else if (totalPlacedYards > 10) {
      await appendVolumePlotPages({
        pdfDoc,
        log,
        settings,
        plotData,
      })
    }
  }

  const pdfBytes = await pdfDoc.save()

  await recordAuditEvent(supabase, {
    organizationId: log.organization_id,
    actorUserId,
    entityType: 'pour_log',
    entityId: log.id,
    action: 'pdf_generated',
    metadata: {
      route: 'pour_log_pdf',
      project_id: log.project_id,
      log_date: log.log_date,
      skip_volume_plot: skipVolumePlot,
    },
  })

  return new Response(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="pour-log-' + log.project_name + '-' + log.log_date + '.pdf"',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store',
    }
  })
}

export async function GET(request, { params }) {
  if (request.nextUrl.searchParams.has('mobile_v')) {
    const viewerUrl = new URL('/mobile/pdf', request.url)
    viewerUrl.searchParams.set('src', `/api/pour-log/pdf/${params.id}`)
    viewerUrl.searchParams.set('title', 'Pour Log PDF')
    return NextResponse.redirect(viewerUrl)
  }

  const userId = await getUserId()
  if (!userId) {
    return new Response('Unauthorized', { status: 401 })
  }

  return createPourLogPdfResponse({
    params,
    userId,
    inputs: {},
    skipVolumePlot: false,
    interactive: false,
  })
}

export async function POST(request, { params }) {
  const userId = await getUserId()
  if (!userId) {
    return new Response('Unauthorized', { status: 401 })
  }

  let body = {}

  try {
    body = await request.json()
  } catch {
    body = {}
  }

  return createPourLogPdfResponse({
    params,
    userId,
    inputs: body?.inputs || {},
    skipVolumePlot: Boolean(body?.skipVolumePlot),
    interactive: true,
  })
}
