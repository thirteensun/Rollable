import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30
export const dynamic = 'force-dynamic'

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent'

const SYSTEM_PROMPT = `You are an AI assistant for a sales CRM. Analyze this image and extract structured sales information.

The image could be:
- A handwritten note from a meeting
- A screenshot of a WhatsApp or iMessage conversation
- An email screenshot
- A business card
- A conference or event listing
- Any sales-related document or photo

Extract the following information and return ONLY valid JSON (no markdown, no backticks, just raw JSON):

{
  "summary": "One sentence describing what was captured, written as a CRM action note. Focus on the person and action, not the image. Examples: 'Added Jennifer Quigley-Jones, founder of Digital Voices.', 'Met Steffan Sund, District Manager at Fibo, and Annina Eskola, Sales Advisor at Fibo.', 'Captured R. Ethan Braden and two other keynote speakers from image.'",
  "event_type": "meeting|call|email|whatsapp|note|card_scan|other",
  "contact_name": "Full name of the PRIMARY contact (or null if not found)",
  "contacts": [
    {
      "full_name": "Full name of each person found",
      "role": "Their job title or position (or null if not found)",
      "company_name": "Their company name (or null if not found)",
      "email": "Their email address (or null if not found)",
      "phone": "Their phone number (or null if not found)"
    }
  ],
  "company_name": "Primary company name (or null if not found)",
  "deal_name": "A short deal name like 'TechCorp Enterprise' (or null if no deal context)",
  "deal_value": null,
  "follow_up_date": "ISO date string for follow-up if mentioned, like '2026-04-10' (or null)",
  "notes": "Any additional important details like requirements, objections, next steps",
  "creates": [
    {"label": "Contact — [name] · [role] at [company]", "type": "contact"},
    {"label": "Deal — [name]", "type": "deal"},
    {"label": "Task — Follow-up [date]", "type": "task"},
    {"label": "Note — [brief description]", "type": "note"}
  ]
}

Rules:
- Always populate the "contacts" array with every person found, including their role and company
- For business cards, extract all details: name, role, company, email, phone
- For meeting notes or chat screenshots, extract the person you spoke with
- For conference/event listings, extract all speakers with their roles and organizations
- Only include items in "creates" that are actually relevant from the image
- deal_value should be a number (e.g. 50000) or null, never a string
- If you cannot read the image or it has no relevant content, return:
{"summary": "I couldn't extract any useful information from this image.", "event_type": "other", "contacts": [], "creates": []}
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
          maxOutputTokens: 1500,
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

    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    try {
      const parsed = JSON.parse(clean)
      return NextResponse.json(parsed)
    } catch {
      console.error('Failed to parse Gemini response:', text)
      return NextResponse.json({
        summary: "I processed your image but couldn't extract structured data. Please try again.",
        event_type: 'other',
        contacts: [],
        creates: []
      })
    }
  } catch (error) {
    console.error('Capture API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}