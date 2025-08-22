/**
 * Resume Program Run API
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase/server'
import { JobQueueService } from '@/src/services/JobQueueService'

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
        program:programs(user_id)
      `)
      .eq('id', runId)
      .single()
    
    if (runError || !run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }
    
    if (run.program.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    
    // Check if run can be resumed
    if (run.status !== 'paused') {
      return NextResponse.json(
        { error: `Cannot resume run with status: ${run.status}` },
        { status: 400 }
      )
    }
    
    // Update run status to running
    const jobQueue = new JobQueueService(supabase)
    await jobQueue.updateRunStatus(runId, 'running')
    
    return NextResponse.json({
      message: 'Run resumed successfully',
      runId,
      status: 'running',
    })
    
  } catch (error) {
    console.error('Error resuming run:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}