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
  brand: rgb(0.16, 0.31, 0.45),
}

function formatDate(d) {
  if (!d) return '-'
  const [y, m, day] = d.split('-')
  return m + '-' + day + '-' + y
}

function yn(val) {
  if (val === true) return 'Yes'
  if (val === false) return 'No'
  return '-'
}

export async function GET(request, { params }) {
  const { data: eval_, error } = await supabase
    .from('contractor_evaluations')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !eval_) return new Response('Not found', { status: 404 })

  const { data: settings } = await supabase.from('settings').select('company_name, logo_url').single()
  const companyName = settings?.company_name || 'Field Reports'

  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const addPage = () => {
    const p = pdfDoc.addPage([612, 792])
    p.drawRectangle({ x: 0, y: 792 - 70, width: 612, height: 70, color: COLORS.brand })
    p.drawText('CONTRACTOR EVALUATION', { x: 40, y: 792 - 38, size: 18, font: boldFont, color: rgb(1, 1, 1) })
    p.drawText(companyName, { x: 40, y: 792 - 58, size: 10, font, color: rgb(0.84, 0.9, 0.96) })
    return p
  }

  let page = addPage()
  let y = 792 - 90

  const drawRow = (label, value) => {
    if (y < 60) { page = addPage(); y = 792 - 90 }
    page.drawText(label + ':', { x: 40, y, size: 9, font: boldFont, color: COLORS.muted })
    page.drawText(String(value || '-'), { x: 200, y, size: 9, font, color: COLORS.ink })
    y -= 16
  }

  const drawSectionHeader = (text) => {
    if (y < 80) { page = addPage(); y = 792 - 90 }
    y -= 8
    page.drawRectangle({ x: 40, y: y - 4, width: 532, height: 18, color: COLORS.brand })
    page.drawText(text, { x: 44, y, size: 10, font: boldFont, color: rgb(1, 1, 1) })
    y -= 22
  }

  const drawCheck = (label, value) => {
    if (y < 60) { page = addPage(); y = 792 - 90 }
    page.drawText(label, { x: 44, y, size: 9, font, color: COLORS.body })
    const val = yn(value)
    const color = value === true ? rgb(0.16, 0.5, 0.16) : value === false ? rgb(0.8, 0.2, 0) : rgb(0.6, 0.6, 0.6)
    page.drawText(val, { x: 500, y, size: 9, font: boldFont, color })
    y -= 16
  }

  drawSectionHeader('INSPECTOR & CONTRACTOR INFORMATION')
  drawRow('Inspector', eval_.inspector_name)
  drawRow('Date', formatDate(eval_.inspection_date))
  drawRow('Location', eval_.inspection_location)
  drawRow('Contractor', eval_.contractor_name)
  drawRow('Project', eval_.project_name)
  drawRow('Supervisor', eval_.supervisor_name)

  drawSectionHeader('SAFETY COMPLIANCE')
  drawCheck('Workers wearing appropriate PPE?', eval_.ppe_compliant)
  drawCheck('Safety signs and barriers in place?', eval_.safety_signs)
  drawCheck('Emergency procedures communicated?', eval_.emergency_procedures)
  if (eval_.safety_comments) drawRow('Comments', eval_.safety_comments)

  drawSectionHeader('WORK QUALITY')
  drawCheck('Work performed to project specifications?', eval_.work_specs)
  drawCheck('Materials and equipment acceptable quality?', eval_.materials_quality)
  drawCheck('Workmanship neat and professional?', eval_.workmanship)
  if (eval_.work_quality_comments) drawRow('Comments', eval_.work_quality_comments)

  drawSectionHeader('TIMELINESS')
  drawCheck('Project on schedule?', eval_.on_schedule)
  drawCheck('Milestones being met?', eval_.milestones_met)
  if (eval_.timeliness_comments) drawRow('Comments', eval_.timeliness_comments)

  drawSectionHeader('COMMUNICATION')
  drawCheck('Contractor responsive to inquiries?', eval_.contractor_responsive)
  drawCheck('Progress reports provided regularly?', eval_.progress_reports)
  if (eval_.communication_comments) drawRow('Comments', eval_.communication_comments)

  drawSectionHeader('COMPLIANCE WITH REGULATIONS')
  drawCheck('Adhering to all regulations?', eval_.regulations_compliant)
  drawCheck('Permits and licenses current?', eval_.permits_current)
  if (eval_.compliance_comments) drawRow('Comments', eval_.compliance_comments)

  drawSectionHeader('ENVIRONMENTAL CONSIDERATIONS')
  drawCheck('Minimizing environmental impact?', eval_.env_impact_minimized)
  drawCheck('Waste disposed of properly?', eval_.waste_disposal)
  if (eval_.environmental_comments) drawRow('Comments', eval_.environmental_comments)

  drawSectionHeader('OVERALL EVALUATION')
  drawRow('Overall Rating', eval_.overall_rating)
  if (eval_.overall_comments) drawRow('Comments', eval_.overall_comments)

  drawSectionHeader('INSPECTOR SIGNATURE')
  drawRow('Signature', eval_.inspector_signature)
  drawRow('Date', formatDate(eval_.signature_date))

  page.drawLine({ start: { x: 40, y: 28 }, end: { x: 572, y: 28 }, thickness: 0.7, color: COLORS.line })
  page.drawText(companyName, { x: 40, y: 16, size: 8, font, color: COLORS.muted })

  const pdfBytes = await pdfDoc.save()

  return new Response(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="contractor-eval-${eval_.project_name || 'report'}-${eval_.inspection_date || 'unknown'}.pdf"`
    }
  })
}
