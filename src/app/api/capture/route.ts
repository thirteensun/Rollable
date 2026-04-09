import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent'

export async function POST(req: NextRequest) {
  try {
    await cookies() // Next.js requires this before createServerSupabaseClient
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { imageBase64, mimeType = 'image/jpeg' } = body

    const prompt = `You are an AI assistant for a CRM called SDM. Analyze this image and extract structured data.

DOCUMENT TYPES YOU MUST DETECT:
1. Business card → extract contact info
2. Meeting notes / whiteboard → extract contacts, deals, tasks
3. Invoice → extract invoice details and link to deal
4. Purchase Order (PO) → extract PO details and link to deal
5. Other (screenshot, email, etc.) → extract whatever CRM-relevant info exists

Respond ONLY with valid JSON in this exact format:
{
  "document_type": "business_card" | "meeting_notes" | "invoice" | "purchase_order" | "other",
  "summary": "One action-oriented sentence describing what was captured and what the CRM should do. Be specific.",
  "creates": [
    { "type": "contact", "label": "Full Name — Company" },
    { "type": "deal", "label": "Deal name — $value" },
    { "type": "task", "label": "Task description" }
  ],
  "financial_update": {
    "deal_name_hint": "Name or partial name of deal this document relates to (or null)",
    "invoice_ref": "Invoice number if present (or null)",
    "po_ref": "PO number if present (or null)",
    "invoice_date": "YYYY-MM-DD if present (or null)",
    "po_date": "YYYY-MM-DD if present (or null)",
    "amount": 0,
    "payment_status": "invoiced" | "paid" | null,
    "currency": "USD"
  }
}

Rules:
- financial_update is ONLY populated for invoice or purchase_order document types. For all others set all fields to null.
- summary must be action-oriented (e.g. "Invoice INV-2024-042 for $12,500 from Acme Corp — mark deal as invoiced")
- creates[] should be empty [] for invoice/PO documents unless they also contain new contacts
- amount should be a number (no currency symbols), 0 if not found`

    const geminiRes = await fetch(`${GEMINI_API_URL}?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: imageBase64 } }
          ]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1024 }
      })
    })

    if (!geminiRes.ok) {
      const err = await geminiRes.text()
      console.error('Gemini error:', err)
      return NextResponse.json({ error: 'Gemini API failed' }, { status: 500 })
    }

    const geminiData = await geminiRes.json()
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    // Strip markdown fences
    const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    let parsed: any
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      return NextResponse.json({ error: 'Failed to parse Gemini response', raw: rawText }, { status: 500 })
    }

    // If it's a financial document, try to auto-match to an existing deal
    let matchedDeal: any = null
    if (
      (parsed.document_type === 'invoice' || parsed.document_type === 'purchase_order') &&
      parsed.financial_update?.deal_name_hint
    ) {
      const hint = parsed.financial_update.deal_name_hint.toLowerCase()

      // Get user's org
      const { data: membership } = await supabase
        .from('organisation_members')
        .select('organisation_id')
        .eq('user_id', user.id)
        .single()

      if (membership) {
        const { data: deals } = await supabase
          .from('deals')
          .select('id, name, value, stage')
          .eq('organisation_id', membership.organisation_id)
          .not('stage', 'in', '(closed_lost)')

        // Simple fuzzy match: check if any deal name words appear in hint or vice versa
        if (deals) {
          for (const d of deals) {
            const dealWords = d.name.toLowerCase().split(/\s+/)
            const hintWords = hint.split(/\s+/)
            const overlap = dealWords.filter((w: string) => w.length > 3 && hintWords.some((h: string) => h.includes(w) || w.includes(h)))
            if (overlap.length > 0) {
              matchedDeal = d
              break
            }
          }
        }
      }
    }

    return NextResponse.json({
      ...parsed,
      matched_deal: matchedDeal ?? null,
    })

  } catch (err) {
    console.error('Capture route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
