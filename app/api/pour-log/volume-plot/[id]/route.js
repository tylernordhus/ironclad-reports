import { createClient } from '@supabase/supabase-js'
import { PDFDocument, StandardFonts, degrees, rgb as pdfRgb } from 'pdf-lib'
import { buildVolumePlotData, formatVolumePlotIssues } from '@/lib/volume-plot'
import { sortTrucksByNumber } from '@/lib/truck-order'
import { getUserId } from '@/lib/get-user-id'
import { getAccessiblePourLogById } from '@/lib/pour-log-access'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

function getColors() {
  return {
    ink: pdfRgb(0.06, 0.06, 0.06),
    body: pdfRgb(0.16, 0.16, 0.16),
    muted: pdfRgb(0.35, 0.35, 0.35),
    line: pdfRgb(0.45, 0.45, 0.45),
    grid: pdfRgb(0.82, 0.82, 0.82),
    actual: pdfRgb(0.68, 0.12, 0.12),
    theoretical: pdfRgb(0.14, 0.14, 0.14),
    accent: pdfRgb(0, 0, 0),
    brand: pdfRgb(0.16, 0.31, 0.45),
    card: pdfRgb(0.975, 0.98, 0.985),
    brandText: pdfRgb(0.84, 0.9, 0.96),
    white: pdfRgb(1, 1, 1),
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const [year, month, day] = String(dateStr).split('-')
  return `${month}-${day}-${year}`
}

function formatNumber(value, digits = 2) {
  if (!Number.isFinite(value)) return '-'
  return Number(value).toFixed(digits)
}

function formatAxisValue(value) {
  if (!Number.isFinite(value)) return '-'
  const rounded = Math.round(value)
  if (Math.abs(value - rounded) < 0.001) return String(rounded)
  return value.toFixed(1)
}

function getNiceStep(value) {
  if (!Number.isFinite(value) || value <= 0) return 1

  const exponent = Math.floor(Math.log10(value))
  const magnitude = Math.pow(10, exponent)
  const normalized = value / magnitude
  const steps = [1, 2, 2.5, 5, 10]

  const matched = steps.find(step => normalized <= step) || 10
  return matched * magnitude
}

function buildAxis(maxValue, targetTicks = 5, padRatio = 1.05) {
  const paddedMax = Math.max(maxValue * padRatio, 1)
  const roughStep = paddedMax / Math.max(targetTicks, 1)
  const step = getNiceStep(roughStep)
  const axisMax = Math.max(step, Math.ceil(paddedMax / step) * step)
  const tickCount = Math.max(1, Math.round(axisMax / step))

  return {
    max: axisMax,
    step,
    tickCount,
  }
}

function drawBox(page, { x, y, width, height, fill = null, border = null, borderWidth = 1 }) {
  const COLORS = getColors()
  page.drawRectangle({
    x,
    y,
    width,
    height,
    borderColor: border || COLORS.ink,
    borderWidth,
    color: fill || undefined,
  })
}

function centerTextX(font, text, size, x, width) {
  const textWidth = font.widthOfTextAtSize(text, size)
  return x + Math.max((width - textWidth) / 2, 0)
}

function wrapText(font, text, size, maxWidth) {
  const words = String(text || '-').split(/\s+/).filter(Boolean)
  if (!words.length) return ['-']

  const lines = []
  let current = words[0]

  for (let index = 1; index < words.length; index += 1) {
    const candidate = `${current} ${words[index]}`
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate
    } else {
      lines.push(current)
      current = words[index]
    }
  }

  lines.push(current)
  return lines
}

function drawHeaderCell(page, { x, y, width, height, label, value, font, boldFont }) {
  const COLORS = getColors()
  drawBox(page, { x, y, width, height, fill: COLORS.card, border: COLORS.line, borderWidth: 0.8 })
  page.drawText(label, {
    x: x + 6,
    y: y + height - 17,
    size: 9,
    font: boldFont,
    color: COLORS.body,
  })
  const lines = wrapText(font, value || '-', 9.5, width - 12).slice(0, 2)
  lines.forEach((line, index) => {
    page.drawText(line, {
      x: x + 6,
      y: y + height - 32 - index * 11,
      size: 9.5,
      font,
      color: COLORS.ink,
      maxWidth: width - 12,
    })
  })
}

