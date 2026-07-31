'use client'

import { useEffect, useMemo, useState } from 'react'

const DEFAULT_SECTIONS = Array.from({ length: 10 }, () => ({ ft: '5', in: '0' }))

export function createDefaultTremieGuide() {
  return {
    enabled: false,
    selectedFoundationIndex: 0,
    shaftDiameter: '7',
    shaftDepth: '50',
    loadSize: '10',
    minEmbedment: '5',
    plugLift: '0.75',
    liftCeiling: '6',
    hopperHeight: '3',
    capBreaksPerTruck: true,
    sections: DEFAULT_SECTIONS,
    breakPipeByTruck: {},
    actualActions: {},
  }
}

export function normalizeTremieGuide(value) {
  const defaults = createDefaultTremieGuide()
  if (!value || typeof value !== 'object') return defaults

  const sections = Array.isArray(value.sections) && value.sections.length > 0
    ? value.sections.map(section => ({
      ft: String(section?.ft ?? ''),
      in: String(section?.in ?? '0'),
    }))
    : defaults.sections

  return {
    ...defaults,
    ...value,
    enabled: Object.prototype.hasOwnProperty.call(value, 'enabled')
      ? value.enabled === true
      : hasGuideEntries(value),
    selectedFoundationIndex: Number.isFinite(Number(value.selectedFoundationIndex))
      ? Number(value.selectedFoundationIndex)
      : defaults.selectedFoundationIndex,
    shaftDiameter: String(value.shaftDiameter ?? defaults.shaftDiameter),
    shaftDepth: String(value.shaftDepth ?? defaults.shaftDepth),
    loadSize: String(value.loadSize ?? defaults.loadSize),
    minEmbedment: String(value.minEmbedment ?? defaults.minEmbedment),
    plugLift: String(value.plugLift ?? defaults.plugLift),
    liftCeiling: String(value.liftCeiling ?? defaults.liftCeiling),
    hopperHeight: String(value.hopperHeight ?? defaults.hopperHeight),
    capBreaksPerTruck: value.capBreaksPerTruck !== false,
    sections,
    breakPipeByTruck: value.breakPipeByTruck && typeof value.breakPipeByTruck === 'object'
      ? value.breakPipeByTruck
      : {},
    actualActions: value.actualActions && typeof value.actualActions === 'object'
      ? value.actualActions
      : {},
  }
}

function hasGuideEntries(value) {
  if (!value || typeof value !== 'object') return false
  if (Object.keys(value.actualActions || {}).length > 0) return true

  const defaults = createDefaultTremieGuide()
  return [
    'shaftDiameter',
    'shaftDepth',
    'loadSize',
    'minEmbedment',
    'plugLift',
    'liftCeiling',
    'hopperHeight',
  ].some(field => String(value[field] ?? '') !== String(defaults[field] ?? ''))
}

