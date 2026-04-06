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

  const isPublic = path.startsWith('/login') || path.startsWith('/auth')
  const isOnboarding = path.startsWith('/onboarding')

  // Not logged in → login
  if (!user && !isPublic && !isOnboarding) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Not logged in + on onboarding → login
  if (!user && isOnboarding) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Logged in + on login → home
  if (user && isPublic) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Logged in + not on onboarding → check org
  if (user && !isOnboarding && !isPublic) {
    const { data: membership } = await supabase
      .from('organisation_members')
      .select('org_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()

    if (!membership) {
      return NextResponse.redirect(new URL('/onboarding', request.url))
    }
  }

  // Logged in + on onboarding + already has org → home
  if (user && isOnboarding) {
    const { data: membership } = await supabase
      .from('organisation_members')
      .select('org_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()

    if (membership) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icon-.*).*)'],
}