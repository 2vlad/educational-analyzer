import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { env } from '@/src/config/env'

type GenericDatabase = Record<string, Record<string, unknown>>
type GenericSupabaseClient = SupabaseClient<GenericDatabase>

const createMissingSupabaseClient = (message: string): GenericSupabaseClient =>
  new Proxy(
    {},
    {
      get() {
        throw new Error(message)
      },
    },
  ) as GenericSupabaseClient

const supabaseUrl =
  env.client?.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey =
  env.client?.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const serviceKey =
  env.server?.SUPABASE_SERVICE_ROLE_KEY ||
  env.server?.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase browser client is not fully configured.')
  if (!supabaseUrl) {
    console.warn('   Missing NEXT_PUBLIC_SUPABASE_URL environment variable.')
  }
  if (!supabaseAnonKey) {
    console.warn('   Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable.')
  }
}

if (!serviceKey) {
  console.warn('⚠️ Supabase service client is not fully configured.')
  console.warn('   Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY environment variable.')
}

/**
 * Create a Supabase client for server-side operations with cookie-based auth
 * This client respects RLS policies based on the authenticated user
 */
export function createClient(): GenericSupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    return createMissingSupabaseClient(
      'Supabase client is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    )
  }

  const cookieStore = cookies()

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options })
        } catch {
          // The `set` method was called from a Server Component.
          // This can be ignored if middleware is refreshing user sessions.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: '', ...options })
        } catch {
          // The `delete` method was called from a Server Component.
          // This can be ignored if middleware is refreshing user sessions.
        }
      },
    },
  }) as GenericSupabaseClient
}

/**
 * Create a Supabase client for server-side operations with service role key
 * This client bypasses RLS and should be used carefully for admin operations
 */
export function createServiceClient(): GenericSupabaseClient {
  if (!supabaseUrl || !serviceKey) {
    return createMissingSupabaseClient(
      'Supabase service client is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and a Supabase service key.',
    )
  }

  return createSupabaseClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }) as GenericSupabaseClient
}
