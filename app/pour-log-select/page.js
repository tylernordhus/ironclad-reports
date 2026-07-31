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
          <div style={{
            background: '#1a1a1a',
            borderRadius: '10px',
            padding: '2rem',
            color: 'white',
          }}>
            <div style={{ fontSize: '1.3rem', fontWeight: '700', marginBottom: '.4rem' }}>Drilled Shaft</div>
            <div style={{ fontSize: '.9rem', opacity: .85, marginBottom: '1rem' }}>
              Multiple foundations, truck-by-truck depth tracking, plus printable handwritten import.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.7rem' }}>
              <a
                href={'/pour-log' + params}
                style={{
                  textDecoration: 'none',
                  background: '#cc3300',
                  color: 'white',
                  padding: '.75rem 1rem',
                  borderRadius: '8px',
                  fontWeight: '700',
                }}
              >
                Fill In App
              </a>
              <form
                action="/api/pour-log/blank-form"
                method="GET"
                target="_blank"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '.5rem',
                  background: 'rgba(255,255,255,.14)',
                  padding: '.55rem .7rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,.18)',
                }}
              >
                {project_name && (
                  <input type="hidden" name="project_name" value={project_name} />
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.2rem' }}>
                  <label htmlFor="truck-count-print" style={{ fontSize: '.72rem', fontWeight: '700', opacity: .9 }}>
                    Trucks
                  </label>
                  <input
                    id="truck-count-print"
                    type="number"
                    name="truck_count"
                    min="1"
                    max="40"
                    defaultValue="10"
                    style={{
                      width: '64px',
                      padding: '.4rem .45rem',
                      borderRadius: '6px',
                      border: '1px solid rgba(255,255,255,.28)',
                      background: 'white',
                      color: '#1a1a1a',
                      fontWeight: '700',
                    }}
                  />
                </div>
                <button
                  type="submit"
                  style={{
                    background: 'transparent',
                    color: 'white',
                    border: 'none',
                    padding: '.2rem 0 .2rem .1rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  Print Blank Form
                </button>
              </form>
              <a
                href={'/pour-log-import' + params}
                style={{
                  textDecoration: 'none',
                  background: 'rgba(255,255,255,.14)',
                  color: 'white',
                  padding: '.75rem 1rem',
                  borderRadius: '8px',
                  fontWeight: '700',
                  border: '1px solid rgba(255,255,255,.18)',
                }}
              >
                Import Handwritten
              </a>
            </div>
          </div>

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
