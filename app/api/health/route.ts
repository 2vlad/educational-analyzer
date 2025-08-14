import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/src/config/supabase'
import { env } from '@/src/config/env'

export async function GET() {
  const health: Record<string, any> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    checks: {},
  }

  // Check environment variables
  health.checks.env = {
    hasAnthropicKey: !!env.server?.ANTHROPIC_API_KEY,
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    hasSupabaseServiceKey: !!env.server?.SUPABASE_SERVICE_KEY,
    hasYandexKey: !!env.server?.YANDEX_API_KEY,
    defaultModel: env.server?.DEFAULT_MODEL || 'not set',
  }

  // Check database connectivity
  try {
    const { error } = await supabaseAdmin.from('analyses').select('count').limit(1)

    health.checks.database = {
      connected: !error,
      error: error?.message || null,
    }
  } catch (dbError) {
    health.checks.database = {
      connected: false,
      error: dbError instanceof Error ? dbError.message : 'Unknown error',
    }
  }

  // Overall status
  health.status = health.checks.database.connected ? 'healthy' : 'degraded'

  return NextResponse.json(health)
}
