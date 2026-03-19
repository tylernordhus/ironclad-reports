import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

const RED = rgb(0.8, 0.2, 0)
const BLACK = rgb(0.1, 0.1, 0.1)
const DARK = rgb(0.15, 0.15, 0.15)
const GRAY = rgb(0.45, 0.45, 0.45)
const LIGHT_GRAY = rgb(0.92, 0.92, 0.92)
const MID_GRAY = rgb(0.75, 0.75, 0.75)
const WHITE = rgb(1, 1, 1)
const GREEN = rgb(0.16, 0.5, 0.16)
const BLUE = rgb(0.1, 0.29, 0.8)
const PAGE_W = 612
const PAGE_H = 792
const MARGIN = 50

export async function GET() {
  const { data: settings } = await supabase.from('settings').select('company_name, logo_url').single()
  const companyName = settings?.company_name || 'Ironclad Construction'

  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const oblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

  // Logo embedding
  let logoImg = null
  if (settings?.logo_url) {
    try {
      const res = await fetch(settings.logo_url)
      const bytes = new Uint8Array(await res.arrayBuffer())
      try { logoImg = await pdfDoc.embedPng(bytes) } catch { logoImg = await pdfDoc.embedJpg(bytes) }
    } catch {}
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  function addPage() {
    return pdfDoc.addPage([PAGE_W, PAGE_H])
  }

  function drawPageHeader(page, title) {
    page.drawRectangle({ x: 0, y: PAGE_H - 36, width: PAGE_W, height: 36, color: DARK })
    page.drawText(companyName.toUpperCase() + '  ·  FIELD REPORTING APP — SOP', {
      x: MARGIN, y: PAGE_H - 24, size: 8, font, color: rgb(0.7, 0.7, 0.7)
    })
    if (title) {
      page.drawText(title, { x: PAGE_W - MARGIN - bold.widthOfTextAtSize(title, 8), y: PAGE_H - 24, size: 8, font: bold, color: MID_GRAY })
    }
  }

  function drawPageFooter(page, num, total) {
    page.drawLine({ start: { x: MARGIN, y: 30 }, end: { x: PAGE_W - MARGIN, y: 30 }, thickness: 0.5, color: LIGHT_GRAY })
    page.drawText('Page ' + num + ' of ' + total, { x: PAGE_W / 2 - 20, y: 16, size: 8, font, color: GRAY })
    page.drawText('CONFIDENTIAL — FOR INTERNAL USE ONLY', { x: MARGIN, y: 16, size: 7, font: oblique, color: MID_GRAY })
  }

  function wrapText(text, maxWidth, fontSize, f) {
    const words = String(text || '').split(' ')
    const lines = []
    let line = ''
    for (const word of words) {
      const test = line ? line + ' ' + word : word
      if (f.widthOfTextAtSize(test, fontSize) > maxWidth) {
        if (line) lines.push(line)
        line = word
      } else {
        line = test
      }
    }
    if (line) lines.push(line)
    return lines
  }

  function drawWrapped(page, text, x, y, maxWidth, size, f, color) {
    const lines = wrapText(text, maxWidth, size, f)
    let cy = y
    for (const line of lines) {
      page.drawText(line, { x, y: cy, size, font: f, color })
      cy -= size + 3
    }
    return cy
  }

  function sectionHeader(page, y, text) {
    page.drawRectangle({ x: MARGIN, y: y - 5, width: PAGE_W - MARGIN * 2, height: 22, color: RED })
    page.drawText(text, { x: MARGIN + 8, y: y + 4, size: 11, font: bold, color: WHITE })
    return y - 30
  }

  function subHeader(page, y, text) {
    page.drawRectangle({ x: MARGIN, y: y - 4, width: PAGE_W - MARGIN * 2, height: 18, color: LIGHT_GRAY })
    page.drawText(text, { x: MARGIN + 8, y: y + 1, size: 9.5, font: bold, color: BLACK })
    return y - 24
  }

  function step(page, y, num, text, maxWidth) {
    page.drawCircle({ x: MARGIN + 8, y: y + 4, size: 7, color: RED })
    page.drawText(String(num), { x: MARGIN + 5.5, y: y + 1, size: 7, font: bold, color: WHITE })
    const lines = wrapText(text, maxWidth - 22, 9.5, font)
    let cy = y
    for (let i = 0; i < lines.length; i++) {
      page.drawText(lines[i], { x: MARGIN + 22, y: cy, size: 9.5, font: i === 0 ? font : font, color: BLACK })
      cy -= 13
    }
    return cy - 4
  }

  function note(page, y, text, maxWidth) {
    page.drawRectangle({ x: MARGIN, y: y - 20, width: PAGE_W - MARGIN * 2, height: 26, color: rgb(1, 0.97, 0.93) })
    page.drawText('NOTE:', { x: MARGIN + 8, y: y - 8, size: 8, font: bold, color: rgb(0.7, 0.35, 0) })
    page.drawText(text, { x: MARGIN + 48, y: y - 8, size: 8, font, color: rgb(0.4, 0.2, 0) })
    return y - 30
  }

  function imageBox(page, y, label, h) {
    const bh = h || 110
    page.drawRectangle({ x: MARGIN, y: y - bh, width: PAGE_W - MARGIN * 2, height: bh, borderColor: MID_GRAY, borderWidth: 1, color: rgb(0.97, 0.97, 0.97) })
    const lw = font.widthOfTextAtSize('[  ' + label + '  ]', 9)
    page.drawText('[  ' + label + '  ]', { x: PAGE_W / 2 - lw / 2, y: y - bh / 2 - 4, size: 9, font: oblique, color: MID_GRAY })
    return y - bh - 10
  }

  function twoCol(page, y, leftLabel, leftText, rightLabel, rightText) {
    const colW = (PAGE_W - MARGIN * 2 - 20) / 2
    page.drawText(leftLabel, { x: MARGIN, y, size: 7.5, font: bold, color: GRAY })
    page.drawText(leftText, { x: MARGIN, y: y - 12, size: 9, font, color: BLACK })
    page.drawText(rightLabel, { x: MARGIN + colW + 20, y, size: 7.5, font: bold, color: GRAY })
    page.drawText(rightText, { x: MARGIN + colW + 20, y: y - 12, size: 9, font, color: BLACK })
    return y - 28
  }

  // ─── Build pages array (we'll number them after) ───────────────────────────
  const pages = []

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 1 — COVER
  // ══════════════════════════════════════════════════════════════════════════
  const cover = addPage()
  pages.push({ page: cover, section: '' })

  cover.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: DARK })
  cover.drawRectangle({ x: 0, y: PAGE_H - 220, width: PAGE_W, height: 220, color: RED })

  if (logoImg) {
    const { width: lw, height: lh } = logoImg.scale(1)
    const scale = Math.min(120 / lw, 70 / lh)
    cover.drawImage(logoImg, { x: PAGE_W / 2 - (lw * scale) / 2, y: PAGE_H - 100 - lh * scale / 2, width: lw * scale, height: lh * scale })
  } else {
    cover.drawText(companyName.toUpperCase(), { x: PAGE_W / 2 - bold.widthOfTextAtSize(companyName.toUpperCase(), 16) / 2, y: PAGE_H - 110, size: 16, font: bold, color: WHITE })
  }

  cover.drawText('FIELD REPORTING APP', { x: PAGE_W / 2 - bold.widthOfTextAtSize('FIELD REPORTING APP', 28) / 2, y: PAGE_H - 160, size: 28, font: bold, color: WHITE })
  cover.drawText('STANDARD OPERATING PROCEDURE', { x: PAGE_W / 2 - font.widthOfTextAtSize('STANDARD OPERATING PROCEDURE', 12) / 2, y: PAGE_H - 185, size: 12, font, color: rgb(1, 0.85, 0.8) })

  cover.drawRectangle({ x: 60, y: PAGE_H - 270, width: PAGE_W - 120, height: 1, color: rgb(0.4, 0.4, 0.4) })

  cover.drawText('Inspector Gadget', { x: PAGE_W / 2 - bold.widthOfTextAtSize('Inspector Gadget', 22) / 2, y: PAGE_H - 310, size: 22, font: bold, color: WHITE })
  cover.drawText('Mobile-first field reporting for construction inspection teams', { x: PAGE_W / 2 - font.widthOfTextAtSize('Mobile-first field reporting for construction inspection teams', 10) / 2, y: PAGE_H - 334, size: 10, font, color: rgb(0.7, 0.7, 0.7) })

  const tocItems = [
    '1.  Getting Started — Login & Access',
    '2.  Home Screen Overview',
    '3.  Projects',
    '4.  Daily Reports',
    '5.  Pour Logs — Drilled Shaft',
    '6.  Pour Logs — Flatwork',
    '7.  Contractor Evaluations',
    '8.  Viewing & Managing All Reports',
    '9.  Downloading PDFs',
    '10. Settings',
  ]
  let tocY = PAGE_H - 390
  cover.drawText('TABLE OF CONTENTS', { x: MARGIN + 20, y: tocY, size: 9, font: bold, color: RED })
  tocY -= 18
  for (const item of tocItems) {
    cover.drawText(item, { x: MARGIN + 20, y: tocY, size: 9, font, color: rgb(0.75, 0.75, 0.75) })
    tocY -= 16
  }

  cover.drawText('Version 1.0  ·  ' + new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), { x: MARGIN + 20, y: 50, size: 8, font, color: rgb(0.5, 0.5, 0.5) })
  cover.drawText('app.ironcladks.com', { x: PAGE_W - MARGIN - font.widthOfTextAtSize('app.ironcladks.com', 8) - 20, y: 50, size: 8, font, color: RED })

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 2 — GETTING STARTED
  // ══════════════════════════════════════════════════════════════════════════
  const p2 = addPage()
  pages.push({ page: p2, section: '1. Getting Started' })
  drawPageHeader(p2, '1. Getting Started')
  let y = PAGE_H - 60

  y = sectionHeader(p2, y, '1.  GETTING STARTED — LOGIN & ACCESS')
  y -= 6

  p2.drawText('The Inspector Gadget app is accessed through any web browser on your phone, tablet, or computer.', { x: MARGIN, y, size: 9.5, font, color: BLACK })
  y -= 22
  y = subHeader(p2, y, 'Accessing the App')
  y -= 4
  y = step(p2, y, 1, 'Open your web browser (Safari, Chrome, etc.)', PAGE_W - MARGIN * 2)
  y = step(p2, y, 2, 'Navigate to:  app.ironcladks.com', PAGE_W - MARGIN * 2)
  y = step(p2, y, 3, 'You will be redirected to the login screen automatically.', PAGE_W - MARGIN * 2)
  y -= 8

  y = imageBox(p2, y, 'Screenshot: Login screen — "Inspector Gadget" title, email and password fields', 100)

  y = subHeader(p2, y, 'Logging In')
  y -= 4
  y = step(p2, y, 1, 'Enter your company email address in the Email field.', PAGE_W - MARGIN * 2)
  y = step(p2, y, 2, 'Enter your password in the Password field.', PAGE_W - MARGIN * 2)
  y = step(p2, y, 3, 'Tap or click "Sign In".', PAGE_W - MARGIN * 2)
  y = step(p2, y, 4, 'You will be taken to the Home Screen upon successful login.', PAGE_W - MARGIN * 2)
  y -= 8
  y = note(p2, y, 'You must have an account created by your administrator before logging in.')
  y -= 10

  y = subHeader(p2, y, 'Adding to iPhone Home Screen (Recommended)')
  y -= 4
  y = step(p2, y, 1, 'Open app.ironcladks.com in Safari on your iPhone.', PAGE_W - MARGIN * 2)
  y = step(p2, y, 2, 'Tap the Share button (box with arrow) at the bottom of Safari.', PAGE_W - MARGIN * 2)
  y = step(p2, y, 3, 'Scroll down and tap "Add to Home Screen".', PAGE_W - MARGIN * 2)
  y = step(p2, y, 4, 'Tap "Add" — the app icon will appear on your home screen like a native app.', PAGE_W - MARGIN * 2)

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 3 — HOME SCREEN
  // ══════════════════════════════════════════════════════════════════════════
  const p3 = addPage()
  pages.push({ page: p3, section: '2. Home Screen' })
  drawPageHeader(p3, '2. Home Screen Overview')
  y = PAGE_H - 60

  y = sectionHeader(p3, y, '2.  HOME SCREEN OVERVIEW')
  y -= 6
  p3.drawText('After login, the Home Screen gives you quick access to all form submission features of the app.', { x: MARGIN, y, size: 9.5, font, color: BLACK })
  y -= 22

  y = imageBox(p3, y, 'Screenshot: Home Screen — showing action cards', 110)

  y = subHeader(p3, y, 'Home Screen Action Cards')
  y -= 8

  const homeItems = [
    { label: 'Projects  (red card)', desc: 'View, create, and manage all your projects. This is the main hub for all project-level activity.' },
    { label: 'Daily Report  (dark card)', desc: 'Submit a daily crew, weather, and work summary report. You will be asked to select a project first.' },
    { label: 'Pour Log  (dark card)', desc: 'Record concrete pour details including foundations and truck data. Select a project first.' },
    { label: 'Contractor Evaluation  (dark card)', desc: 'Complete a structured evaluation of a contractor across 6 categories. Select a project first.' },
    { label: 'Sign Out  (bottom link)', desc: 'Securely log out of the application.' },
  ]

  for (const item of homeItems) {
    if (y < 80) break
    p3.drawText(item.label, { x: MARGIN + 8, y, size: 9.5, font: bold, color: RED })
    y -= 14
    const lines = wrapText(item.desc, PAGE_W - MARGIN * 2 - 16, 9, font)
    for (const line of lines) {
      p3.drawText(line, { x: MARGIN + 16, y, size: 9, font, color: GRAY })
      y -= 13
    }
    y -= 6
  }

  y -= 4
  y = subHeader(p3, y, 'Bottom Navigation Bar')
  y -= 6
  p3.drawText('A navigation bar is always visible at the bottom of every screen with four quick-access tabs:', { x: MARGIN, y, size: 9.5, font, color: BLACK })
  y -= 18

  const navTabItems = [
    { label: 'Home', desc: 'Return to the main action menu.' },
    { label: 'Projects', desc: 'Jump directly to the full projects list.' },
    { label: 'Reports', desc: 'Open the View All Reports page.' },
    { label: 'Settings', desc: 'Access company settings and logo upload.' },
  ]
  for (const t of navTabItems) {
    if (y < 60) break
    p3.drawText(t.label + ':', { x: MARGIN + 8, y, size: 9.5, font: bold, color: BLACK })
    p3.drawText(t.desc, { x: MARGIN + 8 + bold.widthOfTextAtSize(t.label + ':', 9.5) + 6, y, size: 9.5, font, color: GRAY })
    y -= 16
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 4 — PROJECTS
  // ══════════════════════════════════════════════════════════════════════════
  const p4 = addPage()
  pages.push({ page: p4, section: '3. Projects' })
  drawPageHeader(p4, '3. Projects')
  y = PAGE_H - 60

  y = sectionHeader(p4, y, '3.  PROJECTS')
  y -= 6
  p4.drawText('Projects are the foundation of the app. Every report, pour log, and evaluation is linked to a project.', { x: MARGIN, y, size: 9.5, font, color: BLACK })
  y -= 22

  y = subHeader(p4, y, 'Creating a New Project')
  y -= 4
  y = step(p4, y, 1, 'From the Home Screen, tap "Projects".', PAGE_W - MARGIN * 2)
  y = step(p4, y, 2, 'Tap "+ New Project" button at the top right.', PAGE_W - MARGIN * 2)
  y = step(p4, y, 3, 'Fill in the Project Name, Location, Client Name, and other details.', PAGE_W - MARGIN * 2)
  y = step(p4, y, 4, 'Tap "Create Project" to save.', PAGE_W - MARGIN * 2)
  y -= 8

  y = imageBox(p4, y, 'Screenshot: Project list and New Project form', 100)

  y = subHeader(p4, y, 'Viewing a Project')
  y -= 4
  y = step(p4, y, 1, 'From the Projects list, tap on any project name.', PAGE_W - MARGIN * 2)
  y = step(p4, y, 2, 'The Project Detail page shows all reports, pour logs, and evaluations for that project.', PAGE_W - MARGIN * 2)
  y = step(p4, y, 3, 'Use the action buttons at the top to add a Daily Report, Pour Log, or Contractor Eval.', PAGE_W - MARGIN * 2)
  y -= 8

  y = subHeader(p4, y, 'Editing a Project')
  y -= 4
  y = step(p4, y, 1, 'Open the project detail page.', PAGE_W - MARGIN * 2)
  y = step(p4, y, 2, 'Tap the "Edit Project" button.', PAGE_W - MARGIN * 2)
  y = step(p4, y, 3, 'Update any fields and tap "Save Changes".', PAGE_W - MARGIN * 2)

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 5 — DAILY REPORTS
  // ══════════════════════════════════════════════════════════════════════════
  const p5 = addPage()
  pages.push({ page: p5, section: '4. Daily Reports' })
  drawPageHeader(p5, '4. Daily Reports')
  y = PAGE_H - 60

  y = sectionHeader(p5, y, '4.  DAILY REPORTS')
  y -= 6
  p5.drawText('The Daily Report captures crew size, weather, work completed, equipment, and safety notes for each day on site.', { x: MARGIN, y, size: 9.5, font, color: BLACK })
  y -= 22

  y = subHeader(p5, y, 'Submitting a Daily Report')
  y -= 4
  y = step(p5, y, 1, 'From the Home Screen tap "Daily Report", or open a Project and tap "+ Daily Report".', PAGE_W - MARGIN * 2)
  y = step(p5, y, 2, 'If coming from the Home Screen, you will be prompted to select a project first.', PAGE_W - MARGIN * 2)
  y = step(p5, y, 3, 'Fill in the Report Date, Submitted By name, and Crew Count.', PAGE_W - MARGIN * 2)
  y = step(p5, y, 4, 'Describe the Weather Conditions.', PAGE_W - MARGIN * 2)
  y = step(p5, y, 5, 'Enter Work Completed Today — be specific about tasks and locations.', PAGE_W - MARGIN * 2)
  y = step(p5, y, 6, 'List Equipment Used on site.', PAGE_W - MARGIN * 2)
  y = step(p5, y, 7, 'Note any Safety Issues or incidents (enter "None" if no issues).', PAGE_W - MARGIN * 2)
  y = step(p5, y, 8, 'Optionally attach photos using the photo picker.', PAGE_W - MARGIN * 2)
  y = step(p5, y, 9, 'Tap "Submit Report".', PAGE_W - MARGIN * 2)
  y -= 8

  y = imageBox(p5, y, 'Screenshot: Daily Report form on iPhone', 95)

  y = subHeader(p5, y, 'Viewing & Editing a Daily Report')
  y -= 4
  y = step(p5, y, 1, 'Navigate to the project and tap the daily report, or go to "View All Reports".', PAGE_W - MARGIN * 2)
  y = step(p5, y, 2, 'The detail view shows all fields, photos, and a "Download PDF" button.', PAGE_W - MARGIN * 2)
  y = step(p5, y, 3, 'Tap "Edit Report" to modify any field and save changes.', PAGE_W - MARGIN * 2)
  y -= 4
  y = note(p5, y, 'iPhone photos are automatically converted from HEIC to JPEG — no action needed.')

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 6 — POUR LOGS
  // ══════════════════════════════════════════════════════════════════════════
  const p6 = addPage()
  pages.push({ page: p6, section: '5 & 6. Pour Logs' })
  drawPageHeader(p6, '5 & 6. Pour Logs')
  y = PAGE_H - 60

  y = sectionHeader(p6, y, '5.  POUR LOGS — DRILLED SHAFT')
  y -= 6
  p6.drawText('Records concrete placement data for drilled shaft foundations, including per-foundation and per-truck details.', { x: MARGIN, y, size: 9.5, font, color: BLACK })
  y -= 22

  y = subHeader(p6, y, 'Submitting a Drilled Shaft Pour Log')
  y -= 4
  y = step(p6, y, 1, 'From a project, tap "+ Pour Log", then choose "Drilled Shaft Pour Log".', PAGE_W - MARGIN * 2)
  y = step(p6, y, 2, 'Fill in Date, Weather, Ambient Temp, Concrete Supplier, and Submitted By.', PAGE_W - MARGIN * 2)
  y = step(p6, y, 3, 'Under "Foundations Poured", enter each Foundation ID, Total Depth, Estimated Yards, and Notes.', PAGE_W - MARGIN * 2)
  y = step(p6, y, 4, 'Tap "+ Add Foundation" to add more foundations.', PAGE_W - MARGIN * 2)
  y = step(p6, y, 5, 'Under "Concrete Trucks", fill in Truck Number, Arrival/Start/Complete times, Yards, Temp, Slump, Air, Water Added, Cylinders Cast, Depth Reading, and Foundations Served.', PAGE_W - MARGIN * 2)
  y = step(p6, y, 6, 'Tap "+ Add Truck" for each additional truck.', PAGE_W - MARGIN * 2)
  y = step(p6, y, 7, 'Attach any photos, then tap "Submit Pour Log".', PAGE_W - MARGIN * 2)
  y -= 12

  y = sectionHeader(p6, y, '6.  POUR LOGS — FLATWORK')
  y -= 6
  p6.drawText('Used for flatwork concrete pours (slabs, sidewalks, etc.). Similar to drilled shaft but without foundation entries.', { x: MARGIN, y, size: 9.5, font, color: BLACK })
  y -= 22

  y = subHeader(p6, y, 'Submitting a Flatwork Pour Log')
  y -= 4
  y = step(p6, y, 1, 'From a project, tap "+ Pour Log", then choose "Flatwork Pour Log".', PAGE_W - MARGIN * 2)
  y = step(p6, y, 2, 'Fill in Date, Weather, Temp, Supplier, and Submitted By.', PAGE_W - MARGIN * 2)
  y = step(p6, y, 3, 'Enter truck data for each truck (same fields as drilled shaft).', PAGE_W - MARGIN * 2)
  y = step(p6, y, 4, 'Add photos and tap "Submit Flatwork Log".', PAGE_W - MARGIN * 2)
  y -= 8

  y = subHeader(p6, y, 'Editing a Pour Log')
  y -= 4
  y = step(p6, y, 1, 'Open the pour log from the project page or "View All Reports".', PAGE_W - MARGIN * 2)
  y = step(p6, y, 2, 'Tap "Edit Log" to modify foundation and truck data.', PAGE_W - MARGIN * 2)
  y = step(p6, y, 3, 'Save changes — existing foundation/truck records are replaced with the updated data.', PAGE_W - MARGIN * 2)
  y -= 4
  y = note(p6, y, 'Pour logs are tagged POUR LOG (drilled shaft) or FLATWORK in the reports list.')

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 7 — CONTRACTOR EVALUATIONS
  // ══════════════════════════════════════════════════════════════════════════
  const p7 = addPage()
  pages.push({ page: p7, section: '7. Contractor Evaluations' })
  drawPageHeader(p7, '7. Contractor Evaluations')
  y = PAGE_H - 60

  y = sectionHeader(p7, y, '7.  CONTRACTOR EVALUATIONS')
  y -= 6
  p7.drawText('A structured Yes/No evaluation form covering 6 categories of contractor performance.', { x: MARGIN, y, size: 9.5, font, color: BLACK })
  y -= 22

  y = subHeader(p7, y, 'Submitting a Contractor Evaluation')
  y -= 4
  y = step(p7, y, 1, 'From the Home Screen tap "Contractor Evaluation", or open a Project and tap "+ Contractor Eval".', PAGE_W - MARGIN * 2)
  y = step(p7, y, 2, 'If from Home Screen, select a project when prompted.', PAGE_W - MARGIN * 2)
  y = step(p7, y, 3, 'Complete the Inspector Information section: name, date, and inspection location.', PAGE_W - MARGIN * 2)
  y = step(p7, y, 4, 'Complete the Contractor Information section: contractor name, project name, and supervisor.', PAGE_W - MARGIN * 2)
  y = step(p7, y, 5, 'Answer Yes or No for each question in all 6 evaluation categories (see below).', PAGE_W - MARGIN * 2)
  y = step(p7, y, 6, 'Add comments in any comment box for clarification.', PAGE_W - MARGIN * 2)
  y = step(p7, y, 7, 'Select an Overall Performance Rating.', PAGE_W - MARGIN * 2)
  y = step(p7, y, 8, 'Type your full name in the Signature field and enter the date.', PAGE_W - MARGIN * 2)
  y = step(p7, y, 9, 'Tap "Submit Evaluation".', PAGE_W - MARGIN * 2)
  y -= 12

  y = subHeader(p7, y, 'The 6 Evaluation Categories')
  y -= 8

  const cats = [
    { num: '1', name: 'Safety Compliance', items: 'PPE worn, safety signs in place, emergency procedures communicated' },
    { num: '2', name: 'Work Quality', items: 'Meets specifications, materials quality, workmanship' },
    { num: '3', name: 'Timeliness', items: 'On schedule, milestones met' },
    { num: '4', name: 'Communication', items: 'Responsive to inquiries, provides progress reports' },
    { num: '5', name: 'Compliance with Regulations', items: 'Adhering to regulations, permits current' },
    { num: '6', name: 'Environmental Considerations', items: 'Minimizing impact, proper waste disposal' },
  ]

  for (const cat of cats) {
    if (y < 70) break
    p7.drawText(cat.num + '.  ' + cat.name, { x: MARGIN + 8, y, size: 9.5, font: bold, color: RED })
    y -= 13
    p7.drawText(cat.items, { x: MARGIN + 20, y, size: 8.5, font, color: GRAY })
    y -= 18
  }

  y -= 4
  y = subHeader(p7, y, 'Performance Ratings')
  y -= 8
  const ratings = [
    { r: 'Excellent', d: 'Consistently exceeds expectations across all areas.' },
    { r: 'Good', d: 'Meets expectations with minor areas for improvement.' },
    { r: 'Satisfactory', d: 'Meets minimum requirements; some issues noted.' },
    { r: 'Needs Improvement', d: 'Multiple deficiencies; corrective action required.' },
    { r: 'Unsatisfactory', d: 'Significant failures; immediate action required.' },
  ]
  for (const item of ratings) {
    if (y < 60) break
    p7.drawText(item.r + ':  ', { x: MARGIN + 8, y, size: 9, font: bold, color: BLACK })
    p7.drawText(item.d, { x: MARGIN + 8 + bold.widthOfTextAtSize(item.r + ':  ', 9), y, size: 9, font, color: GRAY })
    y -= 15
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 8 — VIEWING REPORTS & PDFS
  // ══════════════════════════════════════════════════════════════════════════
  const p8 = addPage()
  pages.push({ page: p8, section: '8 & 9. Reports & PDFs' })
  drawPageHeader(p8, '8 & 9. Reports & PDFs')
  y = PAGE_H - 60

  y = sectionHeader(p8, y, '8.  VIEWING & MANAGING ALL REPORTS')
  y -= 6
  p8.drawText('The "View All Reports" page shows every report grouped by project with color-coded type badges.', { x: MARGIN, y, size: 9.5, font, color: BLACK })
  y -= 22

  y = subHeader(p8, y, 'Badge Color Guide')
  y -= 10

  const badges = [
    { color: RED, label: 'DAILY', desc: 'Daily Field Report' },
    { color: BLUE, label: 'POUR LOG', desc: 'Drilled Shaft Pour Log' },
    { color: BLUE, label: 'FLATWORK', desc: 'Flatwork Pour Log' },
    { color: GREEN, label: 'EVAL', desc: 'Contractor Evaluation' },
  ]
  for (const b of badges) {
    p8.drawRectangle({ x: MARGIN + 8, y: y - 4, width: 60, height: 16, color: b.color, borderRadius: 3 })
    p8.drawText(b.label, { x: MARGIN + 10, y: y + 0, size: 7.5, font: bold, color: WHITE })
    p8.drawText('—  ' + b.desc, { x: MARGIN + 76, y, size: 9, font, color: BLACK })
    y -= 20
  }
  y -= 6

  y = subHeader(p8, y, 'Deleting a Record')
  y -= 4
  y = step(p8, y, 1, 'Open any report, pour log, or evaluation detail page.', PAGE_W - MARGIN * 2)
  y = step(p8, y, 2, 'Tap the "Delete" button.', PAGE_W - MARGIN * 2)
  y = step(p8, y, 3, 'A confirmation dialog will appear: "Are you sure you want to delete this?"', PAGE_W - MARGIN * 2)
  y = step(p8, y, 4, 'Tap OK to confirm. The record is permanently removed.', PAGE_W - MARGIN * 2)
  y -= 4
  y = note(p8, y, 'Deletion is permanent and cannot be undone. Download a PDF first if you need a record.')
  y -= 14

  y = sectionHeader(p8, y, '9.  DOWNLOADING PDFs')
  y -= 6
  p8.drawText('Every report type can be exported as a professionally formatted PDF with your company branding.', { x: MARGIN, y, size: 9.5, font, color: BLACK })
  y -= 22

  y = subHeader(p8, y, 'How to Download a PDF')
  y -= 4
  y = step(p8, y, 1, 'Open any report, pour log, or evaluation detail page.', PAGE_W - MARGIN * 2)
  y = step(p8, y, 2, 'Tap the "Download PDF" button.', PAGE_W - MARGIN * 2)
  y = step(p8, y, 3, 'On iPhone: the PDF will open in your browser. Tap the Share button to save or print it.', PAGE_W - MARGIN * 2)
  y = step(p8, y, 4, 'On desktop: the PDF downloads to your Downloads folder automatically.', PAGE_W - MARGIN * 2)
  y -= 10

  y = imageBox(p8, y, 'Screenshot: Pour Log detail page showing Download PDF and Edit buttons', 90)

  y = subHeader(p8, y, 'PDF Contents by Report Type')
  y -= 8

  const pdfContents = [
    { type: 'Daily Report PDF', content: 'Project name, date, submitted by, crew count, weather, work completed, equipment, safety notes, photos.' },
    { type: 'Pour Log PDF', content: 'Job info, supplier, weather, all foundation records, all truck records (times, temps, slump, air, depth), photos.' },
    { type: 'Contractor Eval PDF', content: 'All 6 evaluation categories with Yes/No answers color-coded green/red, overall rating, and inspector signature.' },
  ]
  for (const item of pdfContents) {
    if (y < 70) break
    p8.drawText(item.type, { x: MARGIN + 8, y, size: 9.5, font: bold, color: BLACK })
    y -= 13
    const lines = wrapText(item.content, PAGE_W - MARGIN * 2 - 16, 9, font)
    for (const line of lines) {
      p8.drawText(line, { x: MARGIN + 16, y, size: 9, font, color: GRAY })
      y -= 13
    }
    y -= 6
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 9 — SETTINGS & TIPS
  // ══════════════════════════════════════════════════════════════════════════
  const p9 = addPage()
  pages.push({ page: p9, section: '10. Settings' })
  drawPageHeader(p9, '10. Settings & Quick Reference')
  y = PAGE_H - 60

  y = sectionHeader(p9, y, '10.  SETTINGS')
  y -= 6
  p9.drawText('The Settings page lets you configure your company branding that appears on all PDFs and the home screen.', { x: MARGIN, y, size: 9.5, font, color: BLACK })
  y -= 22

  y = subHeader(p9, y, 'Updating Company Name')
  y -= 4
  y = step(p9, y, 1, 'From the Home Screen, tap "Settings".', PAGE_W - MARGIN * 2)
  y = step(p9, y, 2, 'Type your company name in the Company Name field.', PAGE_W - MARGIN * 2)
  y = step(p9, y, 3, 'Tap "Save Settings".', PAGE_W - MARGIN * 2)
  y -= 10

  y = subHeader(p9, y, 'Uploading a Company Logo')
  y -= 4
  y = step(p9, y, 1, 'On the Settings page, tap "Choose File" next to the logo upload.', PAGE_W - MARGIN * 2)
  y = step(p9, y, 2, 'Select a PNG or JPG image of your company logo.', PAGE_W - MARGIN * 2)
  y = step(p9, y, 3, 'Tap "Save Settings" — the logo will appear on the home screen and on all PDF headers.', PAGE_W - MARGIN * 2)
  y -= 4
  y = note(p9, y, 'Recommended logo size: under 200px wide, PNG with transparent background works best.')
  y -= 16

  y = sectionHeader(p9, y, 'QUICK REFERENCE — NAVIGATION FLOW')
  y -= 14

  const flows = [
    { from: 'Bottom Nav: Projects', to: 'Project Detail', end: 'Submit any report directly' },
    { from: 'Home: Daily Report', to: 'Select Project', end: 'Daily Report Form' },
    { from: 'Home: Pour Log', to: 'Select Project', end: 'Choose Drilled Shaft or Flatwork' },
    { from: 'Home: Contractor Eval', to: 'Select Project', end: 'Evaluation Form' },
    { from: 'Bottom Nav: Reports', to: 'All Reports by Project', end: 'View / Edit / Delete / PDF' },
    { from: 'Bottom Nav: Settings', to: 'Company Name & Logo', end: 'Download SOP PDF' },
  ]

  for (const flow of flows) {
    if (y < 80) break
    p9.drawRectangle({ x: MARGIN, y: y - 12, width: PAGE_W - MARGIN * 2, height: 20, color: LIGHT_GRAY })
    const flowText = [flow.from, flow.to, flow.end].filter(Boolean).join('  →  ')
    p9.drawText(flowText, { x: MARGIN + 8, y: y - 4, size: 8.5, font, color: BLACK })
    y -= 26
  }

  y -= 16

  y = subHeader(p9, y, 'Tips for Field Use')
  y -= 4
  y = step(p9, y, 1, 'Add the app to your iPhone home screen for one-tap access (see Section 1).', PAGE_W - MARGIN * 2)
  y = step(p9, y, 2, 'Always select the correct project before submitting any form.', PAGE_W - MARGIN * 2)
  y = step(p9, y, 3, 'Take photos before leaving the site — they can be uploaded directly from your camera roll.', PAGE_W - MARGIN * 2)
  y = step(p9, y, 4, 'Download a PDF immediately after submission if you need to share it externally.', PAGE_W - MARGIN * 2)
  y = step(p9, y, 5, 'Use the "Edit" button to correct any mistakes before distributing a PDF.', PAGE_W - MARGIN * 2)
  y -= 10

  p9.drawRectangle({ x: MARGIN, y: y - 44, width: PAGE_W - MARGIN * 2, height: 50, color: rgb(0.95, 0.95, 0.95) })
  p9.drawText('Technical Support', { x: MARGIN + 12, y: y - 10, size: 9, font: bold, color: BLACK })
  p9.drawText('For login issues or technical problems, contact your system administrator.', { x: MARGIN + 12, y: y - 26, size: 8.5, font, color: GRAY })
  p9.drawText('App URL:  app.ironcladks.com', { x: MARGIN + 12, y: y - 40, size: 8.5, font, color: RED })

  // ─── Number pages and draw footers ────────────────────────────────────────
  const total = pages.length
  pages.forEach(({ page }, i) => {
    if (i > 0) drawPageFooter(page, i, total - 1) // cover has no footer
  })

  const pdfBytes = await pdfDoc.save()
  return new Response(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="InspectorGadget-SOP.pdf"'
    }
  })
}
