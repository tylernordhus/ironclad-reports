import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export const revalidate = 0

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const [year, month, day] = dateStr.split('-')
  return month + '-' + day + '-' + year
}

export default async function ReportsPage() {
  const [
    { data: projects },
    { data: reports },
    { data: pourLogs }
  ] = await Promise.all([
    supabase.from('projects').select('*').order('project_name', { ascending: true }),
    supabase.from('reports').select('*').order('report_date', { ascending: false }),
    supabase.from('pour_logs').select('*').order('log_date', { ascending: false })
  ])

  // Group by project_id
  const reportsByProject = {}
  const pourLogsByProject = {}

  for (const r of reports || []) {
    const key = r.project_id || 'unassigned'
    if (!reportsByProject[key]) reportsByProject[key] = []
    reportsByProject[key].push(r)
  }

  for (const p of pourLogs || []) {
    const key = p.project_id || 'unassigned'
    if (!pourLogsByProject[key]) pourLogsByProject[key] = []
    pourLogsByProject[key].push(p)
  }

  const projectList = projects || []
  const allProjectIds = new Set([
    ...projectList.map(p => p.id),
    ...Object.keys(reportsByProject),
    ...Object.keys(pourLogsByProject)
  ])

  const sections = []
  for (const pid of allProjectIds) {
    if (pid === 'unassigned') continue
    const project = projectList.find(p => p.id === pid)
    sections.push({
      id: pid,
      name: project?.project_name || 'Unknown Project',
      reports: reportsByProject[pid] || [],
      pourLogs: pourLogsByProject[pid] || []
    })
  }
  sections.sort((a, b) => a.name.localeCompare(b.name))

  const unassignedReports = reportsByProject['unassigned'] || []
  const unassignedPourLogs = pourLogsByProject['unassigned'] || []
  const hasUnassigned = unassignedReports.length > 0 || unassignedPourLogs.length > 0

  return (
    <main style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href="/" style={{ color: '#cc3300', textDecoration: 'none', fontSize: '.9rem' }}>
          ← Back to Home
        </Link>
      </div>

      <h1 style={{ fontSize: '1.8rem', color: '#1a1a1a', marginBottom: '2rem' }}>All Reports</h1>

      {sections.length === 0 && !hasUnassigned && (
        <p style={{ color: '#666' }}>No reports submitted yet.</p>
      )}

      {sections.map(section => (
        <div key={section.id} style={{ marginBottom: '2.5rem' }}>
          <div style={{
            background: '#1a1a1a',
            color: 'white',
            padding: '1rem 1.5rem',
            borderRadius: '8px 8px 0 0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ fontWeight: '700', fontSize: '1.1rem' }}>{section.name}</span>
            <Link href={`/projects/${section.id}`} style={{ color: 'rgba(255,255,255,0.7)', fontSize: '.8rem', textDecoration: 'none' }}>
              View Project →
            </Link>
          </div>

          <div style={{ border: '1px solid #e5e5e5', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
            {section.reports.length === 0 && section.pourLogs.length === 0 && (
              <div style={{ padding: '1rem 1.5rem', color: '#999', fontSize: '.9rem' }}>No reports yet.</div>
            )}

            {section.reports.map((r, i) => (
              <ReportRow key={r.id} report={r} type="daily" isLast={i === section.reports.length - 1 && section.pourLogs.length === 0} />
            ))}

            {section.pourLogs.map((p, i) => (
              <PourLogRow key={p.id} log={p} isLast={i === section.pourLogs.length - 1} />
            ))}
          </div>
        </div>
      ))}

      {hasUnassigned && (
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{ background: '#666', color: 'white', padding: '1rem 1.5rem', borderRadius: '8px 8px 0 0' }}>
            <span style={{ fontWeight: '700', fontSize: '1.1rem' }}>No Project Assigned</span>
          </div>
          <div style={{ border: '1px solid #e5e5e5', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
            {unassignedReports.map((r, i) => (
              <ReportRow key={r.id} report={r} type="daily" isLast={i === unassignedReports.length - 1 && unassignedPourLogs.length === 0} />
            ))}
            {unassignedPourLogs.map((p, i) => (
              <PourLogRow key={p.id} log={p} isLast={i === unassignedPourLogs.length - 1} />
            ))}
          </div>
        </div>
      )}
    </main>
  )
}

function ReportRow({ report, isLast }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '1rem 1.5rem',
      background: 'white',
      borderBottom: isLast ? 'none' : '1px solid #f0f0f0'
    }}>
      <Link href={`/reports/${report.id}`} style={{ textDecoration: 'none', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{
            background: '#fff3f0',
            color: '#cc3300',
            fontSize: '.7rem',
            fontWeight: '700',
            padding: '.2rem .5rem',
            borderRadius: '4px',
            whiteSpace: 'nowrap'
          }}>
            DAILY
          </span>
          <div>
            <div style={{ fontWeight: '600', color: '#1a1a1a', fontSize: '.95rem' }}>
              {formatDate(report.report_date)}
            </div>
            <div style={{ color: '#888', fontSize: '.8rem' }}>
              {report.submitted_by} · {report.crew_count} crew
            </div>
          </div>
        </div>
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Link href={`/reports/${report.id}`} style={{ color: '#cc3300', fontSize: '.85rem', textDecoration: 'none', fontWeight: '600' }}>View</Link>
        <form action={`/api/delete/report/${report.id}`} method="POST" onSubmit="return confirm('Delete this report?')">
          <button type="submit" style={{ background: 'none', border: 'none', color: '#ccc', fontSize: '.85rem', cursor: 'pointer', padding: 0 }}>
            Delete
          </button>
        </form>
      </div>
    </div>
  )
}

function PourLogRow({ log, isLast }) {
  const label = log.log_type === 'flatwork' ? 'FLATWORK' : 'POUR LOG'
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '1rem 1.5rem',
      background: 'white',
      borderBottom: isLast ? 'none' : '1px solid #f0f0f0'
    }}>
      <Link href={`/pour-logs/${log.id}`} style={{ textDecoration: 'none', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{
            background: '#f0f4ff',
            color: '#1a4acc',
            fontSize: '.7rem',
            fontWeight: '700',
            padding: '.2rem .5rem',
            borderRadius: '4px',
            whiteSpace: 'nowrap'
          }}>
            {label}
          </span>
          <div>
            <div style={{ fontWeight: '600', color: '#1a1a1a', fontSize: '.95rem' }}>
              {formatDate(log.log_date)}
            </div>
            <div style={{ color: '#888', fontSize: '.8rem' }}>
              {log.submitted_by}
            </div>
          </div>
        </div>
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Link href={`/pour-logs/${log.id}`} style={{ color: '#1a4acc', fontSize: '.85rem', textDecoration: 'none', fontWeight: '600' }}>View</Link>
        <form action={`/api/delete/pour-log/${log.id}`} method="POST">
          <button type="submit" style={{ background: 'none', border: 'none', color: '#ccc', fontSize: '.85rem', cursor: 'pointer', padding: 0 }}>
            Delete
          </button>
        </form>
      </div>
    </div>
  )
}
