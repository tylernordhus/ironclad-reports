import { createClient as createSupabase } from '@supabase/supabase-js'
import { createClient as createAuthClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { applyAccessScope, getAccessScope } from '@/lib/organizations'
import { SHOW_SUBMISSION_DASHBOARD } from '@/lib/feature-flags'
import { getSubmissionDashboardData } from '@/lib/submission-dashboard'

const supabase = createSupabase(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export const revalidate = 0

export default async function Home() {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) redirect('/login')

  const accessScope = await getAccessScope(supabase, user.id)

  const [settingsResult, projectsResult] = await Promise.all([
    supabase
      .from('settings')
      .select('company_name, logo_url')
      .single(),
    applyAccessScope(
      supabase
        .from('projects')
        .select('id, project_name, location, client_name, status')
        .order('project_name', { ascending: true }),
      user.id,
      accessScope.scopedOrganizationIds,
      accessScope.scopedProjectIds,
      {
        projectIdColumn: 'id',
        restrictToAssignedProjects: accessScope.restrictToAssignedProjects,
      }
    ),
  ])

  const settings = settingsResult.data
  const projects = projectsResult.data || []
  const dashboard = SHOW_SUBMISSION_DASHBOARD
    ? await getSubmissionDashboardData(
        supabase,
        user.id,
        accessScope.scopedOrganizationIds,
        projects,
        accessScope.scopedProjectIds,
        accessScope.restrictToAssignedProjects
      )
    : null

  const companyName = settings?.company_name || 'Your Company'

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      background: '#f5f5f5'
    }}>
      <div style={{ width: '100%', maxWidth: '600px' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          {settings?.logo_url && (
            <img src={settings.logo_url} alt="Company logo" style={{ maxHeight: '70px', maxWidth: '200px', objectFit: 'contain', marginBottom: '1rem' }} />
          )}
          <h1 style={{ color: '#1a1a1a', fontSize: '2.2rem', marginBottom: '.5rem', fontWeight: '800' }}>
            Field Reports
          </h1>
          <p style={{ color: '#666', fontSize: '1rem' }}>
            {companyName}
          </p>
        </div>

        {SHOW_SUBMISSION_DASHBOARD && dashboard ? (
          <div style={{ background: 'white', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '.9rem' }}>
              <div>
                <div style={{ fontSize: '.78rem', fontWeight: '800', color: '#8a4a00', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '.25rem' }}>
                  Submission Status
                </div>
                <div style={{ fontSize: '1.2rem', color: '#1a1a1a', fontWeight: '800' }}>
                  Today&apos;s Daily Report Dashboard
                </div>
                <div style={{ fontSize: '.9rem', color: '#666', marginTop: '.2rem' }}>
                  Green means submitted. Red means missing for today.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
                <div style={{ background: '#e6f4ea', color: '#2d7a3a', padding: '.5rem .8rem', borderRadius: '999px', fontSize: '.82rem', fontWeight: '700' }}>
                  {dashboard.todaySummary.submitted} Submitted
                </div>
                <div style={{ background: '#fff0ee', color: '#b42318', padding: '.5rem .8rem', borderRadius: '999px', fontSize: '.82rem', fontWeight: '700' }}>
                  {dashboard.todaySummary.missing} Missing
                </div>
              </div>
            </div>

            {dashboard.rows.length === 0 ? (
              <div style={{ color: '#777', fontSize: '.92rem' }}>
                No daily-report-enabled projects to track right now.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: '620px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: `minmax(220px, 2fr) repeat(${dashboard.dates.length}, minmax(46px, 1fr))`, gap: '.55rem', alignItems: 'center', marginBottom: '.75rem' }}>
                    <div style={{ fontSize: '.75rem', fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                      Project
                    </div>
                    {dashboard.dates.map((date, index) => (
                      <div key={date} style={{ textAlign: 'center', fontSize: '.72rem', fontWeight: index === dashboard.dates.length - 1 ? '800' : '700', color: index === dashboard.dates.length - 1 ? '#1a1a1a' : '#888' }}>
                        {date.slice(5)}
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '.65rem' }}>
                    {dashboard.rows.map(row => (
                      <Link key={row.project.id} href={`/projects/${row.project.id}`} style={{ textDecoration: 'none' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: `minmax(220px, 2fr) repeat(${dashboard.dates.length}, minmax(46px, 1fr))`, gap: '.55rem', alignItems: 'center', padding: '.85rem', background: '#faf8f5', borderRadius: '10px', border: '1px solid #eee5da' }}>
                          <div>
                            <div style={{ color: '#1a1a1a', fontWeight: '700', fontSize: '.95rem', marginBottom: '.15rem' }}>{row.project.project_name}</div>
                            <div style={{ color: '#777', fontSize: '.78rem' }}>
                              {[row.project.location, row.project.client_name ? `Owner/Client: ${row.project.client_name}` : null].filter(Boolean).join(' · ')}
                            </div>
                          </div>
                          {row.statuses.map((entry, index) => (
                            <div key={entry.date} style={{ display: 'flex', justifyContent: 'center' }}>
                              <span style={{
                                width: '18px',
                                height: '18px',
                                borderRadius: '999px',
                                display: 'inline-block',
                                background: entry.status === 'submitted' ? '#2d7a3a' : entry.status === 'inactive' ? '#cfc7be' : '#cc3300',
                                boxShadow: index === row.statuses.length - 1 ? '0 0 0 3px rgba(204,51,0,0.12)' : 'none',
                              }} />
                            </div>
                          ))}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {dashboard.hiddenProjectCount > 0 ? (
              <div style={{ marginTop: '.85rem', color: '#888', fontSize: '.8rem' }}>
                {dashboard.hiddenProjectCount} project{dashboard.hiddenProjectCount === 1 ? '' : 's'} hidden because daily reports are disabled for them.
              </div>
            ) : null}
          </div>
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Link href="/projects" style={{ textDecoration: 'none' }}>
            <div style={{ background: '#cc3300', borderRadius: '10px', padding: '2rem', color: 'white', cursor: 'pointer' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: '700', marginBottom: '.4rem' }}>Projects</div>
              <div style={{ fontSize: '.9rem', opacity: .85 }}>Manage projects and submit reports by project</div>
            </div>
          </Link>

          <Link href="/select-project?for=daily-report" style={{ textDecoration: 'none' }}>
            <div style={{ background: '#1a1a1a', borderRadius: '10px', padding: '2rem', color: 'white', cursor: 'pointer' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: '700', marginBottom: '.4rem' }}>Daily Report</div>
              <div style={{ fontSize: '.9rem', opacity: .85 }}>Submit a daily crew, work, and safety report</div>
            </div>
          </Link>

          <Link href="/select-project?for=pour-log" style={{ textDecoration: 'none' }}>
            <div style={{ background: '#1a1a1a', borderRadius: '10px', padding: '2rem', color: 'white', cursor: 'pointer' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: '700', marginBottom: '.4rem' }}>Pour Log</div>
              <div style={{ fontSize: '.9rem', opacity: .85 }}>Record concrete pour details and placement</div>
            </div>
          </Link>

          <Link href="/select-project?for=contractor-eval" style={{ textDecoration: 'none' }}>
            <div style={{ background: '#1a1a1a', borderRadius: '10px', padding: '2rem', color: 'white', cursor: 'pointer' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: '700', marginBottom: '.4rem' }}>Contractor Evaluation</div>
              <div style={{ fontSize: '.9rem', opacity: .85 }}>Evaluate contractor safety, quality, and compliance</div>
            </div>
          </Link>


          <form action="/api/auth/logout" method="POST">
            <button type="submit" style={{
              width: '100%',
              padding: '1rem',
              background: 'transparent',
              border: 'none',
              color: '#999',
              fontSize: '.9rem',
              cursor: 'pointer'
            }}>
              Sign Out
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
