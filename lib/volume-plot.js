import { getTruckEstimatedLeftover, isRejectedTruck } from '@/lib/pour-log-trucks'

const CUBIC_FEET_PER_CUBIC_YARD = 27
const YARD_TOLERANCE = 0.05

function asText(value) {
  return value == null ? '' : String(value).trim()
}

function parsePlainNumber(value) {
  const text = asText(value).replace(/,/g, '')
  if (!text) return null
  const number = Number(text)
  return Number.isFinite(number) ? number : null
}

function parseFeet(value) {
  const text = asText(value).toLowerCase().replace(/,/g, '')
  if (!text) return null

  const feetAndInches = text.match(/^(-?\d+(?:\.\d+)?)\s*'\s*(\d+(?:\.\d+)?)?\s*(?:"|in|inch|inches)?$/)
  if (feetAndInches) {
    return Number(feetAndInches[1]) + Number(feetAndInches[2] || 0) / 12
  }

  const inches = text.match(/^(-?\d+(?:\.\d+)?)\s*(?:"|in|inch|inches)$/)
  if (inches) {
    return Number(inches[1]) / 12
  }

  const feet = text.match(/^(-?\d+(?:\.\d+)?)\s*(?:ft|foot|feet|')$/)
  if (feet) {
    return Number(feet[1])
  }

  return parsePlainNumber(text)
}

function uniqueValues(values) {
  const seen = new Set()
  return values.filter(value => {
    if (!value || seen.has(value)) return false
    seen.add(value)
    return true
  })
}

function parseFoundationEntries(value) {
  const sourceEntries = Array.isArray(value)
    ? value
    : asText(value)
      ? String(value).split(',')
      : []

  const foundationIds = []
  const finishDepths = {}

  sourceEntries.forEach(entry => {
    const text = asText(entry)
    if (!text) return

    const match = text.match(/^(.*?)(?:\s*\(([^()]*)\))?$/)
    const foundationId = asText(match?.[1])
    const finishDepth = asText(match?.[2])

    if (!foundationId) return
    foundationIds.push(foundationId)
    if (finishDepth) finishDepths[foundationId] = finishDepth
  })

  return {
    foundationIds: uniqueValues(foundationIds),
    finishDepths,
  }
}

function parseFoundationListInput(value) {
  return uniqueValues(
    asText(value)
      .split(',')
      .map(item => asText(item))
      .filter(Boolean)
  )
}

function makePrompt(pendingInputs, key, message, defaultValue = '') {
  if (pendingInputs.some(item => item.key === key)) return
  pendingInputs.push({ key, message, defaultValue: asText(defaultValue) })
}

function getInputValue(inputs, key) {
  if (!inputs || typeof inputs !== 'object') return ''
  return asText(inputs[key])
}

function formatNumber(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : '-'
}

function foundationPromptDefault(rawValue, fallback = '') {
  return asText(rawValue || fallback)
}

function createFoundationRecord(foundationId, rawFoundation) {
  return {
    foundationId,
    rawFoundation,
    deliveries: [],
    assumptions: [],
  }
}

function finalizeAssumptions(assumptions) {
  return uniqueValues(assumptions).slice(0, 4)
}

function buildTheoreticalVolume(diameterFt, totalDepthFt) {
  const radiusFt = diameterFt / 2
  return Math.PI * radiusFt * radiusFt * totalDepthFt / CUBIC_FEET_PER_CUBIC_YARD
}

function truckKeyFor(truck, index) {
  return truck?.id ? `truck:${truck.id}` : `truck:${index + 1}`
}

function truckLabelFor(truck, index) {
  return `Truck ${asText(truck?.truck_number) || index + 1}`
}

function resolveFoundationField({
  foundation,
  pendingInputs,
  inputs,
  key,
  label,
  parser,
  promptExample,
}) {
  const rawValue = parser(foundation?.rawFoundation?.[key])
  if (rawValue != null) return { value: rawValue, prompted: false }

  const inputKey = `foundation:${foundation.foundationId}:${key}`
  const enteredValue = getInputValue(inputs, inputKey)
  if (!enteredValue) {
    makePrompt(
      pendingInputs,
      inputKey,
      `${label} for shaft ${foundation.foundationId} in feet.${promptExample ? ` ${promptExample}` : ''}`,
      foundationPromptDefault(foundation?.rawFoundation?.[key])
    )
    return { value: null, prompted: false }
  }

  const parsed = parser(enteredValue)
  if (parsed == null || parsed <= 0) {
    makePrompt(
      pendingInputs,
      inputKey,
      `Enter a valid ${label.toLowerCase()} for shaft ${foundation.foundationId} in feet.`,
      enteredValue
    )
    return { value: null, prompted: false }
  }

  foundation.assumptions.push(`${label} entered manually for this plot.`)
  return { value: parsed, prompted: true }
}

function resolveFoundationDepthField({ foundation, pendingInputs, inputs }) {
  const rawActualHoleDepth = parseFeet(foundation?.rawFoundation?.actual_hole_depth)
  if (rawActualHoleDepth != null) {
    return { value: rawActualHoleDepth, prompted: false }
  }

  const inputKey = `foundation:${foundation.foundationId}:actual_hole_depth`
  const enteredActualHoleDepth = getInputValue(inputs, inputKey)
  if (enteredActualHoleDepth) {
    const parsedActualHoleDepth = parseFeet(enteredActualHoleDepth)
    if (parsedActualHoleDepth == null || parsedActualHoleDepth <= 0) {
      makePrompt(
        pendingInputs,
        inputKey,
        `Enter a valid actual depth for shaft ${foundation.foundationId} in feet.`,
        enteredActualHoleDepth
      )
      return { value: null, prompted: false }
    }

    foundation.assumptions.push('Actual hole depth entered manually for this plot.')
    return { value: parsedActualHoleDepth, prompted: true }
  }

  return resolveFoundationField({
    foundation,
    pendingInputs,
    inputs,
    key: 'total_depth',
    label: 'Design depth',
    parser: parseFeet,
  })
}

function resolveTruckFoundations({
  shaftIds,
  shaftIdSet,
  truck,
  truckLabel,
  truckKey,
  inputs,
  pendingInputs,
}) {
  const parsed = parseFoundationEntries(truck?.foundations_served)
  const knownRawFoundations = parsed.foundationIds.filter(id => shaftIdSet.has(id))

  if (knownRawFoundations.length === parsed.foundationIds.length && knownRawFoundations.length > 0) {
    return { servedIds: knownRawFoundations, rawFinishDepths: parsed.finishDepths, prompted: false }
  }

  if (shaftIds.length === 1) {
    return {
      servedIds: [shaftIds[0]],
      rawFinishDepths: parsed.finishDepths,
      assumption: `${truckLabel} was assigned to ${shaftIds[0]} because it is the only shaft on this pour log.`,
      prompted: false,
    }
  }

  const inputKey = `${truckKey}:foundations`
  const enteredValue = getInputValue(inputs, inputKey)
  if (!enteredValue) {
    const availableIds = shaftIds.join(', ')
    const existingValue = asText(truck?.foundations_served)
    makePrompt(
      pendingInputs,
      inputKey,
      `${truckLabel} is missing a clear shaft assignment. Enter the shaft ID or comma-separated shaft IDs from: ${availableIds}.`,
      existingValue
    )
    return { servedIds: [], rawFinishDepths: parsed.finishDepths, prompted: false }
  }

  const enteredIds = parseFoundationListInput(enteredValue)
  const validIds = enteredIds.filter(id => shaftIdSet.has(id))
  if (!validIds.length || validIds.length !== enteredIds.length) {
    makePrompt(
      pendingInputs,
      inputKey,
      `${truckLabel} must use shaft IDs already on this pour log: ${shaftIds.join(', ')}.`,
      enteredValue
    )
    return { servedIds: [], rawFinishDepths: parsed.finishDepths, prompted: false }
  }

  return { servedIds: validIds, rawFinishDepths: parsed.finishDepths, prompted: true }
}

function resolveTruckYards({ truck, truckKey, truckLabel, inputs, pendingInputs }) {
  const rawYards = parsePlainNumber(truck?.yards)
  if (rawYards != null && rawYards > 0) {
    return { totalYards: rawYards, prompted: false }
  }

  const inputKey = `${truckKey}:yards`
  const enteredValue = getInputValue(inputs, inputKey)
  if (!enteredValue) {
    makePrompt(
      pendingInputs,
      inputKey,
      `${truckLabel} is missing delivered yards. Enter the truck volume in cubic yards.`,
      asText(truck?.yards)
    )
    return { totalYards: null, prompted: false }
  }

  const parsed = parsePlainNumber(enteredValue)
  if (parsed == null || parsed <= 0) {
    makePrompt(
      pendingInputs,
      inputKey,
      `Enter a valid delivered yardage for ${truckLabel}.`,
      enteredValue
    )
    return { totalYards: null, prompted: false }
  }

  return { totalYards: parsed, prompted: true }
}

function resolveFinishDepth({
  shaft,
  truck,
  truckKey,
  truckLabel,
  foundationId,
  rawFinishDepths,
  inputs,
  pendingInputs,
}) {
  const rawValue =
    parseFeet(rawFinishDepths?.[foundationId]) ??
    parseFeet(truck?.depth_reading) ??
    parseFeet(truck?.shaft_depth) ??
    parseFeet(truck?.finish_depth)

  if (rawValue != null && rawValue >= 0 && rawValue <= shaft.totalDepthFt) {
    return { finishDepthFt: rawValue, prompted: false }
  }

  const inputKey = `${truckKey}:finish-depth:${foundationId}`
  const enteredValue = getInputValue(inputs, inputKey)
  if (!enteredValue) {
    makePrompt(
      pendingInputs,
      inputKey,
      `Enter the finish depth after ${truckLabel} for shaft ${foundationId} in feet from the top of shaft.`,
      asText(rawFinishDepths?.[foundationId] || truck?.depth_reading || truck?.finish_depth)
    )
    return { finishDepthFt: null, prompted: false }
  }

  const parsed = parseFeet(enteredValue)
  if (parsed == null || parsed < 0 || parsed > shaft.totalDepthFt) {
    makePrompt(
      pendingInputs,
      inputKey,
      `Enter a finish depth for ${truckLabel} on shaft ${foundationId} between 0 and ${formatNumber(shaft.totalDepthFt, 2)} feet.`,
      enteredValue
    )
    return { finishDepthFt: null, prompted: false }
  }

  shaft.assumptions.push(`${truckLabel} finish depth was entered manually.`)
  return { finishDepthFt: parsed, prompted: true }
}

function resolveEstimatedLeftover({
  truck,
  truckKey,
  truckLabel,
  foundationId,
  totalYards,
  finishDepthFt,
  inputs,
  pendingInputs,
}) {
  if (finishDepthFt !== 0) {
    return { leftoverYards: 0, prompted: false }
  }

  const rawValue = getTruckEstimatedLeftover(truck)
  const parsedRaw = parsePlainNumber(rawValue)
  if (parsedRaw != null && parsedRaw >= 0 && parsedRaw <= totalYards) {
    return { leftoverYards: parsedRaw, prompted: false }
  }

  const inputKey = `${truckKey}:estimated-leftover`
  const enteredValue = getInputValue(inputs, inputKey)
  if (!enteredValue) {
    makePrompt(
      pendingInputs,
      inputKey,
      `${truckLabel} reached 0 ft on shaft ${foundationId}. Enter the estimated cubic yards left on the truck.`,
      rawValue
    )
    return { leftoverYards: null, prompted: false }
  }

  const parsed = parsePlainNumber(enteredValue)
  if (parsed == null || parsed < 0 || parsed > totalYards) {
    makePrompt(
      pendingInputs,
      inputKey,
      `Enter leftover yards for ${truckLabel} between 0 and ${formatNumber(totalYards, 2)}.`,
      enteredValue
    )
    return { leftoverYards: null, prompted: false }
  }

  return { leftoverYards: parsed, prompted: true }
}

function resolveSplitYards({
  truckKey,
  truckLabel,
  servedIds,
  totalPlacedYards,
  inputs,
  pendingInputs,
}) {
  const assignments = []
  let sum = 0
  let hasMissing = false

  servedIds.forEach(foundationId => {
    const inputKey = `${truckKey}:yards:${foundationId}`
    const enteredValue = getInputValue(inputs, inputKey)
    if (!enteredValue) {
      hasMissing = true
      makePrompt(
        pendingInputs,
        inputKey,
        `Enter the cubic yards from ${truckLabel} placed into shaft ${foundationId}. Total placed volume is ${formatNumber(totalPlacedYards, 2)} yards.`,
        ''
      )
      return
    }

    const parsed = parsePlainNumber(enteredValue)
    if (parsed == null || parsed < 0) {
      hasMissing = true
      makePrompt(
        pendingInputs,
        inputKey,
        `Enter a valid cubic yard allocation for ${truckLabel} into shaft ${foundationId}.`,
        enteredValue
      )
      return
    }

    assignments.push({ foundationId, deliveredYards: parsed })
    sum += parsed
  })

  if (hasMissing) return { assignments: [], prompted: false }

  if (Math.abs(sum - totalPlacedYards) > YARD_TOLERANCE) {
    servedIds.forEach(foundationId => {
      const inputKey = `${truckKey}:yards:${foundationId}`
      makePrompt(
        pendingInputs,
        inputKey,
        `${truckLabel} allocations must total ${formatNumber(totalPlacedYards, 2)} yards. Current split total is ${formatNumber(sum, 2)} yards. Update shaft ${foundationId}.`,
        getInputValue(inputs, inputKey)
      )
    })
    return { assignments: [], prompted: false }
  }

  return { assignments, prompted: true }
}

export function buildVolumePlotData({ log, foundations = [], trucks = [], inputs = {} }) {
  const pendingInputs = []
  const issues = []
  const shaftIds = []
  const shaftMap = new Map()

  foundations.forEach((rawFoundation, index) => {
    const foundationId = asText(rawFoundation?.foundation_id)
    if (!foundationId) {
      issues.push(`Foundation row ${index + 1} is missing a shaft ID.`)
      return
    }

    if (shaftMap.has(foundationId)) {
      issues.push(`Shaft ID ${foundationId} appears more than once on this pour log.`)
      return
    }

    shaftIds.push(foundationId)
    shaftMap.set(foundationId, createFoundationRecord(foundationId, rawFoundation))
  })

  if (!shaftIds.length) {
    issues.push('This pour log does not have any shaft rows to plot.')
  }

  const shaftIdSet = new Set(shaftIds)

  shaftIds.forEach(foundationId => {
    const shaft = shaftMap.get(foundationId)
    const diameter = resolveFoundationField({
      foundation: shaft,
      pendingInputs,
      inputs,
      key: 'shaft_diameter',
      label: 'Shaft diameter',
      parser: parseFeet,
      promptExample: 'Examples: 6, 6 ft, or 72 in.',
    })
    const totalDepth = resolveFoundationDepthField({
      foundation: shaft,
      pendingInputs,
      inputs,
    })

    shaft.diameterFt = diameter.value
    shaft.totalDepthFt = totalDepth.value
  })

  trucks.forEach((truck, index) => {
    if (isRejectedTruck(truck)) return

    const truckKey = truckKeyFor(truck, index)
    const truckLabel = truckLabelFor(truck, index)
    const truckFoundations = resolveTruckFoundations({
      shaftIds,
      shaftIdSet,
      truck,
      truckLabel,
      truckKey,
      inputs,
      pendingInputs,
    })

    const yards = resolveTruckYards({
      truck,
      truckKey,
      truckLabel,
      inputs,
      pendingInputs,
    })

    if (!truckFoundations.servedIds.length || yards.totalYards == null) {
      return
    }

    if (truckFoundations.assumption) {
      const onlyShaft = shaftMap.get(truckFoundations.servedIds[0])
      if (onlyShaft) onlyShaft.assumptions.push(truckFoundations.assumption)
    }

    if (truckFoundations.prompted) {
      truckFoundations.servedIds.forEach(foundationId => {
        shaftMap.get(foundationId)?.assumptions.push(`${truckLabel} shaft assignment was entered manually.`)
      })
    }

    if (yards.prompted) {
      truckFoundations.servedIds.forEach(foundationId => {
        shaftMap.get(foundationId)?.assumptions.push(`${truckLabel} delivered yardage was entered manually.`)
      })
    }

    if (truckFoundations.servedIds.length === 1) {
      const foundationId = truckFoundations.servedIds[0]
      const shaft = shaftMap.get(foundationId)
      if (!shaft || !Number.isFinite(shaft.totalDepthFt)) return

      const finishDepth = resolveFinishDepth({
        shaft,
        truck,
        truckKey,
        truckLabel,
        foundationId,
        rawFinishDepths: truckFoundations.rawFinishDepths,
        inputs,
        pendingInputs,
      })

      if (finishDepth.finishDepthFt == null) return

      const estimatedLeftover = resolveEstimatedLeftover({
        truck,
        truckKey,
        truckLabel,
        foundationId,
        totalYards: yards.totalYards,
        finishDepthFt: finishDepth.finishDepthFt,
        inputs,
        pendingInputs,
      })

      if (estimatedLeftover.leftoverYards == null) return
      if (estimatedLeftover.prompted) {
        shaft.assumptions.push(`${truckLabel} leftover yardage was entered manually.`)
      }
      if (estimatedLeftover.leftoverYards > 0) {
        shaft.assumptions.push(`${truckLabel} had ${formatNumber(estimatedLeftover.leftoverYards, 2)} yards left on the truck at completion.`)
      }

      shaft.deliveries.push({
        order: index,
        truckLabel,
        deliveredYards: yards.totalYards,
        placedYards: Math.max(yards.totalYards - estimatedLeftover.leftoverYards, 0),
        finishDepthFt: finishDepth.finishDepthFt,
      })
      return
    }

    const split = resolveSplitYards({
      truckKey,
      truckLabel,
      servedIds: truckFoundations.servedIds,
      totalPlacedYards: yards.totalYards,
      inputs,
      pendingInputs,
    })

    if (!split.assignments.length) return

    split.assignments.forEach(assignment => {
      const shaft = shaftMap.get(assignment.foundationId)
      if (!shaft || !Number.isFinite(shaft.totalDepthFt)) return

      const finishDepth = resolveFinishDepth({
        shaft,
        truck,
        truckKey,
        truckLabel,
        foundationId: assignment.foundationId,
        rawFinishDepths: truckFoundations.rawFinishDepths,
        inputs,
        pendingInputs,
      })

      if (finishDepth.finishDepthFt == null) return

      shaft.assumptions.push(`${truckLabel} split-yard allocation was entered manually.`)
      shaft.deliveries.push({
        order: index,
        truckLabel,
        deliveredYards: assignment.deliveredYards,
        placedYards: assignment.deliveredYards,
        finishDepthFt: finishDepth.finishDepthFt,
      })
    })
  })

  const shafts = shaftIds
    .map(foundationId => shaftMap.get(foundationId))
    .filter(shaft => shaft && Number.isFinite(shaft.diameterFt) && Number.isFinite(shaft.totalDepthFt))
    .map(shaft => {
      const deliveries = [...shaft.deliveries].sort((left, right) => left.order - right.order)
      let cumulativePlaced = 0

      const actualPoints = deliveries.map(delivery => {
        cumulativePlaced += delivery.placedYards
        return {
          truckLabel: delivery.truckLabel.replace(/^Truck\s+/i, ''),
          deliveredYards: delivery.deliveredYards,
          placedYards: delivery.placedYards,
          cumulativeDelivered: cumulativePlaced,
          finishDepthFt: delivery.finishDepthFt,
        }
      })

      const theoreticalTotalYards = buildTheoreticalVolume(shaft.diameterFt, shaft.totalDepthFt)
      const totalDeliveredYards = deliveries.reduce((sum, delivery) => sum + delivery.deliveredYards, 0)
      const totalPlacedYards = actualPoints[actualPoints.length - 1]?.cumulativeDelivered || 0
      const wastageYards = Math.max(totalDeliveredYards - totalPlacedYards, 0)

      return {
        foundationId: shaft.foundationId,
        diameterFt: shaft.diameterFt,
        totalDepthFt: shaft.totalDepthFt,
        actualPoints,
        totalDeliveredYards,
        totalPlacedYards,
        wastageYards,
        theoreticalTotalYards,
        overpourYards: totalPlacedYards - theoreticalTotalYards,
        assumptions: finalizeAssumptions(shaft.assumptions),
      }
    })

  if (!pendingInputs.length && !issues.length) {
    shafts.forEach(shaft => {
      if (!shaft.actualPoints.length) {
        issues.push(`No truck volume data could be matched to shaft ${shaft.foundationId}.`)
      }
    })
  }

  return {
    log,
    shafts,
    issues: uniqueValues(issues),
    pendingInputs,
  }
}

export function formatVolumePlotIssues(issues = []) {
  return issues
    .filter(Boolean)
    .map((issue, index) => `${index + 1}. ${issue}`)
    .join('\n')
}
