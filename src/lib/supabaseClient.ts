import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from '@/src/config/env'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GenericSupabaseClient = SupabaseClient<any, any, any>

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

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase client is not fully configured for browser usage.')
}

// Create a Supabase client for client-side operations (optional, for future use)
export const supabaseClient =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
        },
      })
    : createMissingSupabaseClient(
        'Supabase client is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
      )
