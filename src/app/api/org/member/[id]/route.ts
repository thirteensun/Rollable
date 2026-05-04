import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const VALID_ROLES = ['member', 'manager']

async function getCallerMembership(supabase: any, admin: any, userId: string, memberId: string) {
  // Find the org this member belongs to
  const { data: target } = await admin
    .from('organisation_members')
    .select('org_id, role, user_id')
    .eq('id', memberId)
    .maybeSingle()

  if (!target) return { target: null, callerRole: null }

  const { data: caller } = await admin
    .from('organisation_members')
    .select('role')
    .eq('user_id', userId)
    .eq('org_id', target.org_id)
    .eq('status', 'active')
    .maybeSingle()

  return { target, callerRole: caller?.role ?? null }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { role } = await req.json()
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { target, callerRole } = await getCallerMembership(admin, admin, user.id, params.id)
  if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  if (callerRole !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (target.role === 'admin') return NextResponse.json({ error: 'Cannot change admin role' }, { status: 403 })

  const { error } = await admin
    .from('organisation_members')
    .update({ role })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { target, callerRole } = await getCallerMembership(admin, admin, user.id, params.id)
  if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  if (callerRole !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (target.role === 'admin') return NextResponse.json({ error: 'Cannot remove the org admin' }, { status: 403 })

  const { error } = await admin
    .from('organisation_members')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
