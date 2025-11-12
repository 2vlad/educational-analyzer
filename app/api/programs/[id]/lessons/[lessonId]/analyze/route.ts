import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase/server'
import { analyzeLesson } from '@/worker/analyzeLesson'

interface RouteParams {
  params: Promise<{
    id: string
    lessonId: string
  }>
}

/**
 * POST /api/programs/[id]/lessons/[lessonId]/analyze
 *
 * Triggers analysis for a single lesson
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: programId, lessonId } = await params
    const supabase = await createClient()

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify program ownership
    const { data: program, error: programError } = await supabase
      .from('programs')
      .select('*')
      .eq('id', programId)
      .eq('user_id', user.id)
      .single()

    if (programError || !program) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 })
    }

    // Verify lesson belongs to program
    const { data: lesson, error: lessonError } = await supabase
      .from('program_lessons')
      .select('*')
      .eq('id', lessonId)
      .eq('program_id', programId)
      .single()

    if (lessonError || !lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
    }

    // Check if analysis already running for this lesson
    const { data: existingAnalysis } = await supabase
      .from('analyses')
      .select('id, status')
      .eq('lesson_id', lessonId)
      .in('status', ['pending', 'running'])
      .single()

    if (existingAnalysis) {
      return NextResponse.json(
        { error: 'Analysis already running for this lesson' },
        { status: 409 },
      )
    }

    // Trigger analysis
    console.log(`[Analyze Lesson API] Starting analysis for lesson ${lessonId}`)

    const result = await analyzeLesson({
      lessonId,
      programId,
      userId: user.id,
      metricsMode: 'lx',
    })

    console.log(`[Analyze Lesson API] Analysis completed:`, result)

    return NextResponse.json({
      message: 'Lesson analysis completed successfully',
      analysis: result,
    })
  } catch (error) {
    console.error('Error in POST /api/programs/[id]/lessons/[lessonId]/analyze:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
