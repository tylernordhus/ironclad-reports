export default async function PourLogSelect({ searchParams }) {
  const project_name = searchParams?.project_name || ''
  const project_id = searchParams?.project_id || ''
  const params = project_id ? '?project_id=' + project_id + '&project_name=' + encodeURIComponent(project_name) : ''

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      background: '#f5f5f5'
    }}>
      <div style={{ width: '100%', maxWidth: '500px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ color: '#1a1a1a', fontSize: '1.8rem', marginBottom: '.5rem' }}>
            Pour Log Type
          </h1>
          {project_name && (
            <p style={{ color: '#cc3300', fontWeight: '600', margin: 0 }}>{project_name}</p>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <a href={'/pour-log' + params} style={{ textDecoration: 'none' }}>
            <div style={{
              background: '#1a1a1a',
              borderRadius: '10px',
              padding: '2rem',
              color: 'white',
              cursor: 'pointer'
            }}>
              <div style={{ fontSize: '1.3rem', fontWeight: '700', marginBottom: '.4rem' }}>Drilled Shaft</div>
              <div style={{ fontSize: '.9rem', opacity: .85 }}>Multiple foundations, truck-by-truck depth tracking</div>
            </div>
          </a>

          <a href={'/pour-log-flatwork' + params} style={{ textDecoration: 'none' }}>
            <div style={{
              background: '#cc3300',
              borderRadius: '10px',
              padding: '2rem',
              color: 'white',
              cursor: 'pointer'
            }}>
              <div style={{ fontSize: '1.3rem', fontWeight: '700', marginBottom: '.4rem' }}>Flatwork</div>
              <div style={{ fontSize: '.9rem', opacity: .85 }}>Slabs, pads, and flatwork concrete placement</div>
            </div>
          </a>
        </div>

        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <a href={project_id ? '/projects/' + project_id : '/'} style={{ color: '#999', textDecoration: 'none', fontSize: '.9rem' }}>
            Cancel
          </a>
        </div>
      </div>
    </main>
  )
}
