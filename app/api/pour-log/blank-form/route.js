import { createClient } from '@supabase/supabase-js'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const PAGE_WIDTH = 612
const PAGE_HEIGHT = 792
const MARGIN_X = 36
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2
const FOUNDATION_ROWS = 5
const FOUNDATION_HEADER_HEIGHT = 20
const FOUNDATION_ROW_HEIGHT = 28
const CONTINUATION_TRUCKS_PER_PAGE = 3
const FIRST_PAGE_TRUCKS = 2
const DEFAULT_TRUCK_COUNT = 10
const MAX_TRUCK_COUNT = 40
const TRUCK_SECTION_HEIGHT = 138
const TRUCK_SECTION_GAP = 8
const FOUNDATION_TABLE_TOP = 480
const FIRST_PAGE_TRUCK_START_Y =
  FOUNDATION_TABLE_TOP - (FOUNDATION_HEADER_HEIGHT + FOUNDATION_ROW_HEIGHT * FOUNDATION_ROWS) - 8
const FINAL_REMARKS_Y = 104
const FINAL_REMARKS_LINE_COUNT = 3

function getColors() {
  const cacheKey = '__IRONCLAD_BLANK_FORM_COLORS__'
  if (!globalThis[cacheKey]) {
    globalThis[cacheKey] = {
      brand: rgb(0, 0, 0),
      brandDark: rgb(0, 0, 0),
      brandLight: rgb(1, 1, 1),
      line: rgb(0.55, 0.55, 0.55),
      lineStrong: rgb(0, 0, 0),
      ink: rgb(0, 0, 0),
      body: rgb(0.12, 0.12, 0.12),
      muted: rgb(0.38, 0.38, 0.38),
      white: rgb(1, 1, 1),
    }
  }

  return globalThis[cacheKey]
}

function drawLine(page, x1, y1, x2, y2, color = null, thickness = 0.8) {
  const COLORS = getColors()
  page.drawLine({
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    color: color || COLORS.line,
    thickness,
  })
}

function drawPageHeader(page, font, boldFont, { companyName, logoImg, pageLabel = '' }) {
  const COLORS = getColors()
  page.drawRectangle({
    x: MARGIN_X,
    y: PAGE_HEIGHT - 72,
    width: CONTENT_WIDTH,
    height: 56,
    color: COLORS.white,
    borderColor: COLORS.lineStrong,
    borderWidth: 1.2,
  })

  page.drawText('DRILLED SHAFT POUR LOG', {
    x: MARGIN_X + 22,
    y: PAGE_HEIGHT - 40,
    size: 19,
    font: boldFont,
    color: COLORS.ink,
  })

  if (pageLabel) {
    page.drawText(pageLabel, {
      x: PAGE_WIDTH - MARGIN_X - 52,
      y: PAGE_HEIGHT - 39,
      size: 10,
      font,
      color: COLORS.ink,
    })
  }

  page.drawText(companyName, {
    x: PAGE_WIDTH - MARGIN_X - 192,
    y: PAGE_HEIGHT - 56,
    size: 8.1,
    font,
    color: COLORS.body,
    maxWidth: 112,
  })

  if (!logoImg) return

  const { width, height } = logoImg.scale(1)
  const scale = Math.min(84 / width, 30 / height)
  page.drawImage(logoImg, {
    x: PAGE_WIDTH - MARGIN_X - 150,
    y: PAGE_HEIGHT - 63,
    width: width * scale,
    height: height * scale,
  })
}

function drawFooter(page, font, pageNumber, totalPages) {
  const COLORS = getColors()
  const footerText = `Generated from Ironclad Reports   Page ${pageNumber} of ${totalPages}`
  page.drawText(footerText, {
    x: PAGE_WIDTH / 2 - 82,
    y: 16,
    size: 8.5,
    font,
    color: COLORS.muted,
  })
}