async function embedLogoFromUrl(pdfDoc, url) {
  if (!url) return null

  try {
    const response = await fetch(url)
    if (!response.ok) return null

    const bytes = new Uint8Array(await response.arrayBuffer())
    try {
      return await pdfDoc.embedPng(bytes)
    } catch {
      return await pdfDoc.embedJpg(bytes)
    }
  } catch {
    return null
  }
}

function drawTextBadge(page, { x, y, text, font, size = 8, textColor, fillColor, borderColor, paddingX = 6, paddingY = 3 }) {
  const textWidth = font.widthOfTextAtSize(text, size)
  const width = textWidth + paddingX * 2
  const height = size + paddingY * 2

  drawBox(page, {
    x,
    y,
    width,
    height,
    fill: fillColor,
    border: borderColor,
    borderWidth: 0.8,
  })

  page.drawText(text, {
    x: x + paddingX,
    y: y + paddingY + 0.5,
    size,
    font,
    color: textColor,
  })

  return { width, height }
}

function drawPlot(page, shaft, font, boldFont) {
  const COLORS = getColors()
  const chartX = 72
  const chartY = 226
  const chartWidth = 504
  const chartHeight = 270
  const depthAxis = buildAxis(shaft.totalDepthFt, 6, 1)
  const volumeAxis = buildAxis(Math.max(
    shaft.theoreticalTotalYards,
    shaft.totalPlacedYards,
    1
  ), 5, 1.05)
  const maxDepth = depthAxis.max
  const maxVolume = volumeAxis.max

  const xScale = volume => chartX + ((volume / maxVolume) * chartWidth)
  const yScale = depth => chartY + chartHeight - ((depth / maxDepth) * chartHeight)

  drawBox(page, { x: chartX, y: chartY, width: chartWidth, height: chartHeight, border: COLORS.line, borderWidth: 0.8 })

  const verticalTicks = volumeAxis.tickCount * 2
  const horizontalTicks = depthAxis.tickCount * 2

  for (let index = 1; index < verticalTicks; index += 1) {
    const x = chartX + (chartWidth / verticalTicks) * index
    page.drawLine({
      start: { x, y: chartY },
      end: { x, y: chartY + chartHeight },
      thickness: 0.8,
      color: COLORS.grid,
      dashArray: [3, 2],
    })
  }

  for (let index = 1; index < horizontalTicks; index += 1) {
    const y = chartY + (chartHeight / horizontalTicks) * index
    page.drawLine({
      start: { x: chartX, y },
      end: { x: chartX + chartWidth, y },
      thickness: 0.8,
      color: COLORS.grid,
      dashArray: [3, 2],
    })
  }

  for (let index = 0; index <= volumeAxis.tickCount; index += 1) {
    const tickValue = volumeAxis.step * index
    const x = xScale(tickValue)
    const label = formatAxisValue(tickValue)
    page.drawText(label, {
      x: centerTextX(font, label, 8.5, x - 20, 40),
      y: chartY - 18,
      size: 8.5,
      font,
      color: COLORS.muted,
    })
  }

  for (let index = 0; index <= depthAxis.tickCount; index += 1) {
    const tickDepth = depthAxis.step * index
    const y = yScale(tickDepth)
    const label = formatAxisValue(tickDepth)
    page.drawText(label, {
      x: chartX - 38,
      y: y - 3.5,
      size: 8.5,
      font,
      color: COLORS.muted,
    })
  }

  drawTextBadge(page, {
    x: chartX + 6,
    y: chartY + chartHeight - 20,
    text: 'Shaft Top',
    font: boldFont,
    size: 8.5,
    textColor: COLORS.ink,
    fillColor: COLORS.white,
    borderColor: COLORS.line,
  })

  drawTextBadge(page, {
    x: chartX + 12,
    y: chartY - 34,
    text: 'Shaft Bottom',
    font: boldFont,
    size: 8.5,
    textColor: COLORS.ink,
    fillColor: COLORS.white,
    borderColor: COLORS.line,
  })

  const xAxisTitle = 'CONCRETE VOLUME PLACED (cubic yards)'
  page.drawText(xAxisTitle, {
    x: centerTextX(boldFont, xAxisTitle, 11, chartX, chartWidth),
    y: chartY - 40,
    size: 11,
    font: boldFont,
    color: COLORS.ink,
  })

  page.drawText('DEPTH FROM TOP (feet)', {
    x: 18,
    y: chartY + 78,
    size: 10.5,
    font: boldFont,
    color: COLORS.ink,
    rotate: degrees(90),
  })

  const theoreticalStart = { x: xScale(0), y: yScale(shaft.totalDepthFt) }
  const theoreticalEnd = { x: xScale(shaft.theoreticalTotalYards), y: yScale(0) }
  page.drawLine({
    start: theoreticalStart,
    end: theoreticalEnd,
    thickness: 2,
    color: COLORS.theoretical,
    dashArray: [5, 3],
  })

  const actualPoints = [
    { x: xScale(0), y: yScale(shaft.totalDepthFt) },
    ...shaft.actualPoints.map(point => ({
      x: xScale(point.cumulativeDelivered),
      y: yScale(point.finishDepthFt),
      truckLabel: point.truckLabel,
    })),
  ]

  for (let index = 0; index < actualPoints.length - 1; index += 1) {
    page.drawLine({
      start: actualPoints[index],
      end: actualPoints[index + 1],
      thickness: 2,
      color: COLORS.actual,
    })
  }

  shaft.actualPoints.forEach((point, index) => {
    const x = xScale(point.cumulativeDelivered)
    const y = yScale(point.finishDepthFt)
    page.drawCircle({
      x,
      y,
      size: 3.5,
      color: COLORS.actual,
    })

    const label = String(point.truckLabel || '')
    const labelSize = 7
    const labelWidth = font.widthOfTextAtSize(label, labelSize) + 8
    const labelHeight = labelSize + 5
    const rawX = x + 7
    const rawY = y - labelHeight - 5
    const labelX = Math.min(Math.max(rawX, chartX + 4), chartX + chartWidth - labelWidth - 4)
    const labelY = Math.min(Math.max(rawY, chartY + 4), chartY + chartHeight - labelHeight - 4)

    drawBox(page, {
      x: labelX,
      y: labelY,
      width: labelWidth,
      height: labelHeight,
      fill: COLORS.white,
      border: COLORS.actual,
      borderWidth: 0.8,
    })

    page.drawText(label, {
      x: labelX + 4,
      y: labelY + 3,
      size: labelSize,
      font: boldFont,
      color: COLORS.actual,
    })
  })

  const legendWidth = 144
  const legendHeight = 38
  const legendX = chartX + chartWidth - legendWidth - 10
  const legendY = chartY + 12

  drawBox(page, {
    x: legendX,
    y: legendY,
    width: legendWidth,
    height: legendHeight,
    fill: COLORS.white,
    border: COLORS.line,
    borderWidth: 0.8,
  })

  page.drawLine({
    start: { x: legendX + 10, y: legendY + 26 },
    end: { x: legendX + 28, y: legendY + 26 },
    thickness: 2,
    color: COLORS.theoretical,
  })
  page.drawText('Theoretical', {
    x: legendX + 36,
    y: legendY + 22.5,
    size: 8,
    font,
    color: COLORS.body,
  })

  page.drawLine({
    start: { x: legendX + 10, y: legendY + 12 },
    end: { x: legendX + 28, y: legendY + 12 },
    thickness: 2,
    color: COLORS.actual,
  })
  page.drawText('Actual from trucks', {
    x: legendX + 36,
    y: legendY + 8.5,
    size: 8,
    font,
    color: COLORS.body,
  })
}

