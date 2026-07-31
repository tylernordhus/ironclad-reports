import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { getUserId } from '@/lib/get-user-id'
import DeleteButton from '@/app/components/DeleteButton'
import {
  applyAccessScope,
  canManageOrganizationRole,
  getAccessScope,
  getOrganizationMembershipByOrgAndUser,
  getOwnedProjectById,
} from '@/lib/organizations'
import { getQaFormSummary } from '@/lib/qa-forms'
import { getQaFormsAvailability, getQaFormsUnavailableMessage } from '@/lib/supabase-errors'
import {
  getProjectReportTypeForQaForm,
  getProjectReportTypeSettings,
  isProjectReportTypeEnabled,
} from '@/lib/project-report-types'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export const revalidate = 0

export default async function ProjectDetail({ params }) {
  const user_id = await getUserId()
  const accessScope = await getAccessScope(supabase, user_id)

  const { data: project, error } = await getOwnedProjectById(
    supabase,
    user_id,
    params.id,
    accessScope.scopedOrganizationIds,
    '*',
    accessScope.scopedProjectIds,
    { restrictToAssignedProjects: accessScope.restrictToAssignedProjects }
  )

  if (error || !project) {
    return <p style={{ padding: '2rem', color: 'red' }}>Project not found.</p>
  }

  const projectMembership = await getOrganizationMembershipByOrgAndUser(
    supabase,
    project.organization_id,
    user_id
  )
  const canManageProjectAdmin = canManageOrganizationRole(projectMembership)

  const reportTypeSettings = await getProjectReportTypeSettings(supabase, project.id)

  let reportsQuery = supabase
    .from('reports')
    .select('*')
    .eq('project_id', project.id)
    .order('report_date', { ascending: false })
  reportsQuery = applyAccessScope(reportsQuery, user_id, accessScope.scopedOrganizationIds, accessScope.scopedProjectIds, {
    restrictToAssignedProjects: accessScope.restrictToAssignedProjects,
  })
  const { data: reports } = await reportsQuery

  let pourLogsQuery = supabase
    .from('pour_logs')
    .select('*')
    .eq('project_id', project.id)
    .order('log_date', { ascending: false })
  pourLogsQuery = applyAccessScope(pourLogsQuery, user_id, accessScope.scopedOrganizationIds, accessScope.scopedProjectIds, {
    restrictToAssignedProjects: accessScope.restrictToAssignedProjects,
  })
  const { data: pourLogs } = await pourLogsQuery

  let contractorEvalsQuery = supabase
    .from('contractor_evaluations')
    .select('*')
    .eq('project_id', project.id)
    .order('inspection_date', { ascending: false })
  contractorEvalsQuery = applyAccessScope(contractorEvalsQuery, user_id, accessScope.scopedOrganizationIds, accessScope.scopedProjectIds, {
    restrictToAssignedProjects: accessScope.restrictToAssignedProjects,
  })
  const { data: contractorEvals } = await contractorEvalsQuery

  let qaFormsQuery = supabase
    .from('qa_forms')
    .select('*')
    .eq('project_id', project.id)
    .order('work_date', { ascending: false })
  qaFormsQuery = applyAccessScope(qaFormsQuery, user_id, accessScope.scopedOrganizationIds, accessScope.scopedProjectIds, {
    restrictToAssignedProjects: accessScope.restrictToAssignedProjects,
  })
  const { data: qaForms, error: qaFormsError } = await qaFormsQuery

  const qaFormsAvailability = getQaFormsAvailability(qaFormsError)
  const safeQaForms = qaFormsAvailability.available
    ? (qaForms || []).filter(form =>
        isProjectReportTypeEnabled(reportTypeSettings, getProjectReportTypeForQaForm(form.form_type))
      )
    : []
  const qaFormsUnavailableMessage = getQaFormsUnavailableMessage(qaFormsAvailability.reason)
  const showDailyReports = isProjectReportTypeEnabled(reportTypeSettings, 'daily_report')
  const showPourLogs = isProjectReportTypeEnabled(reportTypeSettings, 'pour_log')
  const showContractorEvaluations = isProjectReportTypeEnabled(reportTypeSettings, 'contractor_evaluation')
  const showQaForms = ['qa_009', 'qa_010', 'qa_011', 'qa_013']
    .some(type => isProjectReportTypeEnabled(reportTypeSettings, type))

  return (
    <main style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href="/projects" style={{ color: '#cc3300', textDecoration: 'none', fontSize: '.9rem' }}>
          Back to Projects
        </Link>
      </div>

      <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '2rem' }}>
        <div style={{ background: '#cc3300', padding: '1.5rem 2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 style={{ color: 'white', fontSize: '1.5rem', margin: 0 }}>{project.project_name}</h1>
              <p style={{ color: 'rgba(255,255,255,0.8)', margin: '.4rem 0 0', fontSize: '.9rem' }}>
                {project.location}{project.address ? ' - ' + project.address : ''}
              </p>
            </div>
            <span style={{
              background: 'rgba(255,255,255,0.2)',
              color: 'white',
              padding: '.25rem .75rem',
              borderRadius: '20px',
              fontSize: '.75rem',
              fontWeight: '600',
              textTransform: 'uppercase'
            }}>
              {project.status}
            </span>
          </div>
        </div>

        <div style={{ padding: '1.5rem 2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem' }}>
            <div>
              <div style={{ fontSize: '.75rem', fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '.3rem' }}>
                Owner / Client
              </div>
              <div style={{ fontSize: '1rem', color: '#1a1a1a' }}>{project.client_name}</div>
            </div>
            <div>
              <div style={{ fontSize: '.75rem', fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '.3rem' }}>
                Client Email
              </div>
              <div style={{ fontSize: '1rem', color: '#1a1a1a' }}>{project.client_email}</div>
            </div>
            {project.start_date && (
              <div>
                <div style={{ fontSize: '.75rem', fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '.3rem' }}>
                  Start Date
                </div>
                <div style={{ fontSize: '1rem', color: '#1a1a1a' }}>{project.start_date}</div>
              </div>
            )}
            {project.notes && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: '.75rem', fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '.3rem' }}>
                  Notes
                </div>
                <div style={{ fontSize: '1rem', color: '#1a1a1a', lineHeight: '1.6' }}>{project.notes}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        {showDailyReports ? <Link href={'/daily-report?project_id=' + project.id + '&project_name=' + encodeURIComponent(project.project_name)} style={{
          flex: 1,
          minWidth: '140px',
          padding: '.8rem 1rem',
          background: '#cc3300',
          color: 'white',
          borderRadius: '6px',
          textDecoration: 'none',
          fontWeight: '600',
          fontSize: '.9rem',
          textAlign: 'center'
        }}>
          + Daily Report
        </Link> : null}
        {showDailyReports ? <Link href={'/daily-report?project_id=' + project.id + '&project_name=' + encodeURIComponent(project.project_name) + '&mode=quick'} style={{
          flex: 1,
          minWidth: '140px',
          padding: '.8rem 1rem',
          background: '#fff4ef',
          color: '#cc3300',
          border: '1px solid #f1c8ba',
          borderRadius: '6px',
          textDecoration: 'none',
          fontWeight: '700',
          fontSize: '.9rem',
          textAlign: 'center'
        }}>
          Quick Submit
        </Link> : null}
        {showPourLogs ? <Link href={'/pour-log-select?project_id=' + project.id + '&project_name=' + encodeURIComponent(project.project_name)} style={{
          flex: 1,
          minWidth: '140px',
          padding: '.8rem 1rem',
          background: '#1a1a1a',
          color: 'white',
          borderRadius: '6px',
          textDecoration: 'none',
          fontWeight: '600',
          fontSize: '.9rem',
          textAlign: 'center'
        }}>
          + Pour Log
        </Link> : null}
        {showContractorEvaluations ? <Link href={'/contractor-eval?project_id=' + project.id + '&project_name=' + encodeURIComponent(project.project_name)} style={{
          flex: 1,
          minWidth: '140px',
          padding: '.8rem 1rem',
          background: '#2a7a2a',
          color: 'white',
          borderRadius: '6px',
          textDecoration: 'none',
          fontWeight: '600',
          fontSize: '.9rem',
          textAlign: 'center'
        }}>
          + Contractor Eval
        </Link> : null}
        {showQaForms ? <Link href={'/qa-form-select?project_id=' + project.id + '&project_name=' + encodeURIComponent(project.project_name)} style={{
          flex: 1,
          minWidth: '140px',
          padding: '.8rem 1rem',
          background: '#24506d',
          color: 'white',
          borderRadius: '6px',
          textDecoration: 'none',
          fontWeight: '600',
          fontSize: '.9rem',
          textAlign: 'center'
        }}>
          + QA Form
        </Link> : null}
        <Link href={'/projects/' + project.id + '/weekly-summary'} style={{
          flex: 1,
          minWidth: '140px',
          padding: '.8rem 1rem',
          background: '#1a4a7a',
          color: 'white',
          borderRadius: '6px',
          textDecoration: 'none',
          fontWeight: '600',
          fontSize: '.9rem',
          textAlign: 'center'
        }}>
          Weekly Summary
        </Link>
        <Link href={'/projects/' + project.id + '/photos'} style={{
          flex: 1,
          minWidth: '140px',
          padding: '.8rem 1rem',
          background: '#f4f7fb',
          color: '#24506d',
          border: '1px solid #ccd8e2',
          borderRadius: '6px',
          textDecoration: 'none',
          fontWeight: '700',
          fontSize: '.9rem',
          textAlign: 'center'
        }}>
          Project Photos
        </Link>
        {canManageProjectAdmin ? (
          <Link href={'/projects/' + project.id + '/edit'} style={{
            flex: 1,
            minWidth: '140px',
            padding: '.8rem 1rem',
            background: 'white',
            color: '#1a1a1a',
            border: '2px solid #e5e5e5',
            borderRadius: '6px',
            textDecoration: 'none',
            fontWeight: '600',
            fontSize: '.9rem',
            textAlign: 'center'
          }}>
            Edit Project
          </Link>
        ) : null}
        {canManageProjectAdmin ? (
          <DeleteButton
            action={`/api/delete/project/${project.id}`}
            label="Delete Project"
            redirectTo="/projects"
            style={{
              flex: 1,
              minWidth: '140px',
              padding: '.8rem 1rem',
              background: 'white',
              color: '#cc3300',
              border: '2px solid #cc3300',
              borderRadius: '6px',
              fontWeight: '600',
              fontSize: '.9rem',
              textAlign: 'center'
            }}
          />
        ) : null}
      </div>

      {showDailyReports ? <h2 style={{ fontSize: '1.2rem', color: '#1a1a1a', marginBottom: '1rem' }}>Daily Reports</h2> : null}

      {showDailyReports && (!reports || reports.length === 0) && (
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: '2rem',
          textAlign: 'center',
          color: '#666',
          marginBottom: '1rem'
        }}>
          No daily reports yet for this project.
        </div>
      )}

      {showDailyReports ? <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
        {reports && reports.map((report) => (
          <Link key={report.id} href={'/reports/' + report.id} style={{ textDecoration: 'none' }}>
            <div style={{
              background: 'white',
              border: '1px solid #e5e5e5',
              borderRadius: '8px',
              padding: '1.2rem 1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontWeight: '700', color: '#1a1a1a', fontSize: '1rem', marginBottom: '.25rem' }}>
                  {report.report_date}
                </div>
                <div style={{ color: '#666', fontSize: '.85rem' }}>
                  {report.submitted_by} - {report.crew_count} crew
                </div>
              </div>
              <div style={{ color: '#cc3300', fontSize: '1.2rem' }}>→</div>
            </div>
          </Link>
        ))}
      </div> : null}

      {showPourLogs ? <h2 style={{ fontSize: '1.2rem', color: '#1a1a1a', marginBottom: '1rem' }}>Pour Logs</h2> : null}

      {showPourLogs && (!pourLogs || pourLogs.length === 0) && (
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: '2rem',
          textAlign: 'center',
          color: '#666',
          marginBottom: '1rem'
        }}>
          No pour logs yet for this project.
        </div>
      )}

      {showPourLogs ? <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
        {pourLogs && pourLogs.map((log) => (
          <Link key={log.id} href={'/pour-logs/' + log.id} style={{ textDecoration: 'none' }}>
            <div style={{
              background: 'white',
              border: '1px solid #e5e5e5',
              borderRadius: '8px',
              padding: '1.2rem 1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontWeight: '700', color: '#1a1a1a', fontSize: '1rem', marginBottom: '.25rem' }}>
                  {log.log_date}
                </div>
                <div style={{ color: '#666', fontSize: '.85rem' }}>
                  {log.log_type === 'flatwork' ? 'Flatwork' : 'Drilled Shaft'} - {log.submitted_by}
                </div>
              </div>
              <div style={{ color: '#1a1a1a', fontSize: '1.2rem' }}>→</div>
            </div>
          </Link>
        ))}
      </div> : null}

      {showContractorEvaluations ? <h2 style={{ fontSize: '1.2rem', color: '#1a1a1a', marginBottom: '1rem' }}>Contractor Evaluations</h2> : null}

      {showContractorEvaluations && (!contractorEvals || contractorEvals.length === 0) && (
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: '2rem',
          textAlign: 'center',
          color: '#666',
          marginBottom: '1rem'
        }}>
          No contractor evaluations yet for this project.
        </div>
      )}

      {showContractorEvaluations ? <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
        {contractorEvals && contractorEvals.map((ev) => (
          <Link key={ev.id} href={'/contractor-evals/' + ev.id} style={{ textDecoration: 'none' }}>
            <div style={{
              background: 'white',
              border: '1px solid #e5e5e5',
              borderRadius: '8px',
              padding: '1.2rem 1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontWeight: '700', color: '#1a1a1a', fontSize: '1rem', marginBottom: '.25rem' }}>
                  {ev.inspection_date}
                </div>
                <div style={{ color: '#666', fontSize: '.85rem' }}>
                  {ev.contractor_name || ev.inspector_name || '-'}{ev.overall_rating ? ' · ' + ev.overall_rating : ''}
                </div>
              </div>
              <div style={{ color: '#2a7a2a', fontSize: '1.2rem' }}>→</div>
            </div>
          </Link>
        ))}
      </div> : null}

      {showQaForms ? <h2 style={{ fontSize: '1.2rem', color: '#1a1a1a', marginBottom: '1rem' }}>QA Forms</h2> : null}

      {showQaForms && !qaFormsAvailability.available && qaFormsUnavailableMessage && (
        <div style={{
          background: '#fff7e8',
          border: '1px solid #f2d08a',
          borderRadius: '8px',
          padding: '1rem 1.25rem',
          color: '#7a5a12',
          marginBottom: '1rem'
        }}>
          {qaFormsUnavailableMessage}
        </div>
      )}

      {showQaForms && qaFormsAvailability.available && safeQaForms.length === 0 && (
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: '2rem',
          textAlign: 'center',
          color: '#666',
          marginBottom: '1rem'
        }}>
          No QA forms yet for this project.
        </div>
      )}

      {showQaForms ? <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
        {safeQaForms.map((form) => {
          const summary = getQaFormSummary(form)
          return (
            <Link key={form.id} href={'/qa-forms/' + form.id} style={{ textDecoration: 'none' }}>
              <div style={{
                background: 'white',
                border: '1px solid #e5e5e5',
                borderRadius: '8px',
                padding: '1.2rem 1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontWeight: '700', color: '#1a1a1a', fontSize: '1rem', marginBottom: '.25rem' }}>
                    {form.work_date || '-'}
                  </div>
                  <div style={{ color: '#666', fontSize: '.85rem' }}>
                    {summary.code} · {summary.shortLabel} · {form.submitted_by || '-'}
                  </div>
                </div>
                <div style={{ color: '#24506d', fontSize: '1.2rem' }}>→</div>
              </div>
            </Link>
          )
        })}
      </div> : null}
    </main>
  )
}
