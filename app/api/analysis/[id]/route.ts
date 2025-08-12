import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/src/lib/supabaseServer'
import { z } from 'zod'

// Validate UUID format
const uuidSchema = z.string().uuid()

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Await params as required in Next.js 15
    const { id } = await params

    // Validate ID format
    const validation = uuidSchema.safeParse(id)
    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid analysis ID format' }, { status: 400 })
    }

    // Fetch analysis
    const { data: analysis, error: analysisError } = await supabaseAdmin
      .from('analyses')
      .select('*')
      .eq('id', id)
      .single()

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
