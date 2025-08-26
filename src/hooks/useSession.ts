'use client'

import { useEffect, useState } from 'react'
import { Session } from '@supabase/supabase-js'
import { createClient } from '@/src/lib/supabase/client'

/**
 * Hook to get the current session
 * Automatically updates when auth state changes
 */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const supabase = createClient()

    // Get initial session
    const getSession = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()
        if (error) throw error
        setSession(session)
      } catch (err) {
        setError(err as Error)
      } finally {
        setLoading(false)
      }
    }

    getSession()

    // Listen for changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  return { session, loading, error }
}
