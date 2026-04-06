import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    // 1. Verify user session
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value },
          set() {},
          remove() {},
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Use service role client to bypass RLS
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 3. Get user's org
    const { data: membership } = await admin
      .from('organisation_members')
      .select('org_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()

    const org_id = membership?.org_id || null
    const body = await request.json()
    const { aiResult } = body

    // 4. Create or find company
    let company_id = null
    if (aiResult.company_name) {
      const { data: existing } = await admin
        .from('companies')
        .select('id')
        .eq('user_id', user.id)
        .ilike('name', aiResult.company_name)
        .maybeSingle()

      if (existing) {
        company_id = existing.id
      } else {
        const { data: newCompany } = await admin
          .from('companies')
          .insert({ user_id: user.id, name: aiResult.company_name, org_id })
          .select('id')
          .maybeSingle()
        company_id = newCompany?.id
      }
    }

    // 5. Create or find contacts (multiple)
    let contact_id = null
    const allContacts = aiResult.contacts?.length
      ? aiResult.contacts
      : aiResult.contact_name ? [{ full_name: aiResult.contact_name }] : []

    for (const contactData of allContacts) {
      // Per-contact company
      let contactCompanyId = company_id
      if (contactData.company_name && contactData.company_name !== aiResult.company_name) {
        const { data: existingCo } = await admin
          .from('companies')
          .select('id')
          .eq('user_id', user.id)
          .ilike('name', contactData.company_name)
          .maybeSingle()

        if (existingCo) {
          contactCompanyId = existingCo.id
        } else {
          const { data: newCo } = await admin
            .from('companies')
            .insert({ user_id: user.id, name: contactData.company_name, org_id })
            .select('id')
            .maybeSingle()
          contactCompanyId = newCo?.id
        }
      }

      const { data: existing } = await admin
        .from('contacts')
        .select('id')
        .eq('user_id', user.id)
        .ilike('full_name', contactData.full_name)
        .maybeSingle()

      if (existing) {
        if (!contact_id) contact_id = existing.id
        await admin.from('contacts').update({
          last_contacted_at: new Date().toISOString(),
          company_id: contactCompanyId || undefined,
          role: contactData.role || undefined,
          email: contactData.email || undefined,
          phone: contactData.phone || undefined,
        }).eq('id', existing.id)
      } else {
        const { data: newContact } = await admin
          .from('contacts')
          .insert({
            user_id: user.id,
            full_name: contactData.full_name,
            company_id: contactCompanyId,
            role: contactData.role || null,
            email: contactData.email || null,
            phone: contactData.phone || null,
            last_contacted_at: new Date().toISOString(),
            org_id,
          })
          .select('id')
          .maybeSingle()
        if (!contact_id) contact_id = newContact?.id
      }
    }

    // 6. Create deal
    let deal_id = null
    if (aiResult.deal_name) {
      const { data: newDeal } = await admin
        .from('deals')
        .insert({
          user_id: user.id,
          company_id,
          name: aiResult.deal_name,
          value: aiResult.deal_value || null,
          stage: 'lead',
          last_activity_at: new Date().toISOString(),
          org_id,
        })
        .select('id')
        .maybeSingle()
      deal_id = newDeal?.id

      if (deal_id && contact_id) {
        await admin.from('deal_contacts')
          .upsert({ deal_id, contact_id }, { onConflict: 'deal_id,contact_id' })
      }
    }

    // 7. Log event
    await admin.from('events').insert({
      user_id: user.id,
      deal_id,
      contact_id,
      company_id,
      org_id,
      type: aiResult.event_type || 'meeting',
      summary: aiResult.summary,
      ai_confidence: 0.9,
      metadata: { raw_ai_result: aiResult },
    })

    // 8. Create follow-up task
    if (aiResult.follow_up_date) {
      await admin.from('tasks').insert({
        user_id: user.id,
        deal_id,
        contact_id,
        org_id,
        title: `Follow up with ${aiResult.contact_name || aiResult.company_name || 'contact'}`,
        due_date: new Date(aiResult.follow_up_date).toISOString(),
        ai_generated: true,
      })
    }

    return NextResponse.json({ success: true, contact_id, deal_id, company_id })

  } catch (error: any) {
    console.error('Save error:', error)
    return NextResponse.json({ error: error.message || 'Save failed' }, { status: 500 })
  }
}
