export default function Success() {
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
        padding: '3rem 2rem',
        width: '100%',
        maxWidth: '500px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
        <h1 style={{ color: '#1a1a1a', marginBottom: '1rem' }}>Report Submitted</h1>
        <p style={{ color: '#666', marginBottom: '2rem', lineHeight: '1.6' }}>
          Your daily report has been saved and a PDF has been emailed to your GC automatically.
        </p>
        <a href="/" style={{
          display: 'inline-block',
          padding: '.75rem 2rem',
          background: '#cc3300',
          color: 'white',
          borderRadius: '6px',
          textDecoration: 'none',
          fontWeight: '700'
        }}>
          Submit Another Report
        </a>
      </div>
    </main>
  )
}
