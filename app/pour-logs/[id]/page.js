import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import PourLogPdfButton from '@/app/components/PourLogPdfButton'
import { getUserId } from '@/lib/get-user-id'
import { getAccessiblePourLogById, getPourLogChildren } from '@/lib/pour-log-access'
import { getTruckEstimatedLeftover, isRejectedTruck, stripRejectedMarker } from '@/lib/pour-log-trucks'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

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

function getEditPath(log) {
  return log?.log_type === 'flatwork'
    ? '/pour-logs/' + log.id + '/edit-flatwork'
    : '/pour-logs/' + log.id + '/edit'
}

export default async function PourLogDetail({ params }) {
  const userId = await getUserId()
  const { log } = await getAccessiblePourLogById(supabase, { logId: params.id, userId })
  if (!log) notFound()

  const { foundations, trucks: sortedTrucks } = await getPourLogChildren(supabase, log.id)

  return (
    <main style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <Link href={log.project_id ? '/projects/' + log.project_id : '/pour-logs'} style={{ color: '#cc3300', textDecoration: 'none', fontSize: '.9rem' }}>
          Back
        </Link>
        <Link href={getEditPath(log)} style={{
          padding: '.72rem 1rem',
          background: '#cc3300',
          color: 'white',
          borderRadius: '6px',
          textDecoration: 'none',
          fontWeight: '700',
          fontSize: '.9rem',
          textAlign: 'center',
          boxShadow: '0 8px 18px rgba(204, 51, 0, 0.18)',
        }}>
          Edit Pour Log
        </Link>
      </div>

      <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '2rem' }}>
        <div style={{ background: '#1a1a1a', padding: '1.5rem 2rem' }}>
          <h1 style={{ color: 'white', fontSize: '1.5rem', margin: 0 }}>{log.log_type === 'flatwork' ? 'Flatwork Pour Log' : 'Drilled Shaft Pour Log'}</h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', margin: '.4rem 0 0', fontSize: '.9rem' }}>
            {log.project_name} - {formatDate(log.log_date)}
          </p>
        </div>

        <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              <Field label="Design Depth" value={f.total_depth} />
              <Field label="Actual Depth" value={f.actual_hole_depth} />
              <Field label="Est. Yards" value={f.estimated_yards} />
              <Field label="Shaft Diameter" value={f.shaft_diameter} />
              <Field label="Anchor Bolt Projection" value={f.anchor_bolt_projection} />
            </div>
            {f.notes && <Field label="Notes" value={f.notes} />}
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: '1.2rem', color: '#1a1a1a', marginBottom: '1rem' }}>Concrete Trucks</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
        {sortedTrucks.map((t, i) => {
          const estimatedLeftover = getTruckEstimatedLeftover(t)
          return (
            <div key={i} style={{ background: 'white', borderRadius: '8px', padding: '1.2rem 1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', marginBottom: '.75rem' }}>
              <div style={{ fontWeight: '700', fontSize: '1.1rem', color: '#1a1a1a' }}>Truck {t.truck_number}</div>
              {isRejectedTruck(t) && (
                <span style={{
                  padding: '.22rem .55rem',
                  borderRadius: '999px',
                  background: '#7a1212',
                  color: 'white',
                  fontSize: '.72rem',
                  fontWeight: '800',
                  letterSpacing: '.04em',
                }}>
                  REJECTED
                </span>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '.75rem' }}>
              <Field label="Truck Number" value={t.truck_number} />
              <Field label="Batch Time" value={formatTime(t.batch_time)} />
              <Field label="Arrival Time" value={formatTime(t.arrival_time)} />
              <Field label="Pour Start" value={formatTime(t.pour_start)} />
              <Field label="Pour Complete" value={formatTime(t.pour_complete)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '.75rem' }}>
              <Field label="Load Status" value={isRejectedTruck(t) ? 'Rejected' : 'Accepted'} />
              <Field label="Yards" value={t.yards} />
              <Field label="Concrete Temp" value={t.concrete_temp} />
              <Field label="Slump" value={t.slump} />
              <Field label="Air Content" value={t.air_content} />
              <Field label="Water Added" value={t.water_added} />
              <Field label="Cylinders Cast" value={t.cylinders_cast} />
              {estimatedLeftover && <Field label="Estimated Left On Truck" value={`${estimatedLeftover} yds`} />}
            </div>
            {t.foundations_served && !isRejectedTruck(t) && (
              <Field label="Foundations Served" value={t.foundations_served} />
            )}
            {stripRejectedMarker(t.notes) && <Field label="Notes" value={stripRejectedMarker(t.notes)} />}
            </div>
          )
        })}
      </div>

      {log.photo_urls && log.photo_urls.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.2rem', color: '#1a1a1a', marginBottom: '1rem' }}>Photos</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '.75rem' }}>
            {log.photo_urls.map((url, i) => (
              <div key={i}>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={url}
                    alt={log.photo_labels?.[i] || `Photo ${i + 1}`}
                    style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '8px', display: 'block' }}
                  />
                </a>
                {log.photo_labels?.[i] && (
                  <div style={{ fontSize: '.8rem', color: '#555', marginTop: '.35rem', lineHeight: '1.4' }}>
                    {log.photo_labels[i]}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <PourLogPdfButton logId={log.id} />
        {log.log_type !== 'flatwork' ? (
          <Link href={`/pour-logs/${log.id}/volume-plot`} style={{
            flex: 1,
            minWidth: '160px',
            padding: '.8rem 1rem',
            background: '#24506d',
            color: 'white',
            borderRadius: '6px',
            textDecoration: 'none',
            fontWeight: '600',
            fontSize: '.9rem',
            textAlign: 'center'
          }}>
            View Volume Plot
          </Link>
        ) : null}
        <Link href={getEditPath(log)} style={{
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
    <div style={{ marginBottom: '.5rem', minWidth: 0 }}>
      <div style={{ fontSize: '.7rem', fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '.2rem', lineHeight: '1.2', minHeight: '2rem', display: 'flex', alignItems: 'flex-end' }}>
        {label}
      </div>
      <div style={{ fontSize: '.95rem', color: '#1a1a1a', overflowWrap: 'anywhere' }}>
        {value || '-'}
      </div>
    </div>
  )
}
