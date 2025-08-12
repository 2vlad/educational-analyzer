import { createClient } from '@supabase/supabase-js'
import { env } from '@/config/env'

if (!env.isServer) {
  throw new Error('supabaseServer should only be used on the server side')
}

// Create a Supabase client for server-side admin operations
export const supabaseAdmin = createClient(
  env.client.NEXT_PUBLIC_SUPABASE_URL,
  env.server!.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// Helper function to get server-side Supabase client
export const getServerSupabase = () => supabaseAdmin