function parseNumber(value, fallback = 0) {
  const text = String(value ?? '').trim()
  if (!text) return fallback
  const parsed = Number.parseFloat(text.replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseFeet(value, fallback = 0) {
  const text = String(value ?? '').trim().toLowerCase()
  if (!text) return fallback

  const normalized = text
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')

  const feetMatch = normalized.match(/(-?\d+(?:\.\d+)?)\s*(?:'|ft|feet|foot)/)
  const inchMatch = normalized.match(/(-?\d+(?:\.\d+)?)\s*(?:"|in|inch|inches)/)

  if (feetMatch || inchMatch) {
    return parseNumber(feetMatch?.[1], 0) + (parseNumber(inchMatch?.[1], 0) / 12)
  }

  return parseNumber(normalized, fallback)
}

function sectionLength(section) {
  return Math.max(0, parseNumber(section?.ft, 0) + (parseNumber(section?.in, 0) / 12))
}

function formatFeet(value) {
  if (!Number.isFinite(value)) return '-'
  const rounded = Math.round(value * 10) / 10
  return `${rounded.toFixed(Math.abs(rounded) < 10 ? 1 : 0)} ft`
}

function formatYards(value) {
  if (!Number.isFinite(value)) return '-'
  return `${value.toFixed(1)} yd3`
}

function formatRelativeToConcrete(value) {
  if (!Number.isFinite(value)) return '-'
  if (Math.abs(value) < 0.05) return 'at concrete'
  return `${formatFeet(Math.abs(value))} ${value < 0 ? 'above' : 'below'} concrete`
}

function formatRelativeToToc(value) {
  if (!Number.isFinite(value)) return '-'
  if (Math.abs(value) < 0.05) return 'at TOC'
  return `${formatFeet(Math.abs(value))} ${value < 0 ? 'above' : 'below'} TOC`
}

function getTruckVolume(truck, fallbackLoadSize) {
  if (truck?.rejected) return 0
  const volume = parseNumber(truck?.yards, fallbackLoadSize)
  return Math.max(0, volume)
}

function calculateSteps({ config, trucks }) {
  const shaftDiameter = Math.max(0.1, parseFeet(config.shaftDiameter, 7))
  const shaftDepth = Math.max(1, parseFeet(config.shaftDepth, 50))
  const loadSize = Math.max(0.1, parseNumber(config.loadSize, 10))
  const minEmbedment = Math.max(0, parseFeet(config.minEmbedment, 5))
  const plugLift = 0
  const liftCeiling = Math.max(0, parseFeet(config.liftCeiling, 6))
  const hopperHeight = Math.max(0, parseFeet(config.hopperHeight, 3))
  const breakPipeByTruck = config.breakPipeByTruck && typeof config.breakPipeByTruck === 'object'
    ? config.breakPipeByTruck
    : {}
  const sections = (config.sections || [])
    .map((section, index) => ({ ...section, index, length: sectionLength(section) }))
    .filter(section => section.length > 0)

  const area = Math.PI * Math.pow(shaftDiameter / 2, 2)
  const shaftVolume = (shaftDepth * area) / 27
  const risePerLoad = (loadSize * 27) / area
  const loadsToFill = Math.ceil(shaftVolume / loadSize)
  const inputTrucks = Array.isArray(trucks) && trucks.length > 0
    ? trucks
    : Array.from({ length: Math.max(1, loadsToFill) }, () => ({ yards: '' }))

  let concreteSurfaceDepth = shaftDepth
  let pipeBottomDepth = Math.max(0, shaftDepth - plugLift)
  let remainingSections = [...sections]
  const steps = []

  inputTrucks.forEach((truck, truckIndex) => {
    const volume = getTruckVolume(truck, loadSize)
    const rise = (volume * 27) / area
    concreteSurfaceDepth = Math.max(0, concreteSurfaceDepth - rise)

    let action = 'HOLD'
    let reason = truck?.rejected
      ? 'Rejected load skipped'
      : 'Embedment and hopper reach are acceptable'
    let liftAmount = 0
    const brokenSections = []

    const concretePlacedHeight = shaftDepth - concreteSurfaceDepth
    const hasMinimumConcrete = concretePlacedHeight > minEmbedment

    if (!truck?.rejected && !hasMinimumConcrete) {
      action = 'HOLD'
      reason = `Keep pipe on bottom until concrete placed exceeds ${formatFeet(minEmbedment)}`
    } else if (!truck?.rejected && breakPipeByTruck[truckIndex]) {
      const topSection = remainingSections[remainingSections.length - 1]
      if (!topSection) {
        action = 'HOLD'
        reason = 'No pipe sections left to break'
      } else {
        const candidatePipeBottom = Math.max(0, pipeBottomDepth - topSection.length)
        const embedAfterBreak = candidatePipeBottom - concreteSurfaceDepth
        if (embedAfterBreak >= minEmbedment) {
          pipeBottomDepth = candidatePipeBottom
          remainingSections = remainingSections.slice(0, -1)
          brokenSections.push(topSection)
          action = 'BREAK'
          reason = `Break section ${topSection.index + 1}`
        } else {
          action = 'HOLD'
          reason = `Cannot break section ${topSection.index + 1} and keep ${formatFeet(minEmbedment)} embedment`
        }
      }
    } else if (!truck?.rejected) {
      const availableLiftByEmbedment = Math.max(0, pipeBottomDepth - (concreteSurfaceDepth + minEmbedment))
      if (availableLiftByEmbedment > 0.25) {
        action = 'LIFT'
        reason = `Can lift up to ${formatFeet(availableLiftByEmbedment)} and keep minimum embedment`
      }
    }

    const remainingPipeLength = remainingSections.reduce((sum, section) => sum + section.length, 0)
    const embedment = pipeBottomDepth - concreteSurfaceDepth
    const pipeTopDepth = pipeBottomDepth - remainingPipeLength
    const hopperTopDepth = pipeBottomDepth - remainingPipeLength - hopperHeight
    const shallowestSafePipeBottomDepth = concreteSurfaceDepth + minEmbedment
    const highestSafeHopperTopDepth = shallowestSafePipeBottomDepth - remainingPipeLength - hopperHeight
    const currentHopperToConcrete = hopperTopDepth - concreteSurfaceDepth
    const highestSafeHopperToConcrete = highestSafeHopperTopDepth - concreteSurfaceDepth
    const availableLiftByEmbedment = Math.max(0, pipeBottomDepth - shallowestSafePipeBottomDepth)

    steps.push({
      truckIndex,
      truckLabel: `Truck ${truckIndex + 1}`,
      truckId: truck?.truck_number || '',
      volume,
      action,
      reason,
      concreteSurfaceDepth,
      pipeBottomDepth,
      pipeTopDepth,
      embedment,
      hopperTopDepth,
      highestSafeHopperTopDepth,
      currentHopperToConcrete,
      highestSafeHopperToConcrete,
      availableLiftByEmbedment,
      concretePlacedHeight,
      remainingPipeLength,
      remainingSections: [...remainingSections],
      brokenSections,
      liftAmount,
      belowMinimum: embedment < minEmbedment,
    })
  })

  return {
    shaftDiameter,
    shaftDepth,
    loadSize,
    minEmbedment,
    plugLift,
    liftCeiling,
    hopperHeight,
    sections,
    area,
    shaftVolume,
    risePerLoad,
    loadsToFill,
    totalPipeLength: sections.reduce((sum, section) => sum + section.length, 0),
    steps,
  }
}

export default function TremieBreakGuide({
  value,
  onChange,
  foundations = [],
  trucks = [],
  sectionStyle,
  sectionHeaderStyle,
  fieldStyle,
  labelStyle,
  inputStyle,
}) {
  const guide = useMemo(() => normalizeTremieGuide(value), [value])
  const [selectedStepIndex, setSelectedStepIndex] = useState(0)
  const selectedFoundationIndex = foundations.length > 0
    ? Math.max(0, Math.min(guide.selectedFoundationIndex, foundations.length - 1))
    : 0
  const selectedFoundation = foundations[selectedFoundationIndex] || null
  const selectedFoundationDepth = selectedFoundation?.actual_hole_depth || selectedFoundation?.total_depth || ''
  const selectedFoundationDiameter = selectedFoundation?.shaft_diameter || ''

  const config = useMemo(() => ({
    ...guide,
    shaftDiameter: selectedFoundationDiameter || guide.shaftDiameter || '7',
    shaftDepth: selectedFoundationDepth || guide.shaftDepth || '50',
    plugLift: '0.75',
    liftCeiling: '6',
    capBreaksPerTruck: true,
  }), [guide, selectedFoundationDepth, selectedFoundationDiameter])

  const result = useMemo(() => calculateSteps({ config, trucks }), [config, trucks])
  const selectedStep = result.steps[Math.min(selectedStepIndex, Math.max(0, result.steps.length - 1))]

  useEffect(() => {
    setSelectedStepIndex(current => Math.min(current, Math.max(0, result.steps.length - 1)))
  }, [result.steps.length])

  const updateGuide = (field, nextValue) => {
    onChange?.({ ...guide, [field]: nextValue })
  }

  const enabled = guide.enabled === true

  const updateSection = (index, field, nextValue) => {
    const sections = guide.sections.map((section, sectionIndex) => (
      sectionIndex === index ? { ...section, [field]: nextValue } : section
    ))
    updateGuide('sections', sections)
  }

  const addBottomSection = () => {
    updateGuide('sections', [{ ft: '5', in: '0' }, ...guide.sections])
  }

  const removeSection = (index) => {
    if (guide.sections.length <= 1) return
    updateGuide('sections', guide.sections.filter((_, sectionIndex) => sectionIndex !== index))
  }

  const updateActualAction = (truckIndex, field, nextValue) => {
    const actualActions = {
      ...guide.actualActions,
      [truckIndex]: {
        ...(guide.actualActions?.[truckIndex] || {}),
        [field]: nextValue,
      },
    }
    updateGuide('actualActions', actualActions)
  }

  const updateBreakPipeForTruck = (truckIndex, checked) => {
    const breakPipeByTruck = { ...(guide.breakPipeByTruck || {}) }
    if (checked) {
      breakPipeByTruck[truckIndex] = true
    } else {
      delete breakPipeByTruck[truckIndex]
    }
    updateGuide('breakPipeByTruck', breakPipeByTruck)
  }

  return (
    <div style={sectionStyle}>
      <div style={toggleHeaderStyle}>
        <div>
          <div style={sectionHeaderStyle}>Tremie Break Guide</div>
          <div style={toggleSummaryStyle}>
            {enabled
              ? 'Enabled for this drilled-shaft pour.'
              : 'Off for this pour. Turn it on when tremie pipe break guidance is needed.'}
          </div>
        </div>
        <button
          type="button"
          onClick={() => updateGuide('enabled', !enabled)}
          style={{
            ...enableButtonStyle,
            background: enabled ? '#cc3300' : '#fff',
            borderColor: enabled ? '#cc3300' : '#d6dde3',
            color: enabled ? '#fff' : '#2a3a45',
          }}
        >
          {enabled ? 'Tremie On' : 'Tremie Off'}
        </button>
      </div>

      {!enabled && (
        <div style={disabledPanelStyle}>
          Tremie pipe calculations, section stack, and break/lift recommendations are hidden.
        </div>
      )}

      {enabled && (
      <>

      <div style={guideGridStyle}>
        <div>
          <div style={miniHeaderStyle}>Foundation</div>
          {foundations.length > 0 ? (
            <div style={foundationSwitcherStyle}>
              {foundations.map((foundation, index) => {
                const active = selectedFoundationIndex === index
                return (
                  <button
                    key={`tremie-foundation-${index}`}
                    type="button"
                    onClick={() => updateGuide('selectedFoundationIndex', index)}
                    style={{
                      ...foundationButtonStyle,
                      borderColor: active ? '#cc3300' : '#d6dde3',
                      background: active ? '#fff4ef' : '#fff',
                    }}
                  >
                    <span style={foundationTitleStyle}>
                      {foundation.foundation_id || `Foundation ${index + 1}`}
                    </span>
                    <span style={foundationMetaStyle}>
                      {foundation.actual_hole_depth
                        ? `Actual ${foundation.actual_hole_depth}`
                        : foundation.total_depth
                          ? `Design ${foundation.total_depth}`
                          : 'No depth'}
                      {foundation.shaft_diameter ? ` · Dia ${foundation.shaft_diameter}` : ' · No dia'}
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div style={sourcePanelStyle}>Add a foundation above to drive tremie calculations.</div>
          )}

          <div style={sourceGridStyle}>
            <Fact
              label="Depth Used"
              value={formatFeet(parseFeet(config.shaftDepth, result.shaftDepth))}
            />
            <Fact
              label="Diameter Used"
              value={formatFeet(parseFeet(config.shaftDiameter, result.shaftDiameter))}
            />
          </div>

          <div style={compactGridStyle}>
            {[
              ['loadSize', 'Load yd3', '10'],
              ['minEmbedment', 'Min Embed', '5'],
              ['hopperHeight', 'Hopper', '3'],
            ].map(([field, label, placeholder]) => (
              <div key={field} style={fieldStyle}>
                <label style={labelStyle}>{label}</label>
                <input
                  style={inputStyle}
                  value={guide[field]}
                  placeholder={placeholder}
                  onChange={event => updateGuide(field, event.target.value)}
                />
              </div>
            ))}
          </div>

          <div style={factsGridStyle}>
            <Fact label="Rise / Load" value={formatFeet(result.risePerLoad)} />
            <Fact label="Shaft Volume" value={formatYards(result.shaftVolume)} />
            <Fact label="Loads" value={String(result.loadsToFill)} />
            <Fact label="Pipe On Hand" value={formatFeet(result.totalPipeLength)} />
          </div>
        </div>

        <div>
          <div style={miniHeaderStyle}>Tremie Position</div>
          <PipeStack result={result} selectedStep={selectedStep} />
        </div>
      </div>

      {selectedStep && (
        <div style={calloutStyle(selectedStep.action)}>
          <div>
            <div style={calloutActionStyle}>{selectedStep.action}</div>
            <div style={calloutReasonStyle}>
              {selectedStep.truckLabel}{selectedStep.truckId ? ` · ID ${selectedStep.truckId}` : ''} · {selectedStep.reason}
            </div>
            <div style={calloutReasonStyle}>
              Highest hopper at min embed: {formatRelativeToConcrete(selectedStep.highestSafeHopperToConcrete)}
            </div>
          </div>
          <div style={calloutEmbedStyle}>
            Embed {formatFeet(selectedStep.embedment)}
          </div>
        </div>
      )}

      <div style={fieldStyle}>
        <label style={labelStyle}>Truck Step</label>
        <input
          type="range"
          min="0"
          max={Math.max(0, result.steps.length - 1)}
          value={selectedStepIndex}
          onChange={event => setSelectedStepIndex(Number(event.target.value))}
          style={rangeStyle}
        />
      </div>

      <div style={tableWrapStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Truck</th>
              <th style={thStyle}>Calc</th>
              <th style={thStyle}>Concrete</th>
              <th style={thStyle}>Pipe Bottom</th>
              <th style={thStyle}>Embed</th>
              <th style={thStyle}>Sections</th>
              <th style={thStyle}>Max Hopper</th>
              <th style={thStyle}>Break Pipe</th>
              <th style={thStyle}>Actual</th>
            </tr>
          </thead>
          <tbody>
            {result.steps.map((step, index) => (
              <tr
                key={`tremie-step-${index}`}
                onClick={() => setSelectedStepIndex(index)}
                style={{
                  ...trStyle,
                  background: selectedStepIndex === index ? '#fff4ef' : '#fff',
                }}
              >
                <td style={tdStyle}>{step.truckLabel}</td>
                <td style={tdStyle}>{step.action}</td>
                <td style={tdStyle}>{formatFeet(step.concreteSurfaceDepth)}</td>
                <td style={tdStyle}>{formatFeet(step.pipeBottomDepth)}</td>
                <td style={{ ...tdStyle, color: step.belowMinimum ? '#9b1c1c' : '#17603a', fontWeight: '800' }}>
                  {formatFeet(step.embedment)}
                </td>
                <td style={tdStyle}>{step.remainingSections.length}</td>
                <td style={tdStyle}>
                  <div>{formatRelativeToConcrete(step.highestSafeHopperToConcrete)}</div>
                  <div style={tdSubtleStyle}>{formatRelativeToToc(step.highestSafeHopperTopDepth)}</div>
                </td>
                <td style={tdStyle} onClick={event => event.stopPropagation()}>
                  <label style={tableCheckStyle}>
                    <input
                      type="checkbox"
                      checked={guide.breakPipeByTruck?.[index] === true}
                      onChange={event => updateBreakPipeForTruck(index, event.target.checked)}
                    />
                    Break
                  </label>
                </td>
                <td style={tdStyle} onClick={event => event.stopPropagation()}>
                  <select
                    style={smallInputStyle}
                    value={guide.actualActions?.[index]?.action || ''}
                    onChange={event => updateActualAction(index, 'action', event.target.value)}
                  >
                    <option value="">-</option>
                    <option value="break">Break</option>
                    <option value="lift">Lift</option>
                    <option value="hold">Hold</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={miniHeaderStyle}>Sections</div>
      <div style={sectionEditorStyle}>
        {guide.sections.map((section, index) => (
          <div key={`tremie-section-${index}`} style={sectionRowStyle}>
            <span style={sectionNumberStyle}>{index + 1}</span>
            <input
              style={smallInputStyle}
              value={section.ft}
              inputMode="decimal"
              onChange={event => updateSection(index, 'ft', event.target.value)}
            />
            <span style={unitStyle}>ft</span>
            <input
              style={smallInputStyle}
              value={section.in}
              inputMode="decimal"
              onChange={event => updateSection(index, 'in', event.target.value)}
            />
            <span style={unitStyle}>in</span>
            <button type="button" onClick={() => removeSection(index)} style={smallButtonStyle}>
              Remove
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={addBottomSection} style={addSectionButtonStyle}>
        Add Bottom Section
      </button>
      </>
      )}
    </div>
  )
}

function Fact({ label, value }) {
  return (
    <div style={factStyle}>
      <div style={factLabelStyle}>{label}</div>
      <div style={factValueStyle}>{value}</div>
    </div>
  )
}

function PipeStack({ result, selectedStep }) {
  const step = selectedStep || {
    concreteSurfaceDepth: result.shaftDepth,
    pipeBottomDepth: result.shaftDepth,
    pipeTopDepth: 0,
    hopperTopDepth: -result.hopperHeight,
    embedment: 0,
    remainingPipeLength: result.totalPipeLength,
    remainingSections: result.sections,
  }
  const pipeTopDepth = Number.isFinite(step.pipeTopDepth)
    ? step.pipeTopDepth
    : step.pipeBottomDepth - (step.remainingPipeLength || 0)
  const hopperTopDepth = Number.isFinite(step.hopperTopDepth)
    ? step.hopperTopDepth
    : pipeTopDepth - result.hopperHeight
  const hopperBottomDepth = pipeTopDepth
  const highestSafeHopperTopDepth = Number.isFinite(step.highestSafeHopperTopDepth)
    ? step.highestSafeHopperTopDepth
    : hopperTopDepth
  const highestSafeHopperToConcrete = Number.isFinite(step.highestSafeHopperToConcrete)
    ? step.highestSafeHopperToConcrete
    : highestSafeHopperTopDepth - step.concreteSurfaceDepth
  const minVisibleDepth = Math.min(-6, hopperTopDepth - 2, highestSafeHopperTopDepth - 2)
  const maxVisibleDepth = Math.max(result.shaftDepth, step.pipeBottomDepth, step.concreteSurfaceDepth) + 1
  const depthRange = Math.max(1, maxVisibleDepth - minVisibleDepth)
  const yForDepth = (depth) => `${Math.max(0, Math.min(100, ((depth - minVisibleDepth) / depthRange) * 100))}%`
  const heightBetween = (topDepth, bottomDepth) => `${Math.max(0, ((bottomDepth - topDepth) / depthRange) * 100)}%`
  const minEmbedDepth = step.concreteSurfaceDepth + result.minEmbedment
  const embedOk = step.embedment >= result.minEmbedment
  const visibleSections = step.remainingSections || result.sections
  const brokenCount = Math.max(0, result.sections.length - visibleSections.length)
  let nextSectionTopDepth = pipeTopDepth
  const sectionSegments = [...visibleSections].reverse().map(section => {
    const topDepth = nextSectionTopDepth
    const bottomDepth = topDepth + section.length
    nextSectionTopDepth = bottomDepth
    return { ...section, topDepth, bottomDepth }
  })

  return (
    <div style={stackPanelStyle}>
      <div style={stackWrapStyle}>
        <div style={{ ...shaftWallStyle, top: yForDepth(0), height: heightBetween(0, result.shaftDepth) }} />
        <div style={{ ...concreteFillStyle, top: yForDepth(step.concreteSurfaceDepth), height: heightBetween(step.concreteSurfaceDepth, result.shaftDepth) }} />
        <div style={{ ...minimumEmbedBandStyle, top: yForDepth(step.concreteSurfaceDepth), height: heightBetween(step.concreteSurfaceDepth, Math.min(result.shaftDepth, minEmbedDepth)) }} />
        <div style={{ ...minEmbedLineStyle, top: yForDepth(Math.min(result.shaftDepth, minEmbedDepth)) }}>
          <span>Min Embed</span>
          <strong>{formatFeet(result.minEmbedment)}</strong>
        </div>
        <div style={{ ...tocLineStyle, top: yForDepth(0) }}>
          <span>TOC</span>
          <strong>0 ft</strong>
        </div>
        <div style={{ ...concreteLineStyle, top: yForDepth(step.concreteSurfaceDepth) }}>
          <span>Concrete</span>
          <strong>{formatFeet(step.concreteSurfaceDepth)}</strong>
        </div>
        <div style={{ ...safeHopperLineStyle, top: yForDepth(highestSafeHopperTopDepth) }}>
          <span>Max Hopper</span>
          <strong>{formatRelativeToConcrete(highestSafeHopperToConcrete)}</strong>
        </div>
        <div style={{ ...pipeLineStyle, top: yForDepth(pipeTopDepth), height: heightBetween(pipeTopDepth, step.pipeBottomDepth) }} />
        {sectionSegments.map(segment => (
          <div
            key={`visible-section-${segment.index}`}
            style={{
              ...pipeSectionSegmentStyle,
              top: yForDepth(segment.topDepth),
              height: heightBetween(segment.topDepth, segment.bottomDepth),
            }}
          >
            S{segment.index + 1}
          </div>
        ))}
        <div style={{ ...pipeBottomDotStyle, top: yForDepth(step.pipeBottomDepth), background: embedOk ? '#17603a' : '#9b1c1c' }} />
        <div style={{ ...pipeBottomPointerStyle, top: yForDepth(step.pipeBottomDepth), borderColor: embedOk ? '#17603a' : '#9b1c1c' }} />
        <div style={{ ...pipeBottomMarkerStyle, top: yForDepth(step.pipeBottomDepth), color: embedOk ? '#17603a' : '#9b1c1c', borderColor: embedOk ? '#17603a' : '#9b1c1c' }}>
          <span>Pipe Bottom</span>
          <strong>{formatFeet(step.pipeBottomDepth)}</strong>
        </div>
        <div style={{ ...hopperBoxStyle, top: yForDepth(hopperTopDepth), height: heightBetween(hopperTopDepth, hopperBottomDepth) }}>
          <span>Hopper</span>
          <strong>{formatFeet(hopperTopDepth)}</strong>
        </div>
      </div>
      <div style={stackLegendStyle}>
        <div style={legendItemStyle}>
          <span style={{ ...legendSwatchStyle, background: '#2c7a7b' }} />
          Concrete level
        </div>
        <div style={legendItemStyle}>
          <span style={{ ...legendSwatchStyle, background: embedOk ? '#17603a' : '#9b1c1c' }} />
          Embed {formatFeet(step.embedment)}
        </div>
        <div style={legendItemStyle}>
          <span style={{ ...legendSwatchStyle, background: '#b53a0f' }} />
          Max hopper {formatRelativeToConcrete(highestSafeHopperToConcrete)}
        </div>
        <div style={legendItemStyle}>
          <span style={{ ...legendSwatchStyle, background: '#17394d' }} />
          Sections left {visibleSections.length}
        </div>
        {brokenCount > 0 && (
          <div style={legendItemStyle}>
            <span style={{ ...legendSwatchStyle, background: '#cfd8df' }} />
            Broken {brokenCount}
          </div>
        )}
      </div>
    </div>
  )
}

const guideGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.45fr) minmax(220px, .75fr)',
  gap: '1rem',
  alignItems: 'start',
}

const toggleHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '1rem',
  flexWrap: 'wrap',
}

const toggleSummaryStyle = {
  color: '#60717d',
  fontSize: '.85rem',
  fontWeight: '700',
  marginTop: '.35rem',
}

const enableButtonStyle = {
  minHeight: '42px',
  border: '2px solid #d6dde3',
  borderRadius: '8px',
  padding: '.6rem .85rem',
  fontSize: '.86rem',
  fontWeight: '900',
  cursor: 'pointer',
}

const disabledPanelStyle = {
  marginTop: '1rem',
  border: '1px dashed #cfd8df',
  borderRadius: '8px',
  padding: '.85rem',
  color: '#60717d',
  background: '#fbfcfd',
  fontSize: '.88rem',
  fontWeight: '700',
}

const compactGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(116px, 1fr))',
  gap: '.75rem',
}

const foundationSwitcherStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: '.55rem',
  marginBottom: '.8rem',
}

const foundationButtonStyle = {
  minHeight: '66px',
  border: '2px solid #d6dde3',
  borderRadius: '8px',
  background: '#fff',
  padding: '.6rem .7rem',
  textAlign: 'left',
  cursor: 'pointer',
}

const foundationTitleStyle = {
  display: 'block',
  color: '#172a3a',
  fontWeight: '900',
  fontSize: '.86rem',
  marginBottom: '.18rem',
}

const foundationMetaStyle = {
  display: 'block',
  color: '#60717d',
  fontWeight: '800',
  fontSize: '.74rem',
  lineHeight: 1.35,
}

const sourceGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
  gap: '.6rem',
  marginBottom: '.8rem',
}

const sourcePanelStyle = {
  border: '1px dashed #cfd8df',
  borderRadius: '8px',
  padding: '.75rem',
  color: '#60717d',
  background: '#fbfcfd',
  fontSize: '.84rem',
  fontWeight: '800',
  marginBottom: '.8rem',
}

const miniHeaderStyle = {
  color: '#172a3a',
  fontWeight: '800',
  fontSize: '.9rem',
  marginBottom: '.75rem',
}

const factsGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
  gap: '.6rem',
}

const factStyle = {
  border: '1px solid #dfe6eb',
  borderRadius: '8px',
  padding: '.65rem',
  background: '#fbfcfd',
}

const factLabelStyle = {
  color: '#60717d',
  fontSize: '.72rem',
  fontWeight: '800',
  textTransform: 'uppercase',
}

const factValueStyle = {
  color: '#172a3a',
  fontSize: '1.05rem',
  fontWeight: '900',
  marginTop: '.2rem',
}

const stackPanelStyle = {
  display: 'grid',
  gap: '.55rem',
}

const stackWrapStyle = {
  position: 'relative',
  minHeight: '430px',
  border: '1px solid #dfe6eb',
  borderRadius: '8px',
  background: 'linear-gradient(180deg, #f8fafb 0%, #f3f6f8 100%)',
  padding: '.75rem',
  overflow: 'hidden',
}

const shaftWallStyle = {
  position: 'absolute',
  left: '34%',
  width: '32%',
  borderLeft: '3px solid #8797a3',
  borderRight: '3px solid #8797a3',
  background: 'rgba(255,255,255,.76)',
  boxShadow: 'inset 0 0 0 1px rgba(135,151,163,.16)',
}

const concreteFillStyle = {
  position: 'absolute',
  left: '34%',
  width: '32%',
  background: 'rgba(44,122,123,.22)',
  borderTop: '2px solid #2c7a7b',
  borderLeft: '3px solid #8797a3',
  borderRight: '3px solid #8797a3',
}

const minimumEmbedBandStyle = {
  position: 'absolute',
  left: '34%',
  width: '32%',
  background: 'rgba(23,96,58,.12)',
  borderBottom: '2px dashed #17603a',
  pointerEvents: 'none',
}

const minEmbedLineStyle = {
  position: 'absolute',
  left: '.75rem',
  right: '.75rem',
  borderTop: '2px dashed #17603a',
  color: '#17603a',
  display: 'flex',
  justifyContent: 'space-between',
  gap: '.5rem',
  paddingTop: '.15rem',
  fontSize: '.68rem',
  fontWeight: '900',
  zIndex: 5,
}

const tocLineStyle = {
  position: 'absolute',
  left: '.75rem',
  right: '.75rem',
  borderTop: '2px solid #7a1212',
  color: '#7a1212',
  display: 'flex',
  justifyContent: 'space-between',
  gap: '.5rem',
  paddingTop: '.15rem',
  fontSize: '.72rem',
  fontWeight: '900',
  zIndex: 4,
}

const concreteLineStyle = {
  position: 'absolute',
  left: '.75rem',
  right: '.75rem',
  borderTop: '2px solid #2c7a7b',
  color: '#17606a',
  display: 'flex',
  justifyContent: 'space-between',
  gap: '.5rem',
  paddingTop: '.15rem',
  fontSize: '.72rem',
  fontWeight: '900',
  zIndex: 5,
}

const safeHopperLineStyle = {
  position: 'absolute',
  left: '.75rem',
  right: '.75rem',
  borderTop: '2px dashed #b53a0f',
  color: '#8f2c0b',
  display: 'flex',
  justifyContent: 'space-between',
  gap: '.5rem',
  paddingTop: '.15rem',
  fontSize: '.68rem',
  fontWeight: '900',
  zIndex: 6,
}

const pipeLineStyle = {
  position: 'absolute',
  left: '50%',
  width: '8px',
  transform: 'translateX(-50%)',
  background: '#17394d',
  borderRadius: '999px',
  boxShadow: '0 0 0 2px rgba(23,57,77,.12)',
  zIndex: 6,
}

const pipeSectionSegmentStyle = {
  position: 'absolute',
  left: '50%',
  width: '34px',
  minHeight: '16px',
  transform: 'translateX(-50%)',
  border: '1px solid rgba(255,255,255,.72)',
  borderRadius: '6px',
  background: '#17394d',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  fontSize: '.62rem',
  fontWeight: '950',
  lineHeight: 1,
  boxShadow: '0 1px 4px rgba(23,57,77,.22)',
  overflow: 'hidden',
  zIndex: 7,
}

const pipeBottomDotStyle = {
  position: 'absolute',
  left: '50%',
  width: '13px',
  height: '13px',
  transform: 'translate(-50%, -50%)',
  border: '2px solid #fff',
  borderRadius: '999px',
  boxShadow: '0 1px 4px rgba(22,35,45,.22)',
  zIndex: 9,
}

const pipeBottomPointerStyle = {
  position: 'absolute',
  left: '51%',
  width: '17%',
  transform: 'translateY(-50%)',
  borderTop: '2px solid',
  zIndex: 8,
}

const pipeBottomMarkerStyle = {
  position: 'absolute',
  right: '.55rem',
  width: '86px',
  transform: 'translateY(-50%)',
  border: '1px solid',
  borderRadius: '8px',
  background: 'rgba(255,255,255,.94)',
  padding: '.3rem .38rem',
  textAlign: 'center',
  fontSize: '.62rem',
  fontWeight: '900',
  boxShadow: '0 2px 7px rgba(22,35,45,.12)',
  zIndex: 9,
}

const hopperBoxStyle = {
  position: 'absolute',
  left: '50%',
  minHeight: '26px',
  width: '96px',
  transform: 'translateX(-50%)',
  background: '#b53a0f',
  color: '#fff',
  clipPath: 'polygon(6% 0, 94% 0, 76% 100%, 24% 100%)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '.18rem .35rem',
  textAlign: 'center',
  fontSize: '.68rem',
  fontWeight: '900',
  zIndex: 9,
}

const stackLegendStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
  gap: '.35rem',
  padding: '.5rem',
  border: '1px solid #dfe6eb',
  borderRadius: '8px',
  background: '#fff',
  color: '#40515d',
  fontSize: '.7rem',
  fontWeight: '900',
}

const legendItemStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '.35rem',
  minWidth: 0,
}

const legendSwatchStyle = {
  width: '10px',
  height: '10px',
  borderRadius: '999px',
  flex: '0 0 auto',
}

function calloutStyle(action) {
  const colors = {
    BREAK: ['#fff4ef', '#b53a0f'],
    LIFT: ['#edf7f7', '#17606a'],
    HOLD: ['#f7f9fb', '#40515d'],
  }[action] || ['#f7f9fb', '#40515d']

  return {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
    flexWrap: 'wrap',
    margin: '1rem 0',
    padding: '.9rem 1rem',
    border: `2px solid ${colors[1]}`,
    borderRadius: '8px',
    background: colors[0],
    color: colors[1],
  }
}

const calloutActionStyle = {
  fontSize: '1.35rem',
  fontWeight: '950',
}

const calloutReasonStyle = {
  fontSize: '.88rem',
  fontWeight: '800',
  marginTop: '.15rem',
}

const calloutEmbedStyle = {
  fontSize: '1rem',
  fontWeight: '950',
}

const rangeStyle = {
  width: '100%',
  accentColor: '#cc3300',
}

const tableWrapStyle = {
  overflowX: 'auto',
  border: '1px solid #dfe6eb',
  borderRadius: '8px',
  marginBottom: '1rem',
}

const tableStyle = {
  width: '100%',
  minWidth: '900px',
  borderCollapse: 'collapse',
  fontSize: '.82rem',
}

const thStyle = {
  textAlign: 'left',
  padding: '.55rem',
  color: '#40515d',
  background: '#f4f7f9',
  borderBottom: '1px solid #dfe6eb',
  fontWeight: '900',
}

const tdStyle = {
  padding: '.55rem',
  borderBottom: '1px solid #edf1f4',
  color: '#172a3a',
  fontWeight: '700',
}

const tdSubtleStyle = {
  color: '#60717d',
  fontSize: '.72rem',
  fontWeight: '800',
  marginTop: '.15rem',
}

const tableCheckStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '.35rem',
  color: '#324652',
  fontWeight: '900',
  cursor: 'pointer',
}

const trStyle = {
  cursor: 'pointer',
}

const smallInputStyle = {
  width: '100%',
  minWidth: '64px',
  padding: '.45rem .5rem',
  border: '1px solid #cfd8df',
  borderRadius: '8px',
  background: '#fff',
  color: '#172a3a',
  boxSizing: 'border-box',
}

const sectionEditorStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
  gap: '.55rem',
}

const sectionRowStyle = {
  display: 'grid',
  gridTemplateColumns: '28px 1fr 20px 1fr 20px auto',
  gap: '.35rem',
  alignItems: 'center',
  border: '1px solid #dfe6eb',
  borderRadius: '8px',
  padding: '.45rem',
}

const sectionNumberStyle = {
  color: '#172a3a',
  fontSize: '.8rem',
  fontWeight: '950',
}

const unitStyle = {
  color: '#60717d',
  fontSize: '.76rem',
  fontWeight: '900',
}

const smallButtonStyle = {
  border: '1px solid #d6dde3',
  borderRadius: '8px',
  background: '#fff',
  color: '#40515d',
  padding: '.45rem .55rem',
  fontSize: '.76rem',
  fontWeight: '900',
  cursor: 'pointer',
}

const addSectionButtonStyle = {
  border: '1px solid #d6dde3',
  borderRadius: '8px',
  background: '#fff',
  color: '#2a3a45',
  padding: '.65rem .8rem',
  marginTop: '.65rem',
  fontWeight: '900',
  cursor: 'pointer',
}
