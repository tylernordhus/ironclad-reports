import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { getUserId } from '@/lib/get-user-id'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function GET(request, { params }) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start')
    const endDate = searchParams.get('end')
    const user_id = await getUserId()

    const { data: project } = await supabase
      .from('projects')
      .select('project_name, location')
      .eq('id', params.projectId)
      .single()

    const { data: reports } = await supabase
      .from('reports')
      .select('report_date, crew_count, work_completed, equipment_used, safety_issues, weather, submitted_by')
      .eq('project_id', params.projectId)
      .eq('user_id', user_id)
      .gte('report_date', startDate)
      .lte('report_date', endDate)
      .order('report_date', { ascending: true })

    if (!reports?.length) {
      return Response.json({ summary: null, reports: [], project_name: project?.project_name })
    }

    const reportText = reports.map(r =>
      `Date: ${r.report_date}\nCrew: ${r.crew_count}\nWeather: ${r.weather || 'N/A'}\nWork Completed: ${r.work_completed}\nEquipment: ${r.equipment_used || 'N/A'}\nSafety/Issues: ${r.safety_issues || 'None'}`
    ).join('\n\n---\n\n')

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: `You are a construction project manager assistant. Based on the following daily field reports, write a concise weekly progress summary suitable for a project status update or owner report. Include: total crew-days on site, key work accomplished, any safety incidents or issues, notable equipment used, and any weather impacts on work. Keep it professional and factual — 3 to 5 short paragraphs.

Project: ${project?.project_name || 'Unknown'}
Week: ${startDate} to ${endDate}

Daily Reports:
${reportText}`,
      }],
    })

    return Response.json({
      summary: message.content[0]?.text?.trim() || null,
      reports,
      project_name: project?.project_name,
    })
  } catch (err) {
    console.error('Weekly summary error:', err)
    return Response.json({ error: 'Failed to generate summary' }, { status: 500 })
  }
}
