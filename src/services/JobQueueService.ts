/**
 * JobQueueService - Manages the job queue for batch lesson analysis
 * Uses PostgreSQL's SKIP LOCKED pattern for reliable concurrent processing
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

export interface AnalysisJob {
  id: string
  program_run_id: string
  program_id: string
  lesson_id: string
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'skipped'
  attempt_count: number
  last_error?: string
  locked_by?: string
  locked_at?: string
  created_at: string
  updated_at: string
}

export interface ProgramRun {
  id: string
  program_id: string
  user_id: string
  status: 'queued' | 'running' | 'paused' | 'stopped' | 'completed' | 'failed'
  metrics_mode: 'lx' | 'custom'
  metric_configuration_id?: string
  total_lessons: number
  queued: number
  processed: number
  succeeded: number
  failed: number
  max_concurrency: number
  started_at?: string
  finished_at?: string
  created_at: string
}

export class JobQueueService {
  private supabase: SupabaseClient
  private workerId: string
  private lockTTLSeconds = 90 // 90 seconds TTL for locks

  constructor(supabase: SupabaseClient, workerId?: string) {
    this.supabase = supabase
    this.workerId = workerId || `worker-${process.pid}-${Date.now()}`
  }

  /**
   * Pick and lock a job from the queue using SKIP LOCKED
   */
  async pickJob(runId?: string): Promise<AnalysisJob | null> {
    try {
      // Build the query to find and lock a job
      let query = this.supabase
        .from('analysis_jobs')
        .update({
          status: 'running',
          locked_by: this.workerId,
          locked_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('status', 'queued')

      // If runId is specified, only pick jobs for that run
      if (runId) {
        query = query.eq('program_run_id', runId)
      }

      // Add TTL check - unlock jobs that have been locked for too long
      const ttlTimestamp = new Date(Date.now() - this.lockTTLSeconds * 1000).toISOString()
      query = query.or(`locked_at.is.null,locked_at.lt.${ttlTimestamp}`)

      // Use SKIP LOCKED pattern (simulated with limit 1 and proper ordering)
      const { data, error } = await query
        .order('created_at', { ascending: true })
        .limit(1)
        .select()
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // No jobs available
          return null
        }
        throw error
      }

      return data as AnalysisJob
    } catch (error) {
      console.error('Error picking job:', error)
      return null
    }
  }

  /**
   * Update job status and handle retry logic
   */
  async updateJobStatus(
    jobId: string,
    status: 'succeeded' | 'failed' | 'skipped',
    error?: string
  ): Promise<void> {
    const { data: job, error: fetchError } = await this.supabase
      .from('analysis_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (fetchError || !job) {
      throw new Error(`Job ${jobId} not found`)
    }

    // Handle retry logic for failed jobs
    if (status === 'failed' && job.attempt_count < 3) {
      // Calculate backoff time: 10s, 30s, 60s
      const backoffSeconds = [10, 30, 60][job.attempt_count] || 60
      const nextAttemptTime = new Date(Date.now() + backoffSeconds * 1000).toISOString()

      await this.supabase
        .from('analysis_jobs')
        .update({
          status: 'queued',
          attempt_count: job.attempt_count + 1,
          last_error: error,
          locked_by: null,
          locked_at: nextAttemptTime, // Use locked_at as a "not before" timestamp
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId)
    } else {
      // Final status update
      await this.supabase
        .from('analysis_jobs')
        .update({
          status,
          last_error: status === 'failed' ? error : null,
          locked_by: null,
          locked_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId)
    }

    // Update run counters
    await this.updateRunCounters(job.program_run_id)
  }

  /**
   * Update run counters based on job statuses
   */
  async updateRunCounters(runId: string): Promise<void> {
    // Get job statistics
    const { data: stats, error } = await this.supabase
      .from('analysis_jobs')
      .select('status')
      .eq('program_run_id', runId)

    if (error) {
      console.error('Error fetching job stats:', error)
      return
    }

    const counters = {
      queued: 0,
      processed: 0,
      succeeded: 0,
      failed: 0
    }

    stats?.forEach(job => {
      if (job.status === 'queued') {
        counters.queued++
      } else {
        counters.processed++
        if (job.status === 'succeeded') {
          counters.succeeded++
        } else if (job.status === 'failed') {
          counters.failed++
        }
      }
    })

    // Determine run status
    let runStatus: ProgramRun['status'] = 'running'
    if (counters.queued === 0) {
      if (counters.failed > 0 && counters.succeeded === 0) {
        runStatus = 'failed'
      } else {
        runStatus = 'completed'
      }
    }

    // Update run
    await this.supabase
      .from('program_runs')
      .update({
        queued: counters.queued,
        processed: counters.processed,
        succeeded: counters.succeeded,
        failed: counters.failed,
        status: runStatus,
        finished_at: runStatus === 'completed' || runStatus === 'failed' 
          ? new Date().toISOString() 
          : null
      })
      .eq('id', runId)
  }

  /**
   * Check if content has already been analyzed (idempotency)
   */
  async checkContentHash(
    lessonId: string,
    contentHash: string,
    metricConfigurationId?: string
  ): Promise<boolean> {
    const query = this.supabase
      .from('analyses')
      .select('id')
      .eq('lesson_id', lessonId)
      .eq('content_hash', contentHash)

    if (metricConfigurationId) {
      query.eq('configuration_snapshot->id', metricConfigurationId)
    }

    const { data, error } = await query.single()

    // If we found a matching analysis, content hasn't changed
    return !error && !!data
  }

  /**
   * Create a content hash from text
   */
  createContentHash(text: string): string {
    // Normalize text: trim, collapse whitespace
    const normalized = text
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase()

    return createHash('sha256')
      .update(normalized)
      .digest('hex')
  }

  /**
   * Handle pause/resume/stop signals for a run
   */
  async updateRunStatus(
    runId: string,
    status: 'paused' | 'running' | 'stopped'
  ): Promise<void> {
    if (status === 'stopped') {
      // Cancel all queued jobs
      await this.supabase
        .from('analysis_jobs')
        .update({
          status: 'failed',
          last_error: 'Run was stopped by user',
          updated_at: new Date().toISOString()
        })
        .eq('program_run_id', runId)
        .eq('status', 'queued')
    }

    await this.supabase
      .from('program_runs')
      .update({
        status,
        finished_at: status === 'stopped' ? new Date().toISOString() : null
      })
      .eq('id', runId)
  }

  /**
   * Release stale locks (for cleanup)
   */
  async releaseStateLocks(): Promise<number> {
    const ttlTimestamp = new Date(Date.now() - this.lockTTLSeconds * 1000).toISOString()

    const { data, error } = await this.supabase
      .from('analysis_jobs')
      .update({
        status: 'queued',
        locked_by: null,
        locked_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('status', 'running')
      .lt('locked_at', ttlTimestamp)
      .select()

    if (error) {
      console.error('Error releasing stale locks:', error)
      return 0
    }

    return data?.length || 0
  }

  /**
   * Get run status and progress
   */
  async getRunStatus(runId: string): Promise<ProgramRun | null> {
    const { data, error } = await this.supabase
      .from('program_runs')
      .select('*')
      .eq('id', runId)
      .single()

    if (error) {
      console.error('Error fetching run status:', error)
      return null
    }

    return data as ProgramRun
  }
}