import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request) {
  try {
    const { text } = await request.json()
    if (!text?.trim()) return Response.json({ polished: null })

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `You are a construction field report assistant. Rewrite the following "Work Completed Today" entry to be clear, professional, and concise. Keep all the same facts — just fix grammar, improve clarity, and use proper construction terminology. Return only the rewritten text with no explanation or preamble.

Original:
${text}`,
      }],
    })

    const polished = message.content[0]?.text?.trim()
    return Response.json({ polished: polished || null })
  } catch (err) {
    console.error('Polish error:', err)
    return Response.json({ polished: null }, { status: 500 })
  }
}
