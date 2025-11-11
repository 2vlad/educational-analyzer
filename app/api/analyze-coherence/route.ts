import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { llmService } from '@/src/services/LLMService'

// Use Node runtime for LLM operations
export const runtime = 'nodejs'

// Request schema
const coherenceRequestSchema = z.object({
  lessons: z.array(
    z.object({
      title: z.string(),
      content: z.string(),
    }),
  ),
  modelId: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json()
    const validation = coherenceRequestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 },
      )
    }

    const { lessons, modelId } = validation.data

    // Validate lesson count
    if (lessons.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 lessons are required for coherence analysis' },
        { status: 400 },
      )
    }

    if (lessons.length > 20) {
      return NextResponse.json(
        { error: 'Maximum 20 lessons allowed for coherence analysis' },
        { status: 400 },
      )
    }

    console.log(`Analyzing coherence of ${lessons.length} lessons...`)

    // Analyze coherence
    const analysis = await llmService.analyzeCoherence(lessons, modelId)

    return NextResponse.json({
      success: true,
      analysis,
    })
  } catch (error) {
    console.error('Coherence analysis error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
