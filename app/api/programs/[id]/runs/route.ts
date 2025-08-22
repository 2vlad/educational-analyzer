/**
 * Program Runs API - Create and list runs for a program
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase/server'
import { z } from 'zod'
import { createContentHash } from '@/src/services/AnalysisRunner'

const createRunSchema = z.object({
  metricsMode: z.enum(['lx', 'custom']),
  metricConfigurationId: z.string().uuid().optional(),
  maxConcurrency: z.number().min(1).max(10).default(3),
})

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: programId } = await context.params
    const supabase = await createClient()
    
    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Parse request body
    const body = await request.json()
    const validation = createRunSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.errors },
        { status: 400 }
      )
    }
    
    const { metricsMode, metricConfigurationId, maxConcurrency } = validation.data
    
    // Verify user owns the program
    const { data: program, error: programError } = await supabase
      .from('programs')
      .select('*')
      .eq('id', programId)
      .eq('user_id', user.id)
      .single()
    
    if (programError || !program) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 })
    }
    
    // Verify metric configuration if custom mode
    if (metricsMode === 'custom') {
      if (!metricConfigurationId) {
        return NextResponse.json(
          { error: 'Metric configuration required for custom mode' },
          { status: 400 }
        )
      }
      
      // Verify configuration exists and belongs to user
      const { data: config, error: configError } = await supabase
        .from('metric_configurations')
        .select('id')
        .eq('configuration_id', metricConfigurationId)
        .eq('user_id', user.id)
        .limit(1)
      
      if (configError || !config || config.length === 0) {
        return NextResponse.json(
          { error: 'Metric configuration not found' },
          { status: 404 }
        )
      }
    }
    
    // Get all lessons for the program
    const { data: lessons, error: lessonsError } = await supabase
      .from('program_lessons')
      .select('*')
      .eq('program_id', programId)
      .order('display_order')
    
    if (lessonsError) {
      console.error('Error fetching lessons:', lessonsError)
      return NextResponse.json(
        { error: 'Failed to fetch lessons' },
        { status: 500 }
      )
    }
    
    if (!lessons || lessons.length === 0) {
      return NextResponse.json(
        { error: 'No lessons found. Please enumerate lessons first.' },
        { status: 400 }
      )
    }
    
    // Check for existing active runs
    const { data: activeRuns } = await supabase
      .from('program_runs')
      .select('id')
      .eq('program_id', programId)
      .in('status', ['queued', 'running', 'paused'])
      .limit(1)
    
    if (activeRuns && activeRuns.length > 0) {
      return NextResponse.json(
        { error: 'An active run already exists for this program' },
        { status: 400 }
      )
    }
    
    // Create the run
    const runId = crypto.randomUUID()
    const { error: runError } = await supabase
      .from('program_runs')
      .insert({
        id: runId,
        program_id: programId,
        user_id: user.id,
        status: 'queued',
        metrics_mode: metricsMode,
        metric_configuration_id: metricConfigurationId || null,
        total_lessons: lessons.length,
        queued: 0, // Will be updated after creating jobs
        processed: 0,
        succeeded: 0,
        failed: 0,
        max_concurrency: maxConcurrency,
      })
    
    if (runError) {
      console.error('Error creating run:', runError)
      return NextResponse.json(
        { error: 'Failed to create run' },
        { status: 500 }
      )
    }
    
    // Determine which lessons need analysis
    const jobsToCreate = []
    
    for (const lesson of lessons) {
      let needsAnalysis = true
      
      // Check if content has been analyzed before with same configuration
      if (lesson.content_hash) {
        const { data: existingAnalysis } = await supabase
          .from('analyses')
          .select('id')
          .eq('lesson_id', lesson.id)
          .eq('content_hash', lesson.content_hash)
          .eq(
            metricsMode === 'custom' ? 'configuration_snapshot->id' : 'configuration_snapshot',
            metricsMode === 'custom' ? metricConfigurationId : null
          )
          .limit(1)
        
        if (existingAnalysis && existingAnalysis.length > 0) {
          needsAnalysis = false
          console.log(`Skipping lesson ${lesson.title} - already analyzed with same content`)
        }
      }
      
      if (needsAnalysis) {
        jobsToCreate.push({
          id: crypto.randomUUID(),
          program_run_id: runId,
          program_id: programId,
          lesson_id: lesson.id,
          status: 'queued',
          attempt_count: 0,
        })
      }
    }
    
    // Create analysis jobs
    if (jobsToCreate.length > 0) {
      const { error: jobsError } = await supabase
        .from('analysis_jobs')
        .insert(jobsToCreate)
      
      if (jobsError) {
        console.error('Error creating jobs:', jobsError)
        // Clean up the run
        await supabase.from('program_runs').delete().eq('id', runId)
        return NextResponse.json(
          { error: 'Failed to create analysis jobs' },
          { status: 500 }
        )
      }
    }
    
    // Update run with job count and start it
    const { data: updatedRun, error: updateError } = await supabase
      .from('program_runs')
      .update({
        queued: jobsToCreate.length,
        status: jobsToCreate.length > 0 ? 'running' : 'completed',
        started_at: new Date().toISOString(),
        finished_at: jobsToCreate.length === 0 ? new Date().toISOString() : null,
      })
      .eq('id', runId)
      .select()
      .single()
    
    if (updateError) {
      console.error('Error updating run:', updateError)
    }
    
    return NextResponse.json({
      run: {
        id: runId,
        programId,
        status: updatedRun?.status || 'running',
        totalLessons: lessons.length,
        jobsCreated: jobsToCreate.length,
        skipped: lessons.length - jobsToCreate.length,
        metricsMode,
        metricConfigurationId,
        maxConcurrency,
      },
      message: jobsToCreate.length > 0
        ? `Created ${jobsToCreate.length} analysis jobs`
        : 'All lessons already analyzed with current configuration',
    })
    
  } catch (error) {
    console.error('Error creating run:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: programId } = await context.params
    const supabase = await createClient()
    
    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Verify user owns the program
    const { data: program, error: programError } = await supabase
      .from('programs')
      .select('id')
      .eq('id', programId)
      .eq('user_id', user.id)
      .single()
    
    if (programError || !program) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 })
    }
    
    // Get all runs for the program
    const { data: runs, error: runsError } = await supabase
      .from('program_runs')
      .select('*')
      .eq('program_id', programId)
      .order('created_at', { ascending: false })
    
    if (runsError) {
      console.error('Error fetching runs:', runsError)
      return NextResponse.json(
        { error: 'Failed to fetch runs' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ runs: runs || [] })
    
  } catch (error) {
    console.error('Error fetching runs:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}