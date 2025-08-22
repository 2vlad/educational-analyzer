/**
 * Page-driven Tick Endpoint - Called from the UI to accelerate processing for a specific run
 * Processes jobs for a specific run with user authentication
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase/server'
import { JobRunner } from '@/src/services/JobRunner'

export async function POST(
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
    
    // Verify user owns the run
    const { data: run, error: runError } = await supabase
      .from('program_runs')
      .select(`
        *,
        program:programs(
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
    
    // Check if run is active
    if (run.status !== 'running') {
      return NextResponse.json({
        message: `Run is ${run.status}`,
        processed: 0
      })
    }
    
    // Get app secret key for decryption
    const appSecretKey = process.env.APP_SECRET_KEY
    if (!appSecretKey) {
      console.error('APP_SECRET_KEY not configured')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }
    
    // Create job runner with a unique worker ID
    const workerId = `page-${user.id}-${Date.now()}`
    const runner = new JobRunner(supabase, appSecretKey, workerId)
    
    // Process jobs for this specific run with its configured concurrency
    const maxConcurrency = run.max_concurrency || 1
    
    console.log(`Processing run ${runId} with concurrency: ${maxConcurrency}`)
    
    const startTime = Date.now()
    const processed = await runner.processTick({ 
      maxConcurrency,
      runId 
    })
    const duration = Date.now() - startTime
    
    console.log(`Processed ${processed} jobs for run ${runId} in ${duration}ms`)
    
    // Update run counters after processing
    const { data: updatedRun } = await supabase
      .from('program_runs')
      .select('*')
      .eq('id', runId)
      .single()
    
    return NextResponse.json({
      message: 'Tick processed',
      processed,
      duration,
      run: {
        id: updatedRun?.id,
        status: updatedRun?.status,
        queued: updatedRun?.queued,
        processed: updatedRun?.processed,
        succeeded: updatedRun?.succeeded,
        failed: updatedRun?.failed
      }
    })
    
  } catch (error) {
    console.error('Page tick error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}