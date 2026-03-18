import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export const revalidate = 0

export default async function SettingsPage() {
  const { data: settings } = await supabase
    .from('settings')
    .select('*')
    .single()

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '8px',
        padding: '2rem',
        width: '100%',
        maxWidth: '600px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <Link href="/" style={{ color: '#cc3300', textDecoration: 'none', fontSize: '.9rem' }}>
            Back to Home
          </Link>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ color: '#1a1a1a', fontSize: '1.8rem', marginBottom: '.5rem' }}>
            Settings
          </h1>
          <p style={{ color: '#666', fontSize: '.95rem' }}>
            Your company info appears on all reports and PDFs.
          </p>
        </div>

        <form action="/api/settings/update" method="POST">
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '.4rem', color: '#333' }}>
              Company Name
            </label>
            <input
              name="company_name"
              required
              style={inputStyle}
              defaultValue={settings?.company_name || ''}
              placeholder="e.g. Acme Construction LLC"
            />
          </div>
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '.4rem', color: '#333' }}>
              Company Email
            </label>
            <input
              name="company_email"
              type="email"
              style={inputStyle}
              defaultValue={settings?.company_email || ''}
              placeholder="e.g. reports@acmeconstruction.com"
            />
          </div>
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '.4rem', color: '#333' }}>
              Company Phone
            </label>
            <input
              name="company_phone"
              style={inputStyle}
              defaultValue={settings?.company_phone || ''}
              placeholder="e.g. (316) 555-0100"
            />
          </div>
          <button type="submit" style={{
            width: '100%',
            padding: '1rem',
            background: '#cc3300',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '1.1rem',
            fontWeight: '700',
            cursor: 'pointer',
            marginTop: '.5rem'
          }}>
            Save Settings
          </button>
        </form>
      </div>
    </main>
  )
}

const inputStyle = {
  width: '100%',
  padding: '.75rem',
  border: '1px solid #ddd',
  borderRadius: '6px',
  fontSize: '1rem',
  boxSizing: 'border-box'
}
