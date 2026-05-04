import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function WaitlistPage() {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set: () => {},
        remove: () => {},
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // If they already have an org, they shouldn't be here
  const { data: membership } = await admin
    .from('organisation_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (membership) redirect('/')

  const { data: entry } = await admin
    .from('waitlist')
    .select('id, status, created_at')
    .eq('user_id', user.id)
    .maybeSingle()

  // Not on waitlist and no org — send back to onboarding
  if (!entry) redirect('/onboarding')

  const isApproved = entry.status === 'approved'

  return (
    <main style={{
      minHeight: '100dvh',
      background: '#f5f4f0',
      display: 'flex',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        margin: '0 auto',
        minHeight: 'min(760px, calc(100dvh - 48px))',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '40px 0 24px',
      }}>
        <div>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 56" height="32" style={{ marginBottom: '40px' }}>
            <text y="44" fontFamily="Inter, -apple-system, BlinkMacSystemFont, sans-serif" fontSize="40" letterSpacing="-1">
              <tspan fontWeight="700" fill="#1a1a18">Roll</tspan>
              <tspan fontWeight="300" fill="#9b9890">able</tspan>
            </text>
          </svg>

          {isApproved ? (
            <div>
              <div style={{
                width: '52px', height: '52px', borderRadius: '16px',
                background: '#E1F5EE', display: 'flex', alignItems: 'center',
                justifyContent: 'center', marginBottom: '28px',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M20 6L9 17l-5-5" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h1 style={{ margin: '0 0 12px', fontSize: '28px', fontWeight: 500, color: '#1a1a18', lineHeight: 1.2 }}>
                You&rsquo;re approved!
              </h1>
              <p style={{ margin: '0 0 32px', fontSize: '16px', color: '#9b9890', lineHeight: 1.6 }}>
                Your spot is ready. Set up your workspace and let&rsquo;s get started.
              </p>
              <a href="/onboarding" style={{
                display: 'block', width: '100%', padding: '16px',
                fontSize: '16px', fontWeight: 500, color: 'white',
                background: '#1a1a18', border: 'none', borderRadius: '22px',
                cursor: 'pointer', textAlign: 'center', textDecoration: 'none',
                boxSizing: 'border-box',
              }}>
                Create my workspace
              </a>
            </div>
          ) : (
            <div>
              <div style={{
                width: '52px', height: '52px', borderRadius: '16px',
                background: '#F0EFEB', display: 'flex', alignItems: 'center',
                justifyContent: 'center', marginBottom: '28px',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="#6b6960" strokeWidth="1.5" />
                  <path d="M12 7v5l3 3" stroke="#6b6960" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <h1 style={{ margin: '0 0 12px', fontSize: '28px', fontWeight: 500, color: '#1a1a18', lineHeight: 1.2 }}>
                You&rsquo;re on the list.
              </h1>
              <p style={{ margin: '0 0 8px', fontSize: '16px', color: '#9b9890', lineHeight: 1.6 }}>
                We&rsquo;re in early access and approving users manually. We&rsquo;ll reach out to <strong style={{ color: '#1a1a18', fontWeight: 500 }}>{user.email}</strong> when your spot is ready.
              </p>
              <p style={{ margin: '0 0 32px', fontSize: '14px', color: '#c8c5be', lineHeight: 1.5 }}>
                No action needed — sit tight.
              </p>

              <div style={{
                background: 'white', borderRadius: '16px',
                border: '0.5px solid rgba(0,0,0,0.07)', padding: '18px 20px',
                display: 'flex', alignItems: 'center', gap: '14px',
              }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  background: '#f5f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="#6b6960" strokeWidth="1.5" strokeLinecap="round" />
                    <circle cx="12" cy="7" r="4" stroke="#6b6960" strokeWidth="1.5" />
                  </svg>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: '#1a1a18' }}>Registered as</p>
                  <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#9b9890' }}>{user.email}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <p style={{ margin: 0, fontSize: '12px', color: '#c8c5be', textAlign: 'center' }}>
          rollable app
        </p>
      </div>
    </main>
  )
}
