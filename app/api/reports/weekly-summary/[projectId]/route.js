import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { getUserId } from '@/lib/get-user-id'
import { recordAuditEvent } from '@/lib/audit-log'
import { getAccessScope, getOwnedProjectById } from '@/lib/organizations'
import { getWeeklyReportRecord, getWeeklySourceReports } from '@/lib/weekly-reports'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function buildAiSummary(projectName, startDate, endDate, reports) {
  if (!reports?.length) return ''

  const reportText = reports.map(report => {
    let line = `Date: ${report.report_date}\nCrew: ${report.crew_count}\nWeather: ${report.weather || 'N/A'}\nWork Completed: ${report.work_completed}\nEquipment: ${report.equipment_used || 'N/A'}\nSafety/Issues: ${report.safety_issues || 'None'}`
    if (report.weather_delay) line += `\nWeather Delay: ${report.weather_delay_hours ? report.weather_delay_hours + ' hrs' : 'Yes'}`
    if (report.on_schedule === false) line += '\nSchedule: Behind Schedule'
    return line
  }).join('\n\n---\n\n')

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: `You are a construction project manager assistant. Based on the following daily field reports, write a concise weekly progress summary suitable for a project status update or owner report. Include: total crew-days on site, key work accomplished, any safety incidents or issues, notable equipment used, and any weather impacts on work. Keep it professional and factual — 3 to 5 short paragraphs.

Project: ${projectName || 'Unknown'}
Week: ${startDate} to ${endDate}

Daily Reports:
${reportText}`,
    }],
  })

  return message.content[0]?.text?.trim() || ''
}

export async function GET(request, { params }) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start')
    const endDate = searchParams.get('end')
    const mode = searchParams.get('mode')
    const userId = await getUserId()
    const accessScope = await getAccessScope(supabase, userId)

    if (!startDate || !endDate) {
      return Response.json({ error: 'Start and end dates are required.' }, { status: 400 })
    }

    const { data: project } = await getOwnedProjectById(
      supabase,
      userId,
      params.projectId,
      accessScope.scopedOrganizationIds,
      'id, project_name, location, organization_id',
      accessScope.scopedProjectIds,
      { restrictToAssignedProjects: accessScope.restrictToAssignedProjects }
    )
    if (!project) {
      return Response.json({ error: 'Project not found.' }, { status: 404 })
    }

    const [weeklyReport, reports] = await Promise.all([
      getWeeklyReportRecord(
        supabase,
        project.id,
        userId,
        accessScope.scopedOrganizationIds,
        startDate,
        endDate,
        accessScope.scopedProjectIds,
        accessScope.restrictToAssignedProjects
      ),
      getWeeklySourceReports(
        supabase,
        project.id,
        userId,
        accessScope.scopedOrganizationIds,
        startDate,
        endDate,
        accessScope.scopedProjectIds,
        accessScope.restrictToAssignedProjects
      ),
    ])

    if (mode === 'generate') {
      const generatedSummary = await buildAiSummary(project.project_name, startDate, endDate, reports)
      return Response.json({
        weekly_report: weeklyReport,
        summary: generatedSummary,
        reports,
        project_name: project.project_name,
        source: reports.length ? 'generated' : 'blank',
      })
    }

    return Response.json({
      weekly_report: weeklyReport,
      summary: weeklyReport?.summary || '',
      reports,
      project_name: project.project_name,
      source: weeklyReport ? 'saved' : 'blank',
    })
  } catch (err) {
    console.error('Weekly summary error:', err)
    return Response.json({ error: 'Failed to load weekly summary' }, { status: 500 })
  }
}

export async function POST(request, { params }) {
  try {
    const { startDate, endDate, summary, generatedFromDailyReports } = await request.json()
    const userId = await getUserId()
    const accessScope = await getAccessScope(supabase, userId)

    if (!startDate || !endDate) {
      return Response.json({ error: 'Start and end dates are required.' }, { status: 400 })
    }

    const { data: project } = await getOwnedProjectById(
      supabase,
      userId,
      params.projectId,
      accessScope.scopedOrganizationIds,
      'id, project_name, organization_id',
      accessScope.scopedProjectIds,
      { restrictToAssignedProjects: accessScope.restrictToAssignedProjects }
    )
    if (!project) {
      return Response.json({ error: 'Project not found.' }, { status: 404 })
    }

    const reports = await getWeeklySourceReports(
      supabase,
      project.id,
      userId,
      accessScope.scopedOrganizationIds,
      startDate,
      endDate,
      accessScope.scopedProjectIds,
      accessScope.restrictToAssignedProjects
    )
    const payload = {
      project_id: project.id,
      organization_id: project.organization_id || null,
      user_id: userId,
      week_start: startDate,
      week_end: endDate,
      summary: String(summary || ''),
      submitted_by: userId,
      report_count: reports.length,
      generated_from_daily_reports: Boolean(generatedFromDailyReports),
    }

    const { data, error } = await supabase
      .from('weekly_reports')
      .upsert(payload, { onConflict: 'project_id,week_start,week_end' })
      .select('*')
      .single()

    if (error) throw error

    await recordAuditEvent(supabase, {
      organizationId: project.organization_id,
      actorUserId: userId,
      entityType: 'project',
      entityId: project.id,
      action: 'weekly_report_saved',
      metadata: {
        weekly_report_id: data.id,
        week_start: startDate,
        week_end: endDate,
        generated_from_daily_reports: Boolean(generatedFromDailyReports),
        report_count: reports.length,
      },
    })

    return Response.json({
      weekly_report: data,
      reports,
      project_name: project.project_name,
      summary: data.summary,
      source: 'saved',
    })
  } catch (err) {
    console.error('Weekly summary save error:', err)
    return Response.json({ error: 'Failed to save weekly report.' }, { status: 500 })
  }
}
