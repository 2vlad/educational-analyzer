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
    console.log('[COHERENCE API] Starting coherence analysis request...')

    // Parse and validate request body
    const body = await request.json()
    console.log('[COHERENCE API] Request body:', {
      lessonsCount: body.lessons?.length,
      modelId: body.modelId,
      firstLessonTitle: body.lessons?.[0]?.title,
      firstLessonContentLength: body.lessons?.[0]?.content?.length,
    })

    const validation = coherenceRequestSchema.safeParse(body)

    if (!validation.success) {
      console.error('[COHERENCE API] Validation failed:', validation.error.flatten())
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 },
      )
    }

    const { lessons, modelId } = validation.data

    // Validate lesson count
    if (lessons.length < 2) {
      console.error('[COHERENCE API] Not enough lessons:', lessons.length)
      return NextResponse.json(
        { error: 'At least 2 lessons are required for coherence analysis' },
        { status: 400 },
      )
    }

    if (lessons.length > 20) {
      console.error('[COHERENCE API] Too many lessons:', lessons.length)
      return NextResponse.json(
        { error: 'Maximum 20 lessons allowed for coherence analysis' },
        { status: 400 },
      )
    }

    console.log(
      `[COHERENCE API] Analyzing coherence of ${lessons.length} lessons with model: ${modelId || 'default'}`,
    )

    // Analyze coherence
    const analysis = await llmService.analyzeCoherence(lessons, modelId)

    console.log('[COHERENCE API] Analysis completed successfully:', {
      score: analysis.score,
      summaryLength: analysis.summary?.length,
      strengthsCount: analysis.strengths?.length,
      issuesCount: analysis.issues?.length,
      suggestionsCount: analysis.suggestions?.length,
    })

    return NextResponse.json({
      success: true,
      analysis,
    })
  } catch (error) {
    console.error('[COHERENCE API] Error during coherence analysis:', error)
    console.error('[COHERENCE API] Error stack:', error instanceof Error ? error.stack : 'No stack')
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
