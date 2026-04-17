import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get(name: string) { return cookieStore.get(name)?.value }, set() {}, remove() {} } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (id) {
      // Fetch single conversation by id
      const { data: conv } = await admin
        .from('conversations')
        .select('id, title, messages, updated_at')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json({ conversation: conv })
    }

    // Fetch list of recent conversations (title + timestamp only, no messages)
    const { data: convos } = await admin
      .from('conversations')
      .select('id, title, updated_at')
      .eq('user_id', user.id)
      .eq('source', 'sandbox')
      .order('updated_at', { ascending: false })
      .limit(20)

    return NextResponse.json({ conversations: convos || [] })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
