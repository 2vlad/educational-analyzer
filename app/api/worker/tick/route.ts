/**
 * Worker Tick Endpoint - Called by Vercel Cron every minute
 * Processes jobs from the queue with service role authentication
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { JobRunner } from '@/src/services/JobRunner'

// Create service role client for cron operations
function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase configuration')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function GET(request: NextRequest) {
  try {
    // Verify this is called by Vercel Cron (check for authorization header)
    const authHeader = request.headers.get('authorization')

    // In production, Vercel adds a special header for cron jobs
    // For development, we'll allow requests without auth
    if (process.env.NODE_ENV === 'production' && !authHeader?.includes('Bearer')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get app secret key for decryption
    const appSecretKey = process.env.APP_SECRET_KEY
    if (!appSecretKey) {
      console.error('APP_SECRET_KEY not configured')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // Create service client
    const supabase = createServiceClient()

    // Create job runner with a unique worker ID
    const workerId = `cron-${Date.now()}`
    const runner = new JobRunner(supabase, appSecretKey, workerId)

    // Clean up stale locks first
    const releasedLocks = await runner.cleanupStaleLocks()
    if (releasedLocks > 0) {
      console.log(`Released ${releasedLocks} stale locks`)
    }

    // Get all active runs to determine max concurrency
    const { data: activeRuns, error: runsError } = await supabase
      .from('program_runs')
      .select('id, max_concurrency')
      .eq('status', 'running')

    if (runsError) {
      console.error('Error fetching active runs:', runsError)
      return NextResponse.json({ error: 'Failed to fetch active runs' }, { status: 500 })
    }

    if (!activeRuns || activeRuns.length === 0) {
      console.log('No active runs to process')
      return NextResponse.json({
        message: 'No active runs',
        processed: 0,
      })
    }

    // Calculate total concurrency across all runs
    const totalConcurrency = activeRuns.reduce((sum, run) => sum + (run.max_concurrency || 1), 0)

    // Limit total concurrency to prevent overload (max 10 for cron)
    const maxConcurrency = Math.min(totalConcurrency, 10)

    console.log(`Processing with concurrency: ${maxConcurrency} across ${activeRuns.length} runs`)

    // Process jobs with calculated concurrency
    const startTime = Date.now()
    const processed = await runner.processTick({ maxConcurrency })
    const duration = Date.now() - startTime

    console.log(`Processed ${processed} jobs in ${duration}ms`)

    // Check if we're approaching Vercel's timeout (60s)
    if (duration > 50000) {
      console.warn('Approaching timeout limit, consider reducing concurrency')
    }

    return NextResponse.json({
      message: 'Tick processed',
      processed,
      duration,
      activeRuns: activeRuns.length,
      concurrency: maxConcurrency,
    })
  } catch (error) {
    console.error('Worker tick error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
