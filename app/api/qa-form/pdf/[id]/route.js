import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { buildQaFormDisplaySections, getQaFormSummary, normalizeQaFormRecord } from '@/lib/qa-forms'
import { recordAuditEvent } from '@/lib/audit-log'
import { getUserId } from '@/lib/get-user-id'
import { getAccessibleQaFormById } from '@/lib/qa-form-access'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const [year, month, day] = String(dateStr).split('-')
  return `${month}-${day}-${year}`
}

function fitTextLines(font, text, size, maxWidth) {
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

export async function GET(request, { params }) {
  if (request.nextUrl.searchParams.has('mobile_v')) {
    const viewerUrl = new URL('/mobile/pdf', request.url)
    viewerUrl.searchParams.set('src', `/api/qa-form/pdf/${params.id}`)
    viewerUrl.searchParams.set('title', 'QA Form PDF')
    return NextResponse.redirect(viewerUrl)
  }

  const actorUserId = await getUserId()
  if (!actorUserId) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { qaForm: data, error } = await getAccessibleQaFormById(supabase, { formId: params.id, userId: actorUserId })
  if (error || !data) {
    return new Response('QA form not found.', { status: 404 })
  }

  const form = normalizeQaFormRecord(data)
  const summary = getQaFormSummary(form)
  const sections = buildQaFormDisplaySections(form)
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  let page = pdfDoc.addPage([612, 792])
  const COLORS = {
    ink: rgb(0.12, 0.15, 0.19),
    body: rgb(0.28, 0.33, 0.39),
    line: rgb(0.87, 0.89, 0.92),
    card: rgb(0.975, 0.98, 0.985),
    brand: rgb(0.16, 0.31, 0.45),
    white: rgb(1, 1, 1),
  }
  const { height } = page.getSize()
  let y = height - 92

  function drawHeader(targetPage) {
    targetPage.drawRectangle({ x: 0, y: height - 78, width: 612, height: 78, color: COLORS.brand })
    targetPage.drawText(summary.title, { x: 36, y: height - 40, size: 18, font: bold, color: COLORS.white })
    targetPage.drawText(`${summary.code} · ${form.project_name || '-'} · ${formatDate(form.work_date)}`, {
      x: 36,
      y: height - 60,
      size: 10,
      font,
      color: rgb(0.84, 0.9, 0.96),
    })
  }

  function addPage() {
    page = pdfDoc.addPage([612, 792])
    drawHeader(page)
    y = height - 92
  }

  function ensureSpace(required) {
    if (y - required < 36) addPage()
  }

  function drawSectionTitle(title) {
    ensureSpace(24)
    page.drawRectangle({ x: 36, y: y - 4, width: 540, height: 18, color: COLORS.brand })
    page.drawText(title, { x: 42, y, size: 10, font: bold, color: COLORS.white })
    y -= 24
  }

  drawHeader(page)

  for (const section of sections) {
    drawSectionTitle(section.title)

    if (section.kind === 'pairs') {
      for (const row of section.rows) {
        const lines = fitTextLines(font, row.value || '-', 9.5, 300)
        ensureSpace(20 + lines.length * 11)
        page.drawText(row.label, { x: 40, y, size: 8.5, font: bold, color: COLORS.body })
        lines.forEach((line, index) => {
          page.drawText(line, { x: 240, y: y - index * 11, size: 9.5, font, color: COLORS.ink })
        })
        y -= Math.max(18, lines.length * 11 + 4)
      }
      y -= 8
      continue
    }

    if (section.kind === 'tri_state_list') {
      for (const item of section.items) {
        const remarksLines = item.remarks ? fitTextLines(font, item.remarks, 9, 500) : []
        ensureSpace(22 + remarksLines.length * 10)
        page.drawText(item.label, { x: 40, y, size: 9, font: bold, color: COLORS.ink })
        page.drawText(item.status, { x: 420, y, size: 9, font, color: COLORS.body })
        remarksLines.forEach((line, index) => {
          page.drawText(line, { x: 52, y: y - 12 - index * 10, size: 9, font, color: COLORS.body })
        })
        y -= 20 + remarksLines.length * 10
      }
      y -= 8
      continue
    }

    if (section.kind === 'matrix' || section.kind === 'table') {
      const columns = section.columns
      const availableWidth = 540
      const firstWidth = section.kind === 'matrix' ? 240 : (columns[0]?.key === '_row' ? 160 : 0)
      const otherCount = section.kind === 'matrix' ? section.columns.length : (columns[0]?.key === '_row' ? columns.length - 1 : columns.length)
      const otherWidth = otherCount > 0 ? (availableWidth - firstWidth) / otherCount : availableWidth

      ensureSpace(28)
      let x = 36
      if (section.kind === 'matrix') {
        page.drawRectangle({ x, y: y - 14, width: firstWidth, height: 18, color: COLORS.card, borderColor: COLORS.line, borderWidth: 1 })
        page.drawText('Item', { x: x + 6, y: y - 2, size: 8.5, font: bold, color: COLORS.ink })
        x += firstWidth
        section.columns.forEach(column => {
          page.drawRectangle({ x, y: y - 14, width: otherWidth, height: 18, color: COLORS.card, borderColor: COLORS.line, borderWidth: 1 })
          page.drawText(column, { x: x + 6, y: y - 2, size: 8.5, font: bold, color: COLORS.ink })
          x += otherWidth
        })
      } else {
        columns.forEach((column, index) => {
          const width = index === 0 && column.key === '_row' ? firstWidth : otherWidth
          page.drawRectangle({ x, y: y - 14, width, height: 18, color: COLORS.card, borderColor: COLORS.line, borderWidth: 1 })
          page.drawText(column.label || '', { x: x + 6, y: y - 2, size: 8.5, font: bold, color: COLORS.ink })
          x += width
        })
      }
      y -= 18

      const rows = section.kind === 'matrix'
        ? section.rows.map(row => ({ label: row.label, values: row.values }))
        : section.rows.map(row => ({ values: columns.map(column => row[column.key] || '-') }))

      for (const row of rows) {
        ensureSpace(24)
        let rowX = 36
        if (section.kind === 'matrix') {
          page.drawRectangle({ x: rowX, y: y - 16, width: firstWidth, height: 20, borderColor: COLORS.line, borderWidth: 1 })
          page.drawText(row.label, { x: rowX + 6, y: y - 3, size: 8.5, font, color: COLORS.ink })
          rowX += firstWidth
        }

        row.values.forEach((value, index) => {
          const width = section.kind === 'table' && columns[index]?.key === '_row' ? firstWidth : otherWidth
          page.drawRectangle({ x: rowX, y: y - 16, width, height: 20, borderColor: COLORS.line, borderWidth: 1 })
          page.drawText(String(value || '-'), { x: rowX + 6, y: y - 3, size: 8.5, font, color: COLORS.ink })
          rowX += width
        })
        y -= 20
      }

      y -= 10
    }
  }

  const pdfBytes = await pdfDoc.save()

  await recordAuditEvent(supabase, {
    organizationId: form.organization_id,
    actorUserId,
    entityType: 'qa_form',
    entityId: form.id,
    action: 'pdf_generated',
    metadata: {
      route: 'qa_form_pdf',
      form_type: form.form_type,
      work_date: form.work_date,
    },
  })

  return new Response(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${summary.code.toLowerCase()}-${form.project_name || 'qa-form'}-${form.work_date || 'report'}.pdf"`,
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store',
    }
  })
}
