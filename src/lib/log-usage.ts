import { createClient } from '@supabase/supabase-js'

// Pricing per million tokens (USD)
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6':          { input: 3.00,  output: 15.00 },
  'claude-haiku-4-5-20251001':  { input: 0.80,  output: 4.00  },
  'claude-opus-4-7':            { input: 15.00, output: 75.00 },
}
const DEFAULT_PRICING = { input: 3.00, output: 15.00 }

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING[model] ?? DEFAULT_PRICING
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output
}

export async function logUsage({
  orgId,
  userId,
  route,
  model,
  inputTokens,
  outputTokens,
}: {
  orgId: string | null
  userId: string
  route: string
  model: string
  inputTokens: number
  outputTokens: number
}) {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  // Fire and forget — don't block the response
  admin.from('token_usage').insert({
    org_id: orgId,
    user_id: userId,
    route,
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
  }).then(() => {})
}
