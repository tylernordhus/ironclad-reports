import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

const resend = new Resend(process.env.RESEND_API_KEY)

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
  const page = pdfDoc.addPage([612, 792])
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const { height } = page.getSize()

  page.drawRectangle({ x: 0, y: height - 80, width: 612, height: 80, color: rgb(0.1, 0.1, 0.1) })
  page.drawText('DRILLED SHAFT POUR LOG', { x: 40, y: height - 45, size: 20, font: boldFont, color: rgb(1, 1, 1) })
  page.drawText(companyName, { x: 40, y: height - 65, size: 11, font, color: rgb(0.8, 0.8, 0.8) })

  let y = height - 100

  const drawLine = (yPos) => {
    page.drawLine({ start: { x: 40, y: yPos }, end: { x: 572, y: yPos }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) })
  }

  const drawSectionHeader = (text, yPos) => {
    page.drawRectangle({ x: 40, y: yPos - 4, width: 532, height: 18, color: rgb(0.95, 0.95, 0.95) })
    page.drawText(text, { x: 44, y: yPos, size: 10, font: boldFont, color: rgb(0.2, 0.2, 0.2) })
    return yPos - 24
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
      if (y < 100) break
      page.drawText(f.foundation_id || '-', { x: 40, y, size: 11, font: boldFont, color: rgb(0.1, 0.1, 0.1) })
      y -= 16
      page.drawText('Depth: ' + (f.total_depth || '-') + '   Est. Yards: ' + (f.estimated_yards || '-'), { x: 44, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) })
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

  if (trucks && trucks.length > 0) {
    y = drawSectionHeader('CONCRETE TRUCKS', y)
    for (const t of trucks) {
      if (y < 120) break
      page.drawText('TRUCK ' + t.truck_number, { x: 40, y, size: 11, font: boldFont, color: rgb(0.1, 0.1, 0.1) })
      y -= 16
      page.drawText('Arrival: ' + formatTime(t.arrival_time) + '   Start: ' + formatTime(t.pour_start) + '   Complete: ' + formatTime(t.pour_complete), { x: 44, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) })
      y -= 14
      page.drawText('Yards: ' + (t.yards || '-') + '   Temp: ' + (t.concrete_temp || '-') + '   Slump: ' + (t.slump || '-') + '   Air: ' + (t.air_content || '-'), { x: 44, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) })
      y -= 14
      page.drawText('Water Added: ' + (t.water_added || '-') + '   Cylinders: ' + (t.cylinders_cast || '-') + '   Depth Reading: ' + (t.depth_reading || '-'), { x: 44, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) })
      y -= 14
      if (t.foundations_served) {
        page.drawText('Foundations Served: ' + t.foundations_served, { x: 44, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) })
        y -= 14
      }
      if (t.notes) {
        page.drawText('Notes: ' + t.notes, { x: 44, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) })
        y -= 14
      }
      y -= 8
      drawLine(y)
      y -= 12
    }
  }

  page.drawText('Generated by ' + companyName + ' - ' + new Date().toLocaleDateString(), {
    x: 40, y: 25, size: 8, font, color: rgb(0.6, 0.6, 0.6)
  })

  const pdfBytes = await pdfDoc.save()
  const pdfBuffer = Buffer.from(pdfBytes)

  const toEmail = project?.client_email || process.env.REPORT_DELIVERY_EMAIL

  await resend.emails.send({
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
      <p><strong>Total Trucks:</strong> ${trucks ? trucks.length : 0}</p>
      <p style="color:#999; font-size:12px;">PDF attached.</p>
    `,
    attachments: [{
      filename: 'pour-log-' + log.project_name + '-' + log.log_date + '.pdf',
      content: pdfBuffer
    }]
  })

  return Response.redirect(new URL('/pour-logs/' + log.id + '?sent=true', request.url))
}
