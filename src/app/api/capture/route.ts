import { NextRequest, NextResponse } from 'next/server'

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent'

const SYSTEM_PROMPT = `You are an AI assistant for a sales CRM. Analyze this image and extract structured sales information.

The image could be:
- A handwritten note from a meeting
- A screenshot of a WhatsApp or iMessage conversation
- An email screenshot
- A business card
- Any sales-related document or photo

Extract the following information and return ONLY valid JSON (no markdown, no backticks, just raw JSON):

{
  "summary": "A friendly, plain-English summary of what happened, written as if explaining to a colleague. 1-2 sentences max.",
  "event_type": "meeting|call|email|whatsapp|note|card_scan|other",
  "contact_name": "Full name of the person (or null if not found)",
  "company_name": "Company name (or null if not found)",
  "deal_name": "A short deal name like 'TechCorp Enterprise' (or null if no deal context)",
  "deal_value": 50000,
  "follow_up_date": "ISO date string for follow-up if mentioned, like '2026-04-10' (or null)",
  "notes": "Any additional important details like requirements, objections, next steps",
  "creates": [
    {"label": "Contact — [name]", "type": "contact"},
    {"label": "Deal — [name]", "type": "deal"},
    {"label": "Task — Follow-up [date]", "type": "task"},
    {"label": "Note — [brief description]", "type": "note"}
  ]
}

Only include items in "creates" that are actually relevant from the image.
If you cannot read the image or it has no sales-relevant content, return:
{"summary": "I couldn't extract any sales information from this image.", "event_type": "other", "creates": []}
`

export async function POST(request: NextRequest) {
  try {
    const { image, mimeType } = await request.json()

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 })
    }

    const response = await fetch(`${GEMINI_API_URL}?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: SYSTEM_PROMPT },
            {
              inline_data: {
                mime_type: mimeType || 'image/jpeg',
                data: image,
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1000,
        }
      })
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Gemini error:', err)
      return NextResponse.json({ error: 'Gemini API error' }, { status: 500 })
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    // Clean up response — remove any markdown formatting
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    try {
      const parsed = JSON.parse(clean)
      return NextResponse.json(parsed)
    } catch {
      console.error('Failed to parse Gemini response:', text)
      return NextResponse.json({
        summary: "I processed your image but couldn't extract structured data. Please try again.",
        event_type: 'other',
        creates: []
      })
    }
  } catch (error) {
    console.error('Capture API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}