function drawSectionBar(page, boldFont, title, y) {
  const COLORS = getColors()
  page.drawRectangle({
    x: MARGIN_X,
    y,
    width: CONTENT_WIDTH,
    height: 18,
    color: COLORS.white,
    borderColor: COLORS.lineStrong,
    borderWidth: 1,
  })

  page.drawText(title, {
    x: MARGIN_X + 10,
    y: y + 4.5,
    size: 9.8,
    font: boldFont,
    color: COLORS.ink,
  })
}

function drawEntryLine(page, font, boldFont, { label, x, y, width, labelWidth, value = '' }) {
  const COLORS = getColors()
  page.drawText(label, {
    x,
    y,
    size: 8.8,
    font: boldFont,
    color: COLORS.ink,
  })

  const lineX = x + labelWidth
  const lineY = y - 1.5
  drawLine(page, lineX, lineY, x + width, lineY)

  if (!value) return

  page.drawText(value, {
    x: lineX + 4,
    y,
    size: 8.4,
    font,
    color: COLORS.body,
    maxWidth: Math.max(width - labelWidth - 6, 0),
  })
}

function drawFoundationsTable(page, font, boldFont, y) {
  const COLORS = getColors()
  const tableX = MARGIN_X
  const headerHeight = FOUNDATION_HEADER_HEIGHT
  const rowHeight = FOUNDATION_ROW_HEIGHT
  const tableWidth = CONTENT_WIDTH
  const tableHeight = headerHeight + rowHeight * FOUNDATION_ROWS
  const columns = [
    { label: 'FOUNDATION ID', width: 88 },
    { label: 'DESIGN DEPTH', width: 72 },
    { label: 'ACTUAL DEPTH', width: 76 },
    { label: 'DIAMETER', width: 64 },
    { label: 'EST. YARDS', width: 68 },
    { label: 'AB PROJ.', width: 74 },
    { label: 'NOTES', width: 98 },
  ]

  page.drawRectangle({
    x: tableX,
    y: y - tableHeight,
    width: tableWidth,
    height: tableHeight,
    color: COLORS.white,
    borderColor: COLORS.lineStrong,
    borderWidth: 1.1,
  })

  page.drawRectangle({
    x: tableX,
    y: y - headerHeight,
    width: tableWidth,
    height: headerHeight,
    color: COLORS.white,
  })

  let cursorX = tableX
  columns.forEach((column, index) => {
    page.drawText(column.label, {
      x: cursorX + 8,
      y: y - 14,
      size: 7.8,
      font: boldFont,
      color: COLORS.ink,
    })

    if (index > 0) {
      drawLine(page, cursorX, y - tableHeight, cursorX, y, COLORS.line, 0.75)
    }

    cursorX += column.width
  })

  for (let row = 0; row <= FOUNDATION_ROWS; row += 1) {
    const rowY = y - headerHeight - rowHeight * row
    drawLine(page, tableX, rowY, tableX + tableWidth, rowY, COLORS.line, 0.75)
  }
}

