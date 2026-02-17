import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { progressService } from '@/src/services/ProgressService'
import { createClient } from '@/src/lib/supabase/server'
import { supabaseAdmin } from '@/src/lib/supabaseServer'

// Validate UUID format
const uuidSchema = z.string().uuid()

function getGuestSessionId(request: NextRequest): string | null {
  return request.headers.get('x-session-id') || request.cookies.get('session_id')?.value || null
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Await params as required in Next.js 15
    const { id } = await params

    // Validate ID format
    const validation = uuidSchema.safeParse(id)
    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid analysis ID format' }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const guestSessionId = getGuestSessionId(request)

    // Check access to analysis before returning progress to prevent IDOR
    let analysisQuery = supabaseAdmin.from('analyses').select('id').eq('id', id)
    if (user) {
      analysisQuery = analysisQuery.eq('user_id', user.id)
    } else {
      if (!guestSessionId) {
        return NextResponse.json({ error: 'Authentication or session required' }, { status: 401 })
      }
      analysisQuery = analysisQuery.is('user_id', null).eq('session_id', guestSessionId)
    }

    const { data: accessibleAnalysis, error: accessError } = await analysisQuery.single()
    if (accessError || !accessibleAnalysis) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 })
    }

    // Get current progress from database
    const progress = await progressService.getProgressFromDb(id)

    if (!progress) {
      return NextResponse.json(
        { error: 'Analysis not found or no progress available' },
        { status: 404 },
      )
    }

    // Return progress as JSON for polling
    return NextResponse.json(progress)
  } catch (error) {
    console.error('Progress endpoint error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
