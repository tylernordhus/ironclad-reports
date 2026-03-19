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
            ← Back to Home
          </Link>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ color: '#1a1a1a', fontSize: '1.8rem', marginBottom: '.5rem' }}>Settings</h1>
          <p style={{ color: '#666', fontSize: '.95rem' }}>
            Your company info appears on all reports and PDFs.
          </p>
        </div>

        {settings?.logo_url && (
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <p style={{ fontSize: '.8rem', color: '#999', marginBottom: '.5rem' }}>Current Logo</p>
            <img src={settings.logo_url} alt="Company logo" style={{ maxHeight: '80px', maxWidth: '240px', objectFit: 'contain' }} />
          </div>
        )}

        <form action="/api/settings/update" method="POST" encType="multipart/form-data">
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={labelStyle}>Company Name</label>
            <input name="company_name" required style={inputStyle} defaultValue={settings?.company_name || ''} placeholder="e.g. Acme Construction LLC" />
          </div>
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={labelStyle}>Company Email</label>
            <input name="company_email" type="email" style={inputStyle} defaultValue={settings?.company_email || ''} placeholder="e.g. reports@acmeconstruction.com" />
          </div>
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={labelStyle}>Company Phone</label>
            <input name="company_phone" style={inputStyle} defaultValue={settings?.company_phone || ''} placeholder="e.g. (316) 555-0100" />
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={labelStyle}>
              Company Logo <span style={{ fontWeight: '400', color: '#888', fontSize: '.85rem' }}>(optional — shows on pages and PDFs)</span>
            </label>
            <input name="logo" type="file" accept="image/*" style={{ ...inputStyle, padding: '.5rem', cursor: 'pointer' }} />
          </div>
          <button type="submit" style={{
            width: '100%', padding: '1rem',
            background: '#cc3300', color: 'white',
            border: 'none', borderRadius: '6px',
            fontSize: '1.1rem', fontWeight: '700', cursor: 'pointer'
          }}>
            Save Settings
          </button>
        </form>

        <div id="screenshots" style={{ marginTop: '2.5rem', paddingTop: '2rem', borderTop: '2px solid #f0f0f0' }}>
          <h2 style={{ fontSize: '1.2rem', color: '#1a1a1a', marginBottom: '.4rem' }}>SOP Screenshots</h2>
          <p style={{ color: '#666', fontSize: '.85rem', marginBottom: '1.5rem' }}>
            Upload a screenshot for each section of the SOP PDF. Take a screenshot on your phone or computer, then upload it here. Once uploaded it will appear in the PDF automatically.
          </p>

          {[
            { slot: 'login', label: 'Login Screen', hint: 'Screenshot of the Inspector Gadget login page' },
            { slot: 'home', label: 'Home Screen', hint: 'Screenshot of the main home screen with all cards' },
            { slot: 'projects', label: 'Projects List', hint: 'Screenshot of the projects list page' },
            { slot: 'daily-report', label: 'Daily Report Form', hint: 'Screenshot of the daily report form' },
            { slot: 'pour-log', label: 'Pour Log Form', hint: 'Screenshot of the pour log form' },
            { slot: 'reports', label: 'All Reports Page', hint: 'Screenshot of the view all reports page' },
          ].map(({ slot, label, hint }) => {
            const url = supabase.storage.from('report-photos').getPublicUrl(`sop-screenshots/${slot}.jpg`).data.publicUrl
            return (
              <div key={slot} style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid #e5e5e5', borderRadius: '8px' }}>
                <div style={{ fontWeight: '600', fontSize: '.95rem', color: '#1a1a1a', marginBottom: '.2rem' }}>{label}</div>
                <div style={{ color: '#888', fontSize: '.8rem', marginBottom: '.75rem' }}>{hint}</div>
                <ScreenshotPreview url={url} />
                <form action="/api/sop-screenshots/upload" method="POST" encType="multipart/form-data" style={{ marginTop: '.75rem', display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input type="hidden" name="slot" value={slot} />
                  <input type="file" name="file" accept="image/*" required style={{ flex: 1, fontSize: '.85rem' }} />
                  <button type="submit" style={{ padding: '.5rem 1rem', background: '#1a1a1a', color: 'white', border: 'none', borderRadius: '6px', fontSize: '.85rem', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    Upload
                  </button>
                </form>
              </div>
            )
          })}
        </div>

        <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #f0f0f0', textAlign: 'center' }}>
          <a href="/api/sop-pdf" style={{
            display: 'inline-block', padding: '.75rem 1.5rem',
            background: '#cc3300', color: 'white',
            borderRadius: '6px', textDecoration: 'none',
            fontWeight: '600', fontSize: '.9rem'
          }}>
            Download App SOP (PDF)
          </a>
          <p style={{ color: '#999', fontSize: '.8rem', marginTop: '.5rem' }}>
            Step-by-step instructions for using this app
          </p>
        </div>
      </div>
    </main>
  )
}

async function ScreenshotPreview({ url }) {
  try {
    const res = await fetch(url, { method: 'HEAD' })
    if (!res.ok) throw new Error()
    return <img src={url} alt="Current screenshot" style={{ width: '100%', maxHeight: '160px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #e5e5e5' }} />
  } catch {
    return <div style={{ background: '#f5f5f5', borderRadius: '4px', padding: '1rem', textAlign: 'center', color: '#aaa', fontSize: '.8rem' }}>No screenshot uploaded yet</div>
  }
}

const labelStyle = { display: 'block', fontWeight: '600', marginBottom: '.4rem', color: '#333' }
const inputStyle = { width: '100%', padding: '.75rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '1rem', boxSizing: 'border-box' }
