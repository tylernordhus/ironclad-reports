import Anthropic from '@anthropic-ai/sdk'
import { getUserId } from '@/lib/get-user-id'
import { normalizeHandwrittenImportDraft } from '@/lib/pour-log-handwritten-import'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const model = 'claude-sonnet-4-5-20250929'

const extractionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    project_name: { type: 'string' },
    log_date: { type: 'string' },
    weather: { type: 'string' },
    ambient_temp: { type: 'string' },
    concrete_supplier: { type: 'string' },
    submitted_by: { type: 'string' },
    foundations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          foundation_id: { type: 'string' },
          total_depth: { type: 'string' },
          actual_hole_depth: { type: 'string' },
          estimated_yards: { type: 'string' },
          shaft_diameter: { type: 'string' },
          anchor_bolt_projection: { type: 'string' },
          notes: { type: 'string' },
        },
        required: [
          'foundation_id',
          'total_depth',
          'actual_hole_depth',
          'estimated_yards',
          'shaft_diameter',
          'anchor_bolt_projection',
          'notes',
        ],
      },
    },
    trucks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          truck_number: { type: 'string' },
          batch_time: { type: 'string' },
          arrival_time: { type: 'string' },
          pour_start: { type: 'string' },
          pour_complete: { type: 'string' },
          yards: { type: 'string' },
          rejected: { type: 'boolean' },
          foundations_served: {
            type: 'array',
            items: { type: 'string' },
          },
          shaft_depths: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                foundation_id: { type: 'string' },
                finish_depth: { type: 'string' },
              },
              required: [
                'foundation_id',
                'finish_depth',
              ],
            },
          },
          estimated_leftover_yards: { type: 'string' },
          concrete_temp: { type: 'string' },
          slump: { type: 'string' },
          air_content: { type: 'string' },
          water_added: { type: 'string' },
          cylinders_cast: { type: 'string' },
          notes: { type: 'string' },
        },
        required: [
          'truck_number',
          'batch_time',
          'arrival_time',
          'pour_start',
          'pour_complete',
          'yards',
          'rejected',
          'foundations_served',
          'shaft_depths',
          'estimated_leftover_yards',
          'concrete_temp',
          'slump',
          'air_content',
          'water_added',
          'cylinders_cast',
          'notes',
        ],
      },
    },
    remarks_issues: { type: 'string' },
    review_notes: {
      type: 'array',
      items: { type: 'string' },
    },
    low_confidence_fields: {
      type: 'array',
      items: { type: 'string' },
    },
    missing_fields: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: [
    'project_name',
    'log_date',
    'weather',
    'ambient_temp',
    'concrete_supplier',
    'submitted_by',
    'foundations',
    'trucks',
    'remarks_issues',
    'review_notes',
    'low_confidence_fields',
    'missing_fields',
  ],
}

const outputFormat = {
  type: 'json_schema',
  schema: extractionSchema,
  parse: JSON.parse,
}

