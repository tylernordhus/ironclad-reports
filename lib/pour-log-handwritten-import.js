function asText(value) {
  return value == null ? '' : String(value).trim()
}

function normalizeComparableText(value) {
  return asText(value)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.map(item => asText(item)).filter(Boolean)
  }

  return asText(value)
    .split(',')
    .map(item => asText(item))
    .filter(Boolean)
}

function normalizeStringMap(value) {
  if (Array.isArray(value)) {
    return Object.fromEntries(
      value
        .map(entry => [asText(entry?.foundation_id), asText(entry?.finish_depth)])
        .filter(([key, entryValue]) => key && entryValue)
    )
  }

  if (!value || typeof value !== 'object') {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, entryValue]) => [asText(key), asText(entryValue)])
      .filter(([key, entryValue]) => key && entryValue)
  )
}

function stripDuplicatedDepthNotes(notes, foundationsServed, shaftDepths) {
  let remaining = normalizeComparableText(notes)
  if (!remaining) return ''

  foundationsServed.forEach(foundationId => {
    const depth = asText(shaftDepths[foundationId])
    if (!depth) return

    const fragments = [
      normalizeComparableText(`${foundationId} ${depth}`),
      normalizeComparableText(`${foundationId} (${depth})`),
      normalizeComparableText(`${foundationId}: ${depth}`),
      normalizeComparableText(`${foundationId} - ${depth}`),
    ].filter(Boolean)

    fragments.forEach(fragment => {
      remaining = remaining.split(fragment).join(' ')
    })
  })

  return remaining.replace(/[\s,;:()/|-]+/g, ' ').trim()
}

function normalizeImportedTruck(truck, index) {
  const foundations_served = normalizeStringArray(truck?.foundations_served)
  const shaft_depths = normalizeStringMap(truck?.shaft_depths)
  const rawNotes = asText(truck?.notes)
  const notes = stripDuplicatedDepthNotes(rawNotes, foundations_served, shaft_depths) ? rawNotes : ''

  return {
    ...emptyImportedTruck(asText(truck?.truck_number) || String(index + 1)),
    truck_number: asText(truck?.truck_number) || String(index + 1),
    batch_time: asText(truck?.batch_time),
    arrival_time: asText(truck?.arrival_time),
    pour_start: asText(truck?.pour_start),
    pour_complete: asText(truck?.pour_complete),
    yards: asText(truck?.yards),
    rejected: Boolean(truck?.rejected),
    foundations_served,
    shaft_depths,
    estimated_leftover_yards: asText(truck?.estimated_leftover_yards),
    concrete_temp: asText(truck?.concrete_temp),
    slump: asText(truck?.slump),
    air_content: asText(truck?.air_content),
    water_added: asText(truck?.water_added),
    cylinders_cast: asText(truck?.cylinders_cast),
    notes,
  }
}

export const HANDWRITTEN_IMPORT_STORAGE_KEY = 'pour-log-handwritten-import-draft'

export function emptyImportedFoundation() {
  return {
    foundation_id: '',
    total_depth: '',
    actual_hole_depth: '',
    estimated_yards: '',
    shaft_diameter: '',
    anchor_bolt_projection: '',
    notes: '',
  }
}

export function emptyImportedTruck(truckNumber = '1') {
  return {
    truck_number: truckNumber,
    batch_time: '',
    arrival_time: '',
    pour_start: '',
    pour_complete: '',
    yards: '',
    rejected: false,
    foundations_served: [],
    shaft_depths: {},
    estimated_leftover_yards: '',
    concrete_temp: '',
    slump: '',
    air_content: '',
    water_added: '',
    cylinders_cast: '',
    notes: '',
  }
}

export function normalizeHandwrittenImportDraft(rawDraft = {}) {
  const foundations = Array.isArray(rawDraft?.foundations)
    ? rawDraft.foundations.map(foundation => ({
        foundation_id: asText(foundation?.foundation_id),
        total_depth: asText(foundation?.total_depth),
        actual_hole_depth: asText(foundation?.actual_hole_depth),
        estimated_yards: asText(foundation?.estimated_yards),
        shaft_diameter: asText(foundation?.shaft_diameter),
        anchor_bolt_projection: asText(foundation?.anchor_bolt_projection),
        notes: asText(foundation?.notes),
      })).filter(foundation => (
        foundation.foundation_id ||
        foundation.total_depth ||
        foundation.actual_hole_depth ||
        foundation.estimated_yards ||
        foundation.shaft_diameter ||
        foundation.anchor_bolt_projection ||
        foundation.notes
      ))
    : []

  const trucks = Array.isArray(rawDraft?.trucks)
    ? rawDraft.trucks.map((truck, index) => normalizeImportedTruck(truck, index)).filter(truck => (
        truck.truck_number ||
        truck.batch_time ||
        truck.arrival_time ||
        truck.pour_start ||
        truck.pour_complete ||
        truck.yards ||
        truck.foundations_served.length > 0 ||
        Object.keys(truck.shaft_depths).length > 0 ||
        truck.estimated_leftover_yards ||
        truck.concrete_temp ||
        truck.slump ||
        truck.air_content ||
        truck.water_added ||
        truck.cylinders_cast ||
        truck.notes ||
        truck.rejected
      ))
    : []

  return {
    project_id: asText(rawDraft?.project_id),
    project_name: asText(rawDraft?.project_name),
    log_date: asText(rawDraft?.log_date),
    weather: asText(rawDraft?.weather),
    ambient_temp: asText(rawDraft?.ambient_temp),
    concrete_supplier: asText(rawDraft?.concrete_supplier),
    submitted_by: asText(rawDraft?.submitted_by),
    foundations: foundations.length > 0 ? foundations : [emptyImportedFoundation()],
    trucks: trucks.length > 0 ? trucks : [emptyImportedTruck()],
    review_notes: normalizeStringArray(rawDraft?.review_notes),
    low_confidence_fields: normalizeStringArray(rawDraft?.low_confidence_fields),
    missing_fields: normalizeStringArray(rawDraft?.missing_fields),
    remarks_issues: asText(rawDraft?.remarks_issues),
  }
}
