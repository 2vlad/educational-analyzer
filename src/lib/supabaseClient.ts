import { createClient } from '@supabase/supabase-js'
import { env } from '@/src/config/env'

// Create a Supabase client for client-side operations (optional, for future use)
export const supabaseClient = createClient(
  env.client.NEXT_PUBLIC_SUPABASE_URL,
  env.client.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true
    }
  }
)