function drawTruckSection(page, font, boldFont, truckNumber, y) {
  const blockLeft = MARGIN_X + 8
  const leftWidth = 236
  const rightX = 300
  const rightWidth = 240
  const rowGap = 16
  let lineY = y - 24

  drawSectionBar(page, boldFont, `CONCRETE TRUCK #${truckNumber}`, y)

  drawEntryLine(page, font, boldFont, {
    label: 'TRUCK NO.:',
    x: blockLeft,
    y: lineY,
    width: leftWidth,
    labelWidth: 78,
  })
  drawEntryLine(page, font, boldFont, {
    label: 'YARDS:',
    x: rightX,
    y: lineY,
    width: rightWidth,
    labelWidth: 56,
  })

  lineY -= rowGap
  drawEntryLine(page, font, boldFont, {
    label: 'BATCH TIME:',
    x: blockLeft,
    y: lineY,
    width: leftWidth,
    labelWidth: 86,
  })
  drawEntryLine(page, font, boldFont, {
    label: 'ARRIVAL TIME:',
    x: rightX,
    y: lineY,
    width: rightWidth,
    labelWidth: 92,
  })

  lineY -= rowGap
  drawEntryLine(page, font, boldFont, {
    label: 'POUR START:',
    x: blockLeft,
    y: lineY,
    width: leftWidth,
    labelWidth: 90,
  })
  drawEntryLine(page, font, boldFont, {
    label: 'POUR COMPLETE:',
    x: rightX,
    y: lineY,
    width: rightWidth,
    labelWidth: 104,
  })

  lineY -= rowGap
  drawEntryLine(page, font, boldFont, {
    label: 'TEMP:',
    x: blockLeft,
    y: lineY,
    width: 144,
    labelWidth: 48,
  })
  drawEntryLine(page, font, boldFont, {
    label: 'SLUMP:',
    x: blockLeft + 156,
    y: lineY,
    width: 80,
    labelWidth: 54,
  })
  drawEntryLine(page, font, boldFont, {
    label: 'AIR %:',
    x: rightX,
    y: lineY,
    width: 72,
    labelWidth: 40,
  })
  drawEntryLine(page, font, boldFont, {
    label: 'WATER ADDED:',
    x: rightX + 90,
    y: lineY,
    width: 150,
    labelWidth: 82,
  })

  lineY -= rowGap
  drawEntryLine(page, font, boldFont, {
    label: 'CYLINDERS:',
    x: blockLeft,
    y: lineY,
    width: leftWidth,
    labelWidth: 84,
  })
  drawEntryLine(page, font, boldFont, {
    label: 'ESTIMATED CY LEFT ON TRUCK:',
    x: rightX,
    y: lineY,
    width: rightWidth,
    labelWidth: 176,
  })

  lineY -= rowGap
  drawEntryLine(page, font, boldFont, {
    label: 'FOUNDATIONS SERVED:',
    x: blockLeft,
    y: lineY,
    width: CONTENT_WIDTH - 16,
    labelWidth: 130,
  })

  lineY -= rowGap
  drawEntryLine(page, font, boldFont, {
    label: 'FINISHED DEPTH:',
    x: blockLeft,
    y: lineY,
    width: CONTENT_WIDTH - 16,
    labelWidth: 104,
  })

  lineY -= rowGap
  drawEntryLine(page, font, boldFont, {
    label: 'NOTES / W-C RATIO / EXTRA INFO:',
    x: blockLeft,
    y: lineY,
    width: CONTENT_WIDTH - 16,
    labelWidth: 194,
  })

  return y - TRUCK_SECTION_HEIGHT
}

function drawRemarksSection(page, font, boldFont, y, lineCount = 4) {
  const COLORS = getColors()
  drawSectionBar(page, boldFont, 'REMARKS / ISSUES', y)
  const startY = y - 20
  for (let index = 0; index < lineCount; index += 1) {
    const lineY = startY - index * 18
    drawLine(page, MARGIN_X, lineY, MARGIN_X + CONTENT_WIDTH, lineY)
  }

  page.drawText('Check imported handwriting against the paper before saving.', {
    x: MARGIN_X,
    y: startY - lineCount * 18 - 6,
    size: 8.5,
    font,
    color: COLORS.muted,
  })
}