function buildPrompt() {
  return [
    'You are extracting a handwritten drilled shaft concrete pour log from a single printed field sheet.',
    'Return only data that is visible on the sheet. Do not guess. If a field is unclear, return an empty string and add that field name to low_confidence_fields.',
    'Normalize the response to the JSON schema exactly.',
    'Rules:',
    '- Process the truck sections in the order they appear on the page from top to bottom.',
    '- Each truck section has its own TRUCK NO., BATCH TIME, ARRIVAL TIME, POUR START, and POUR COMPLETE fields. Read each truck section independently and do not reuse times from another truck.',
    '- truck_number must be only the value written in the TRUCK NO. field, not the printed section label like "Concrete Truck 1" or "Truck #2".',
    '- log_date must be YYYY-MM-DD when confidently readable, otherwise "".',
    '- batch_time, arrival_time, pour_start, and pour_complete must be HH:MM in 24-hour time when confidently readable, otherwise "".',
    '- If any truck time is visible in its field, put it in the matching structured time field instead of leaving it blank. This especially applies to trucks after the first one.',
    '- Keep design depth, actual depth, shaft diameter, and anchor bolt projection as plain text exactly as written when possible.',
    '- estimated_yards, yards, temp, slump, air_content, water_added, cylinders_cast, and estimated_leftover_yards should be short plain strings without added commentary.',
    '- Foundations Served and Finished Depth are separate fields on the form. Put shaft IDs only in foundations_served, and put finished depth values only in shaft_depths entries with foundation_id and finish_depth.',
    '- Do not repeat structured foundation IDs, finish depths, or time values inside truck.notes if they were already captured in dedicated fields.',
    '- rejected should only be true if the sheet clearly marks the truck as rejected.',
    '- Put any W/C ratio or extra truck comments into truck.notes.',
    '- Put unmapped bottom-of-page remarks into remarks_issues.',
    '- review_notes must always include a reminder that the user should verify the import before saving.',
    '- missing_fields should include important blanks that appear to be unfilled on the paper.',
    'This output will be used to prefill a form, not auto-save it.',
  ].join('\n')
}

function getFileExtensionType(file) {
  const type = String(file?.type || '').toLowerCase()
  if (type === 'application/pdf') return 'pdf'
  if (type === 'image/jpeg' || type === 'image/png' || type === 'image/gif' || type === 'image/webp') return 'image'
  return 'unsupported'
}

async function fileToClaudeBlock(file) {
  const bytes = Buffer.from(await file.arrayBuffer())
  const kind = getFileExtensionType(file)

  if (kind === 'pdf') {
    return {
      type: 'document',
      title: file.name || 'handwritten-pour-log.pdf',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: bytes.toString('base64'),
      },
    }
  }

  if (kind === 'image') {
    return {
      type: 'image',
      source: {
        type: 'base64',
        media_type: String(file.type).toLowerCase(),
        data: bytes.toString('base64'),
      },
    }
  }

  throw new Error('Unsupported file type. Please upload a JPG, PNG, WEBP, GIF, or PDF scan.')
}

function buildReviewNotes(draft) {
  const notes = [
    'Check the imported handwriting against the paper form before saving.',
    ...draft.review_notes,
  ]

  if (draft.remarks_issues) {
    notes.push('Remarks / issues were captured separately and may need to be copied into notes fields.')
  }

  return Array.from(new Set(notes.filter(Boolean)))
}

export async function POST(request) {
  try {
    const userId = await getUserId()
    if (!userId) {
      return new Response('Unauthorized', { status: 401 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json(
        { error: 'Handwritten import is not configured yet.' },
        { status: 500 }
      )
    }

    const formData = await request.formData()
    const files = formData.getAll('files').filter(file => file && typeof file.arrayBuffer === 'function')

    if (files.length === 0) {
      return Response.json({ error: 'Upload one scanned form image or PDF.' }, { status: 400 })
    }

    if (files.length > 1) {
      return Response.json(
        { error: 'Upload one form at a time for the most reliable import.' },
        { status: 400 }
      )
    }

    const contentBlock = await fileToClaudeBlock(files[0])

    const message = await anthropic.messages.parse({
      model,
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: buildPrompt() },
          contentBlock,
        ],
      }],
      output_config: {
        format: outputFormat,
      },
    })

    const draft = normalizeHandwrittenImportDraft(message.parsed_output || {})
    const review_notes = buildReviewNotes(draft)

    return Response.json({
      draft: {
        ...draft,
        review_notes,
      },
      guidance: 'Review the imported fields carefully before saving. Handwriting and photo angle can cause mistakes.',
    }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    })
  } catch (error) {
    console.error('Handwritten pour log import failed:', error)
    return Response.json(
      { error: error?.message || 'Handwritten import failed.' },
      { status: 500 }
    )
  }
}
