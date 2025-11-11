import { NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Get user session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user's credentials (without encrypted data)
    const { data: credentials, error } = await supabase
      .from('external_credentials')
      .select('id, name, provider, cookie_expires_at, created_at, updated_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching credentials:', error)
      return NextResponse.json({ error: 'Failed to fetch credentials' }, { status: 500 })
    }

    // Format response
    const formattedCredentials = credentials?.map((cred) => ({
      id: cred.id,
      name: cred.name,
      provider: cred.provider,
      expiresAt: cred.cookie_expires_at,
      createdAt: cred.created_at,
      updatedAt: cred.updated_at,
      isExpired: cred.cookie_expires_at ? new Date(cred.cookie_expires_at) < new Date() : false,
    }))

    return NextResponse.json({ credentials: formattedCredentials || [] })
  } catch (error) {
    console.error('Error in GET /api/credentials:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