function drawSummaryTable(page, shaft, font, boldFont) {
  const COLORS = getColors()
  const tableX = 36
  const tableY = 28
  const tableWidth = 540
  const tableHeight = 140
  const headerHeight = 18
  const rowHeight = 20
  const rows = [
    ['Volume Delivered', 'TVD', shaft.totalDeliveredYards],
    ['Volume in Lines', 'VL', 0],
    ['Wastage', 'VW', shaft.wastageYards ?? 0],
    ['Volume Placed', 'VP', shaft.totalPlacedYards],
    ['Theoretical Volume', 'VT', shaft.theoreticalTotalYards],
    ['Overpour', 'OP', shaft.overpourYards],
  ]

  drawBox(page, { x: tableX, y: tableY, width: tableWidth, height: tableHeight, border: COLORS.line, borderWidth: 0.8 })
  drawBox(page, { x: tableX, y: tableY + tableHeight - headerHeight, width: tableWidth, height: headerHeight, fill: COLORS.brand, border: COLORS.brand })

  page.drawText('VOLUME CALCULATIONS', {
    x: centerTextX(boldFont, 'VOLUME CALCULATIONS', 11, tableX, tableWidth),
    y: tableY + tableHeight - 13.5,
    size: 11,
    font: boldFont,
    color: COLORS.white,
  })

  const nameX = tableX + 12
  const codeX = tableX + 250
  const valueX = tableX + 294
  const valueLineEndX = tableX + 458
  const unitX = tableX + 474

  rows.forEach((row, index) => {
    const y = tableY + tableHeight - headerHeight - rowHeight * (index + 1)
    page.drawLine({
      start: { x: tableX, y },
      end: { x: tableX + tableWidth, y },
      thickness: 0.7,
      color: COLORS.line,
    })

    page.drawText(row[0], {
      x: nameX,
      y: y + 5.5,
      size: 9,
      font,
      color: COLORS.ink,
    })
    page.drawText(row[1], {
      x: codeX,
      y: y + 5.5,
      size: 9,
      font: boldFont,
      color: COLORS.body,
    })
    page.drawLine({
      start: { x: valueX + 2, y: y + 5.5 },
      end: { x: valueLineEndX, y: y + 5.5 },
      thickness: 0.6,
      color: COLORS.line,
    })
    page.drawText(formatNumber(row[2], 2), {
      x: valueX + 2,
      y: y + 8,
      size: 9,
      font,
      color: COLORS.ink,
    })
    page.drawText('cyds', {
      x: unitX - 4,
      y: y + 5.5,
      size: 9,
      font,
      color: COLORS.body,
    })
  })
}

