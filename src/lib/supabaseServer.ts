import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from '@/src/config/env'

if (!env.isServer) {
  throw new Error('supabaseServer should only be used on the server side')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GenericSupabaseClient = SupabaseClient<any, any, any>

// Get the service key from environment
const serviceKey =
  env.server?.SUPABASE_SERVICE_ROLE_KEY ||
  env.server?.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  ''

const supabaseUrl =
  env.client?.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''

const createMissingSupabaseClient = (message: string): GenericSupabaseClient =>
  new Proxy(
    {},
    {
      get() {
        throw new Error(message)
      },
    },
  ) as GenericSupabaseClient

if (!serviceKey || !supabaseUrl) {
  console.warn('⚠️ Supabase admin client is not fully configured.')
  if (!supabaseUrl) {
    console.warn('   Missing NEXT_PUBLIC_SUPABASE_URL environment variable.')
  }
  if (!serviceKey) {
    console.warn(
      '   Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY environment variable.',
    )
  }
}

// Create a Supabase client for server-side admin operations
export const supabaseAdmin =
  serviceKey && supabaseUrl
    ? createClient(supabaseUrl, serviceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : createMissingSupabaseClient(
        'Supabase admin client is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and a Supabase service key.',
      )

// Helper function to get server-side Supabase client
export const getServerSupabase = () => supabaseAdmin
