/**
 * Program Run Status API - Get detailed status and progress for a run
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase/server'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: runId } = await context.params
    const supabase = await createClient()
    
    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Get run with program info to verify ownership
    const { data: run, error: runError } = await supabase
      .from('program_runs')
      .select(`
        *,
        program:programs(
          id,
          name,
          user_id
        )
      `)
      .eq('id', runId)
      .single()
    
    if (runError || !run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }
    
    if (run.program.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    
    // Get job statistics
    const { data: jobStats, error: jobsError } = await supabase
      .from('analysis_jobs')
      .select('status, lesson_id')
      .eq('program_run_id', runId)
    
    if (jobsError) {
      console.error('Error fetching job stats:', jobsError)
    }
    
    // Calculate detailed statistics
    const stats = {
      queued: 0,
      running: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
    }
    
    if (jobStats) {
      jobStats.forEach(job => {
        switch (job.status) {
          case 'queued':
            stats.queued++
            break
          case 'running':
            stats.running++
            break
          case 'succeeded':
            stats.succeeded++
            break
          case 'failed':
            stats.failed++
            break
          case 'skipped':
            stats.skipped++
            break
        }
      })
    }
    
    // Get recent job errors if any
    const { data: recentErrors } = await supabase
      .from('analysis_jobs')
      .select(`
        id,
        lesson_id,
        last_error,
        updated_at,
        lesson:program_lessons(title, url)
      `)
      .eq('program_run_id', runId)
      .eq('status', 'failed')
      .order('updated_at', { ascending: false })
      .limit(5)
    
    // Calculate progress percentage
    const totalJobs = run.total_lessons
    const completedJobs = stats.succeeded + stats.failed + stats.skipped
    const progressPercentage = totalJobs > 0 
      ? Math.round((completedJobs / totalJobs) * 100)
      : 0
    
    // Estimate time remaining (if running)
    let estimatedTimeRemaining = null
    if (run.status === 'running' && run.started_at && stats.queued > 0) {
      const elapsedMs = Date.now() - new Date(run.started_at).getTime()
      const jobsCompleted = completedJobs
      if (jobsCompleted > 0) {
        const avgTimePerJob = elapsedMs / jobsCompleted
        estimatedTimeRemaining = Math.round((stats.queued * avgTimePerJob) / 1000) // in seconds
      }
    }
    
    return NextResponse.json({
      run: {
        id: run.id,
        programId: run.program_id,
        programName: run.program.name,
        status: run.status,
        metricsMode: run.metrics_mode,
        metricConfigurationId: run.metric_configuration_id,
        maxConcurrency: run.max_concurrency,
        totalLessons: run.total_lessons,
        startedAt: run.started_at,
        finishedAt: run.finished_at,
        createdAt: run.created_at,
      },
      progress: {
        percentage: progressPercentage,
        queued: stats.queued,
        running: stats.running,
        succeeded: stats.succeeded,
        failed: stats.failed,
        skipped: stats.skipped,
        total: totalJobs,
        completed: completedJobs,
      },
      estimatedTimeRemaining,
      recentErrors: recentErrors?.map(error => ({
        jobId: error.id,
        lessonId: error.lesson_id,
        lessonTitle: (error.lesson as any)?.title,
        lessonUrl: (error.lesson as any)?.url,
        error: error.last_error,
        timestamp: error.updated_at,
      })) || [],
    })
    
  } catch (error) {
    console.error('Error fetching run status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}