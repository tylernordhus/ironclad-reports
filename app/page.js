import { createClient as createSupabase } from '@supabase/supabase-js'
import { createClient as createAuthClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const supabase = createSupabase(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export const revalidate = 0

export default async function Home() {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) redirect('/login')

  const { data: settings } = await supabase
    .from('settings')
    .select('company_name')
    .single()

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
          <h1 style={{ color: '#1a1a1a', fontSize: '2.2rem', marginBottom: '.5rem', fontWeight: '800' }}>
            Field Reports
          </h1>
          <p style={{ color: '#666', fontSize: '1rem' }}>
            {companyName}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Link href="/projects" style={{ textDecoration: 'none' }}>
            <div style={{ background: '#cc3300', borderRadius: '10px', padding: '2rem', color: 'white', cursor: 'pointer' }}>
              <div style={{ fontSize: '2rem', marginBottom: '.5rem' }}>📁</div>
              <div style={{ fontSize: '1.3rem', fontWeight: '700', marginBottom: '.4rem' }}>Projects</div>
              <div style={{ fontSize: '.9rem', opacity: .85 }}>Manage projects and submit reports by project</div>
            </div>
          </Link>

          <Link href="/daily-report" style={{ textDecoration: 'none' }}>
            <div style={{ background: '#1a1a1a', borderRadius: '10px', padding: '2rem', color: 'white', cursor: 'pointer' }}>
              <div style={{ fontSize: '2rem', marginBottom: '.5rem' }}>📋</div>
              <div style={{ fontSize: '1.3rem', fontWeight: '700', marginBottom: '.4rem' }}>Daily Report</div>
              <div style={{ fontSize: '.9rem', opacity: .85 }}>Submit a daily crew, work, and safety report</div>
            </div>
          </Link>

          <Link href="/pour-log" style={{ textDecoration: 'none' }}>
            <div style={{ background: '#1a1a1a', borderRadius: '10px', padding: '2rem', color: 'white', cursor: 'pointer' }}>
              <div style={{ fontSize: '2rem', marginBottom: '.5rem' }}>🪣</div>
              <div style={{ fontSize: '1.3rem', fontWeight: '700', marginBottom: '.4rem' }}>Pour Log</div>
              <div style={{ fontSize: '.9rem', opacity: .85 }}>Record concrete pour details and placement</div>
            </div>
          </Link>

          <Link href="/reports" style={{ textDecoration: 'none' }}>
            <div style={{ background: 'white', border: '2px solid #e5e5e5', borderRadius: '10px', padding: '2rem', color: '#1a1a1a', cursor: 'pointer' }}>
              <div style={{ fontSize: '2rem', marginBottom: '.5rem' }}>📂</div>
              <div style={{ fontSize: '1.3rem', fontWeight: '700', marginBottom: '.4rem' }}>View All Reports</div>
              <div style={{ fontSize: '.9rem', color: '#666' }}>Browse and manage all submitted reports</div>
            </div>
          </Link>

          <Link href="/settings" style={{ textDecoration: 'none' }}>
            <div style={{ background: 'white', border: '2px solid #e5e5e5', borderRadius: '10px', padding: '1.5rem 2rem', color: '#1a1a1a', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ fontSize: '1.5rem' }}>⚙️</div>
              <div>
                <div style={{ fontSize: '1rem', fontWeight: '700' }}>Settings</div>
                <div style={{ fontSize: '.85rem', color: '#666' }}>Company name, email, phone</div>
              </div>
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