function drawVolumePlotPage(page, shaft, log, companyName, logoImg, font, boldFont, pageIndex, totalPages) {
  const COLORS = getColors()
  const { height } = page.getSize()

  page.drawRectangle({
    x: 0,
    y: height - 80,
    width: 612,
    height: 80,
    color: COLORS.brand,
  })

  page.drawText('DRILLED SHAFT POUR LOG', {
    x: 40,
    y: height - 45,
    size: 20,
    font: boldFont,
    color: COLORS.white,
  })

  page.drawText(companyName || 'Ironclad Reports', {
    x: 40,
    y: height - 65,
    size: 11,
    font,
    color: COLORS.brandText,
  })

  if (logoImg) {
    const { width: logoWidth, height: logoHeight } = logoImg.scale(1)
    const maxHeight = 50
    const maxWidth = 120
    const scale = Math.min(maxWidth / logoWidth, maxHeight / logoHeight)

    page.drawImage(logoImg, {
      x: 612 - 40 - logoWidth * scale,
      y: height - 70,
      width: logoWidth * scale,
      height: logoHeight * scale,
    })
  }

  const topRowY = height - 152
  drawHeaderCell(page, {
    x: 36,
    y: topRowY,
    width: 372,
    height: 34,
    label: 'PROJECT DESCRIPTION',
    value: log?.project_name || '-',
    font,
    boldFont,
  })
  drawHeaderCell(page, {
    x: 408,
    y: topRowY,
    width: 168,
    height: 34,
    label: 'DATE',
    value: formatDate(log?.log_date),
    font,
    boldFont,
  })

  const secondRowY = topRowY - 34
  drawHeaderCell(page, {
    x: 36,
    y: secondRowY,
    width: 178,
    height: 34,
    label: 'SHAFT NO.',
    value: shaft.foundationId || '-',
    font,
    boldFont,
  })
  drawHeaderCell(page, {
    x: 214,
    y: secondRowY,
    width: 178,
    height: 34,
    label: 'SHAFT DIAMETER',
    value: `${formatNumber(shaft.diameterFt, 2)} ft`,
    font,
    boldFont,
  })
  drawHeaderCell(page, {
    x: 392,
    y: secondRowY,
    width: 184,
    height: 34,
    label: 'TOTAL DEPTH',
    value: `${formatNumber(shaft.totalDepthFt, 2)} ft`,
    font,
    boldFont,
  })

  const thirdRowY = secondRowY - 34
  drawHeaderCell(page, {
    x: 36,
    y: thirdRowY,
    width: 270,
    height: 34,
    label: 'CONCRETE SUPPLIER',
    value: log?.concrete_supplier || '-',
    font,
    boldFont,
  })
  drawHeaderCell(page, {
    x: 306,
    y: thirdRowY,
    width: 270,
    height: 34,
    label: 'INSPECTOR',
    value: log?.submitted_by || '-',
    font,
    boldFont,
  })

  const plotTitle = 'CONCRETE VOLUME PLOT'
  page.drawText(plotTitle, {
    x: centerTextX(boldFont, plotTitle, 16, 36, 540),
    y: height - 259,
    size: 16,
    font: boldFont,
    color: COLORS.ink,
  })

  page.drawText(
    'The theoretical shaft profile is plotted against actual delivered concrete volume from the pour log.',
    {
      x: 42,
      y: height - 278,
      size: 9,
      font,
      color: COLORS.body,
      maxWidth: 534,
      lineHeight: 11,
    }
  )

  drawPlot(page, shaft, font, boldFont)
  drawSummaryTable(page, shaft, font, boldFont)

  page.drawText(`Page ${pageIndex + 1} of ${totalPages}`, {
    x: 522,
    y: 10,
    size: 8,
    font,
    color: COLORS.muted,
  })
}

