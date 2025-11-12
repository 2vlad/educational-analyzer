import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase/server'
import { randomUUID } from 'crypto'

interface RouteParams {
  params: Promise<{
    id: string
    lessonId: string
  }>
}

/**
 * POST /api/programs/[id]/lessons/[lessonId]/analyze
 *
 * Triggers analysis for a single lesson by creating a single-lesson run
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

    // Check if analysis job already queued or running for this lesson
    const { data: existingJob } = await supabase
      .from('analysis_jobs')
      .select('id, status')
      .eq('lesson_id', lessonId)
      .in('status', ['queued', 'running'])
      .single()

    if (existingJob) {
      return NextResponse.json(
        { error: 'Analysis already queued or running for this lesson' },
        { status: 409 },
      )
    }

    // Create a single-lesson run
    const runId = randomUUID()
    const { error: runError } = await supabase.from('program_runs').insert({
      id: runId,
      program_id: programId,
      user_id: user.id,
      status: 'running',
      metrics_mode: 'lx',
      metric_configuration_id: null,
      total_lessons: 1,
      queued: 1,
      processed: 0,
      succeeded: 0,
      failed: 0,
      max_concurrency: 1,
      started_at: new Date().toISOString(),
    })

    if (runError) {
      console.error('Error creating run:', runError)
      return NextResponse.json({ error: 'Failed to create run' }, { status: 500 })
    }

    // Create analysis job for this lesson
    const jobId = randomUUID()
    const { error: jobError } = await supabase.from('analysis_jobs').insert({
      id: jobId,
      program_run_id: runId,
      program_id: programId,
      lesson_id: lessonId,
      status: 'queued',
      attempt_count: 0,
    })

    if (jobError) {
      console.error('Error creating job:', jobError)
      // Clean up the run
      await supabase.from('program_runs').delete().eq('id', runId)
      return NextResponse.json({ error: 'Failed to create analysis job' }, { status: 500 })
    }

    console.log(`[Analyze Lesson API] Created job ${jobId} for lesson ${lessonId}`)

    return NextResponse.json({
      message: 'Lesson analysis queued successfully',
      jobId,
      runId,
    })
  } catch (error) {
    console.error('Error in POST /api/programs/[id]/lessons/[lessonId]/analyze:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
