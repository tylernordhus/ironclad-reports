function asText(value) {
  return String(value ?? '').trim()
}

export function compareTruckNumbers(left, right) {
  const leftText = asText(left)
  const rightText = asText(right)

  if (!leftText && !rightText) return 0
  if (!leftText) return 1
  if (!rightText) return -1

  return leftText.localeCompare(rightText, undefined, {
    numeric: true,
    sensitivity: 'base',
  })
}

export function sortTrucksByNumber(trucks) {
  return [...(Array.isArray(trucks) ? trucks : [])].sort((a, b) =>
    compareTruckNumbers(a?.truck_number, b?.truck_number)
  )
}
