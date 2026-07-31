const REJECTED_MARKER = '[REJECTED]'
const LEFTOVER_PATTERN = /\[LEFTOVER=([^\]]+)\]/g

function asText(value) {
  return value == null ? '' : String(value).trim()
}

function stripTruckMetadata(notes) {
  const text = asText(notes)
  if (!text) return ''

  return text
    .replace(LEFTOVER_PATTERN, '')
    .replace(REJECTED_MARKER, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function stripRejectedMarker(notes) {
  return stripTruckMetadata(notes)
}

export function isRejectedTruck(truckOrNotes) {
  const notes = typeof truckOrNotes === 'string'
    ? truckOrNotes
    : truckOrNotes?.notes

  const text = asText(notes)
  return text === REJECTED_MARKER || text.startsWith(`${REJECTED_MARKER} `)
}

export function buildTruckNotes(notes, rejected, estimatedLeftover = '') {
  const cleanNotes = stripTruckMetadata(notes)
  const markers = []
  const cleanLeftover = asText(estimatedLeftover)

  if (rejected) {
    markers.push(REJECTED_MARKER)
  }

  if (cleanLeftover) {
    markers.push(`[LEFTOVER=${cleanLeftover}]`)
  }

  return [...markers, cleanNotes].filter(Boolean).join(' ').trim()
}

export function getTruckEstimatedLeftover(truckOrNotes) {
  const notes = typeof truckOrNotes === 'string'
    ? truckOrNotes
    : truckOrNotes?.notes

  const text = asText(notes)
  const match = text.match(/\[LEFTOVER=([^\]]+)\]/)
  return asText(match?.[1])
}

export function formatTruckFoundations(foundationsServed = [], shaftDepths = {}, rejected = false) {
  if (rejected) return ''
  return (foundationsServed || []).map(foundationId => {
    const depth = shaftDepths?.[foundationId]
    return depth ? `${foundationId} (${depth})` : foundationId
  }).join(', ')
}
