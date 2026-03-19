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

function formatTime(time) {
  if (!time) return '-'
  const [hourStr, minute] = time.split(':')
  const hour = parseInt(hourStr)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12
  return hour12 + ':' + minute + ' ' + ampm
}

export default async function PourLogDetail({ params }) {
  const { data: log, error } = await supabase
    .from('pour_logs')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !log) {
    return <p style={{ padding: '2rem', color: 'red' }}>Pour log not found.</p>
  }

  const { data: foundations } = await supabase
    .from('pour_log_foundations')
    .select('*')
    .eq('pour_log_id', log.id)

  const { data: trucks } = await supabase
    .from('pour_log_trucks')
    .select('*')
    .eq('pour_log_id', log.id)
    .order('truck_number', { ascending: true })

  return (
    <main style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href={log.project_id ? '/projects/' + log.project_id : '/pour-logs'} style={{ color: '#cc3300', textDecoration: 'none', fontSize: '.9rem' }}>
          Back
        </Link>
      </div>

      <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '2rem' }}>
        <div style={{ background: '#1a1a1a', padding: '1.5rem 2rem' }}>
          <h1 style={{ color: 'white', fontSize: '1.5rem', margin: 0 }}>Drilled Shaft Pour Log</h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', margin: '.4rem 0 0', fontSize: '.9rem' }}>
            {log.project_name} - {formatDate(log.log_date)}
          </p>
        </div>

        <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <Field label="Submitted By" value={log.submitted_by} />
            <Field label="Concrete Supplier" value={log.concrete_supplier} />
            <Field label="Weather" value={log.weather} />
            <Field label="Ambient Temp" value={log.ambient_temp} />
          </div>
        </div>
      </div>

      <h2 style={{ fontSize: '1.2rem', color: '#1a1a1a', marginBottom: '1rem' }}>Foundations Poured</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
        {foundations && foundations.map((f, i) => (
          <div key={i} style={{ background: 'white', borderRadius: '8px', padding: '1.2rem 1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontWeight: '700', fontSize: '1.1rem', color: '#1a1a1a', marginBottom: '.75rem' }}>{f.foundation_id}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Field label="Total Depth" value={f.total_depth} />
              <Field label="Est. Yards" value={f.estimated_yards} />
            </div>
            {f.notes && <Field label="Notes" value={f.notes} />}
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: '1.2rem', color: '#1a1a1a', marginBottom: '1rem' }}>Concrete Trucks</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
        {trucks && trucks.map((t, i) => (
          <div key={i} style={{ background: 'white', borderRadius: '8px', padding: '1.2rem 1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontWeight: '700', fontSize: '1.1rem', color: '#1a1a1a', marginBottom: '.75rem' }}>Truck {t.truck_number}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '.75rem' }}>
              <Field label="Arrival" value={formatTime(t.arrival_time)} />
              <Field label="Pour Start" value={formatTime(t.pour_start)} />
              <Field label="Pour Complete" value={formatTime(t.pour_complete)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '.75rem' }}>
              <Field label="Yards" value={t.yards} />
              <Field label="Depth Reading" value={t.depth_reading} />
              <Field label="Concrete Temp" value={t.concrete_temp} />
              <Field label="Slump" value={t.slump} />
              <Field label="Air Content" value={t.air_content} />
              <Field label="Water Added" value={t.water_added} />
              <Field label="Cylinders Cast" value={t.cylinders_cast} />
            </div>
            {t.foundations_served && (
              <Field label="Foundations Served" value={t.foundations_served} />
            )}
            {t.notes && <Field label="Notes" value={t.notes} />}
          </div>
        ))}
      </div>

      {log.photo_urls && log.photo_urls.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.2rem', color: '#1a1a1a', marginBottom: '1rem' }}>Photos</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '.75rem' }}>
            {log.photo_urls.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                <img
                  src={url}
                  alt={`Photo ${i + 1}`}
                  style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '8px', display: 'block' }}
                />
              </a>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <a href={'/api/pour-log/pdf/' + log.id} style={{
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
          Download PDF
        </a>
        <Link href={'/pour-logs/' + log.id + '/edit'} style={{
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
          Edit Log
        </Link>
      </div>
    </main>
  )
}

function Field({ label, value }) {
  return (
    <div style={{ marginBottom: '.5rem' }}>
      <div style={{ fontSize: '.7rem', fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '.2rem' }}>
        {label}
      </div>
      <div style={{ fontSize: '.95rem', color: '#1a1a1a' }}>
        {value || '-'}
      </div>
    </div>
  )
}