async function embedLogo(pdfDoc, logoUrl) {
  if (!logoUrl) return null

  try {
    const response = await fetch(logoUrl)
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

export async function buildBlankFormPdf({
  projectName,
  companyName,
  logoUrl,
  truckCount = DEFAULT_TRUCK_COUNT,
  totalPages = 1 + Math.ceil(Math.max(DEFAULT_TRUCK_COUNT - FIRST_PAGE_TRUCKS, 0) / CONTINUATION_TRUCKS_PER_PAGE),
}) {
  const COLORS = getColors()
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const logoImg = await embedLogo(pdfDoc, logoUrl)

  const page1 = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  drawPageHeader(page1, font, boldFont, {
    companyName,
    logoImg,
    pageLabel: 'Page 1',
  })
  drawFooter(page1, font, 1, totalPages)

  drawSectionBar(page1, boldFont, 'JOB INFORMATION', 650)
  drawEntryLine(page1, font, boldFont, {
    label: 'PROJECT:',
    x: 44,
    y: 612,
    width: 250,
    labelWidth: 62,
    value: projectName,
  })
  drawEntryLine(page1, font, boldFont, {
    label: 'DATE:',
    x: 300,
    y: 612,
    width: 240,
    labelWidth: 52,
  })
  drawEntryLine(page1, font, boldFont, {
    label: 'SUPPLIER:',
    x: 44,
    y: 580,
    width: 250,
    labelWidth: 68,
  })
  drawEntryLine(page1, font, boldFont, {
    label: 'SUBMITTED BY:',
    x: 300,
    y: 580,
    width: 240,
    labelWidth: 98,
  })
  drawEntryLine(page1, font, boldFont, {
    label: 'WEATHER:',
    x: 44,
    y: 548,
    width: 250,
    labelWidth: 68,
  })
  drawEntryLine(page1, font, boldFont, {
    label: 'TEMP:',
    x: 300,
    y: 548,
    width: 240,
    labelWidth: 52,
  })

  drawSectionBar(page1, boldFont, 'FOUNDATIONS POURED', 508)
  drawFoundationsTable(page1, font, boldFont, FOUNDATION_TABLE_TOP)

  let y = FIRST_PAGE_TRUCK_START_Y
  let nextTruckNumber = 1
  const firstPageTruckCount = Math.min(truckCount, FIRST_PAGE_TRUCKS)
  for (let index = 0; index < firstPageTruckCount; index += 1) {
    y = drawTruckSection(page1, font, boldFont, nextTruckNumber, y)
    nextTruckNumber += 1
    if (index < firstPageTruckCount - 1) {
      y -= TRUCK_SECTION_GAP
    }
  }

  for (let pageNumber = 2; pageNumber <= totalPages; pageNumber += 1) {
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    drawPageHeader(page, font, boldFont, {
      companyName,
      logoImg,
      pageLabel: `Page ${pageNumber}`,
    })
    drawFooter(page, font, pageNumber, totalPages)

    drawSectionBar(page, boldFont, 'TRUCK CONTINUATION', 690)
    let truckY = 660

    const trucksRemaining = truckCount - nextTruckNumber + 1
    const trucksThisPage = Math.max(0, Math.min(CONTINUATION_TRUCKS_PER_PAGE, trucksRemaining))

    for (let index = 0; index < trucksThisPage; index += 1) {
      truckY = drawTruckSection(page, font, boldFont, nextTruckNumber, truckY)
      nextTruckNumber += 1
      if (index < trucksThisPage - 1) {
        truckY -= TRUCK_SECTION_GAP
      }
    }

    if (pageNumber === totalPages) {
      drawRemarksSection(page, font, boldFont, FINAL_REMARKS_Y, FINAL_REMARKS_LINE_COUNT)
    } else {
      page.drawText('Continue onto the next sheet if more trucks are needed.', {
        x: MARGIN_X,
        y: 42,
        size: 8.5,
        font,
        color: COLORS.muted,
      })
    }
  }

  return pdfDoc.save()
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const projectName = String(searchParams.get('project_name') || '').trim()
  const requestedTruckCount = Number.parseInt(String(searchParams.get('truck_count') || ''), 10)
  const truckCount = Number.isFinite(requestedTruckCount)
    ? Math.max(1, Math.min(MAX_TRUCK_COUNT, requestedTruckCount))
    : DEFAULT_TRUCK_COUNT
  const remainingTrucks = Math.max(truckCount - FIRST_PAGE_TRUCKS, 0)
  const totalPages = 1 + Math.ceil(remainingTrucks / CONTINUATION_TRUCKS_PER_PAGE)
  let settings = null

  if (process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY) {
    try {
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SECRET_KEY
      )

      const { data } = await supabase
        .from('settings')
        .select('company_name, logo_url')
        .single()

      settings = data || null
    } catch (error) {
      console.error('Blank form settings lookup failed:', error)
    }
  }

  const bytes = await buildBlankFormPdf({
    projectName,
    companyName: settings?.company_name || 'Ironclad Construction LLC',
    logoUrl: settings?.logo_url || '',
    truckCount,
    totalPages,
  })

  return new Response(bytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="drilled-shaft-blank-form.pdf"',
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}
