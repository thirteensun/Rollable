import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin
    .from('announcements')
    .select('id, title, body, image_url, link_url, published_at')
    .eq('published', true)
    .order('published_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json([], { status: 200 })
  return NextResponse.json(data ?? [])
}
