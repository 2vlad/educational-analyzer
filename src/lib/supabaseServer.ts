import { createClient } from '@supabase/supabase-js'
import { env } from '@/src/config/env'

if (!env.isServer) {
  throw new Error('supabaseServer should only be used on the server side')
}

// Get the service key from environment
const serviceKey = env.server?.SUPABASE_SERVICE_ROLE_KEY || 
                  env.server?.SUPABASE_SERVICE_KEY || 
                  process.env.SUPABASE_SERVICE_ROLE_KEY || 
                  process.env.SUPABASE_SERVICE_KEY || ''

if (!serviceKey) {
  console.warn('⚠️ No Supabase service key found. Database operations will fail.')
}

// Create a Supabase client for server-side admin operations
export const supabaseAdmin = createClient(
  env.client.NEXT_PUBLIC_SUPABASE_URL,
  serviceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
)

// Helper function to get server-side Supabase client
export const getServerSupabase = () => supabaseAdmin
