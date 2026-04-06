import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value },
        set(name: string, value: string, options: any) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  const isAuthRoute = path.startsWith('/login') || path.startsWith('/auth')
  const isOnboarding = path.startsWith('/onboarding')

  // ── Rule 1: Not logged in ──────────────────────────────
  // Always send to login first. Never to onboarding.
  if (!user) {
    if (isAuthRoute || isOnboarding) return response // allow login + auth callback
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // ── From here: user IS logged in ──────────────────────

  // Rule 2: Logged in + on login page → go home (middleware will check org there)
  if (isAuthRoute) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Rule 3: Check org membership for all protected routes
  const { data: membership } = await supabase
    .from('organisation_members')
    .select('org_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  const hasOrg = !!membership

  // Rule 4: Has org + on onboarding → go home
  if (hasOrg && isOnboarding) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Rule 5: No org + not on onboarding → go to onboarding
  if (!hasOrg && !isOnboarding) {
    return NextResponse.redirect(new URL('/onboarding', request.url))
  }

  // Rule 6: Everything else is fine — let through
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icon-.*).*)'],
}