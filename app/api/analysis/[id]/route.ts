import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/src/lib/supabaseServer'
import { createClient } from '@/src/lib/supabase/server'
import { z } from 'zod'

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

    // Fetch analysis only if requester owns it (authenticated user) or has matching guest session
    let analysisQuery = supabaseAdmin.from('analyses').select('*').eq('id', id)
    if (user) {
      analysisQuery = analysisQuery.eq('user_id', user.id)
    } else {
      if (!guestSessionId) {
        return NextResponse.json({ error: 'Authentication or session required' }, { status: 401 })
      }
      analysisQuery = analysisQuery.is('user_id', null).eq('session_id', guestSessionId)
    }

    const { data: analysis, error: analysisError } = await analysisQuery.single()

    if (analysisError || !analysis) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 })
    }

    // Fetch related LLM requests for metadata
    const { data: llmRequests } = await supabaseAdmin
      .from('llm_requests')
      .select('metric, duration, model, error')
      .eq('analysis_id', id)

    // Format response
    const response = {
      id: analysis.id,
      status: analysis.status,
      model_used: analysis.model_used,
      created_at: analysis.created_at,
      updated_at: analysis.updated_at,
      results: analysis.results,
      metrics: llmRequests || [],
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Analysis fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
