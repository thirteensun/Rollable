import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
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
  const isWaitlist = path.startsWith('/waitlist')
  const isAdmin = path.startsWith('/admin')
  const isApi = path.startsWith('/api/')

  if (!user) {
    if (isAuthRoute || isOnboarding || isWaitlist) return response
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (isAuthRoute) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Admin page: let through — page.tsx handles its own auth check
  if (isAdmin) return response

  // API routes handle their own auth — never redirect them
  if (isApi) return response

  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: membership } = await adminSupabase
    .from('organisation_members')
    .select('org_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  const hasOrg = !!membership

  if (hasOrg && (isOnboarding || isWaitlist)) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  if (!hasOrg && !isOnboarding && !isWaitlist) {
    return NextResponse.redirect(new URL('/onboarding', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icon-.*).*)'],
}