async function loadPlotContext(id, userId) {
  const { log, error } = await getAccessiblePourLogById(supabase, { logId: id, userId })

  if (error || !log) {
    return { errorResponse: new Response('Pour log not found', { status: 404 }) }
  }

  const [{ data: foundations }, { data: trucks }, { data: settings }] = await Promise.all([
    supabase
      .from('pour_log_foundations')
      .select('*')
      .eq('pour_log_id', log.id),
    supabase
      .from('pour_log_trucks')
      .select('*')
      .eq('pour_log_id', log.id),
    supabase
      .from('settings')
      .select('company_name, logo_url')
      .single(),
  ])

  return {
    log,
    foundations: foundations || [],
    trucks: sortTrucksByNumber(trucks),
    settings,
  }
}

async function renderVolumePlotPdf({ log, settings, plotData }) {
  const pdfDoc = await PDFDocument.create()
  await appendVolumePlotPages({
    pdfDoc,
    log,
    settings,
    plotData,
  })

  const pdfBytes = await pdfDoc.save()

  return new Response(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="volume-plot-${log.project_name || 'pour-log'}-${log.log_date || 'report'}.pdf"`,
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store',
    }
  })
}

export async function appendVolumePlotPages({ pdfDoc, log, settings, plotData }) {
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const companyName = settings?.company_name || 'Ironclad Reports'
  const logoImg = await embedLogoFromUrl(pdfDoc, settings?.logo_url)

  plotData.shafts.forEach((shaft, index) => {
    const page = pdfDoc.addPage([612, 792])
    drawVolumePlotPage(
      page,
      shaft,
      log,
      companyName,
      logoImg,
      font,
      boldFont,
      index,
      plotData.shafts.length
    )
  })
}

function buildPendingResponse(plotData) {
  return Response.json({
    error: plotData.issues.length > 0
      ? 'Volume plot data still needs attention.'
      : 'Volume plot data is incomplete.',
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

async function createVolumePlotResponse(id, userId, inputs = {}) {
  const context = await loadPlotContext(id, userId)
  if (context.errorResponse) return context.errorResponse

  const plotData = buildVolumePlotData({
    log: context.log,
    foundations: context.foundations,
    trucks: context.trucks,
    inputs,
  })

  if (plotData.issues.length > 0 || plotData.shafts.length === 0) {
    if (plotData.pendingInputs.length > 0) {
      return buildPendingResponse(plotData)
    }

    return Response.json({
      error: 'Volume plot data is incomplete.',
      issues: plotData.issues,
      pendingInputs: [],
      summary: formatVolumePlotIssues(plotData.issues),
    }, {
      status: 400,
      headers: { 'Cache-Control': 'no-store, max-age=0' }
    })
  }

  if (plotData.pendingInputs.length > 0) {
    return buildPendingResponse(plotData)
  }

  return renderVolumePlotPdf({
    log: context.log,
    settings: context.settings,
    plotData,
  })
}

export async function GET(request, { params }) {
  const userId = await getUserId()
  if (!userId) {
    return new Response('Unauthorized', { status: 401 })
  }

  return createVolumePlotResponse(params.id, userId, {})
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

  return createVolumePlotResponse(params.id, userId, body?.inputs || {})
}
