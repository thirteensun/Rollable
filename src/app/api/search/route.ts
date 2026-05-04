import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json()
    if (!query?.trim()) return NextResponse.json({ contacts: [], deals: [], companies: [], tasks: [] })

    const supabase = await createServerSupabaseClient()
    const q = query.trim()

    const [
      { data: contacts },
      { data: deals },
      { data: companies },
      { data: tasks },
    ] = await Promise.all([
      supabase
        .from('contacts')
        .select('id, full_name, role, email, companies(name), last_contacted_at')
        .or(`full_name.ilike.%${q}%,role.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(5),

      supabase
        .from('deals')
        .select('id, name, stage, value, currency')
        .or(`name.ilike.%${q}%,stage.ilike.%${q}%`)
        .limit(5),

      supabase
        .from('companies')
        .select('id, name, industry, city')
        .or(`name.ilike.%${q}%,industry.ilike.%${q}%,city.ilike.%${q}%`)
        .limit(5),

      supabase
        .from('tasks')
        .select('id, title, status, due_date')
        .ilike('title', `%${q}%`)
        .neq('status', 'cancelled')
        .limit(5),
    ])

    return NextResponse.json({
      contacts: contacts ?? [],
      deals: deals ?? [],
      companies: companies ?? [],
      tasks: tasks ?? [],
    })
  } catch (err) {
    logger.error('search', 'Request failed', err)
    return NextResponse.json({ contacts: [], deals: [], companies: [], tasks: [] }, { status: 500 })
  }
}
