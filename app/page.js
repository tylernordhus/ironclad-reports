import Link from 'next/link'

export default function Home() {
  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      background: '#f5f5f5'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '600px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{
            color: '#1a1a1a',
            fontSize: '2.2rem',
            marginBottom: '.5rem',
            fontWeight: '800'
          }}>
            Ironclad Reports
          </h1>
          <p style={{ color: '#666', fontSize: '1rem' }}>
            Ironclad Construction LLC
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Link href="/daily-report" style={{ textDecoration: 'none' }}>
            <div style={{
              background: '#cc3300',
              borderRadius: '10px',
              padding: '2rem',
              color: 'white',
              cursor: 'pointer'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '.5rem' }}>📋</div>
              <div style={{ fontSize: '1.3rem', fontWeight: '700', marginBottom: '.4rem' }}>
                Daily Report
              </div>
              <div style={{ fontSize: '.9rem', opacity: .85 }}>
                Submit your daily crew, work, and safety report
              </div>
            </div>
          </Link>

          <Link href="/pour-log" style={{ textDecoration: 'none' }}>
            <div style={{
              background: '#1a1a1a',
              borderRadius: '10px',
              padding: '2rem',
              color: 'white',
              cursor: 'pointer'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '.5rem' }}>🪣</div>
              <div style={{ fontSize: '1.3rem', fontWeight: '700', marginBottom: '.4rem' }}>
                Pour Log
              </div>
              <div style={{ fontSize: '.9rem', opacity: .85 }}>
                Record concrete pour details, mix design, and placement
              </div>
            </div>
          </Link>

          <Link href="/reports" style={{ textDecoration: 'none' }}>
            <div style={{
              background: 'white',
              border: '2px solid #e5e5e5',
              borderRadius: '10px',
              padding: '2rem',
              color: '#1a1a1a',
              cursor: 'pointer'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '.5rem' }}>📁</div>
              <div style={{ fontSize: '1.3rem', fontWeight: '700', marginBottom: '.4rem' }}>
                View All Reports
              </div>
              <div style={{ fontSize: '.9rem', color: '#666' }}>
                Browse and manage submitted reports
              </div>
            </div>
          </Link>
        </div>
      </div>
    </main>
  )
}
