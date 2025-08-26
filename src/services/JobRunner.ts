/**
 * JobRunner - Orchestrates the job processing workflow
 * Picks jobs from queue, fetches content, runs analysis, and updates status
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { JobQueueService } from './JobQueueService'
import { ScraperService } from './ScraperService'
import { runAnalysisInternal, createContentHash } from './AnalysisRunner'
import { decryptFromStorage } from './crypto/secretBox'

export interface RunnerConfig {
  maxConcurrency?: number
  runId?: string
  workerId?: string
}

export class JobRunner {
  private jobQueue: JobQueueService
  private scraperService: ScraperService
  private supabase: SupabaseClient
  private appSecretKey: string

  constructor(
    supabase: SupabaseClient,
    appSecretKey: string,
    workerId?: string
  ) {
    this.supabase = supabase
    this.appSecretKey = appSecretKey
    this.jobQueue = new JobQueueService(supabase, workerId)
    this.scraperService = new ScraperService()
  }

  /**
   * Process a single tick - pick and process jobs up to concurrency limit
   */
  async processTick(config: RunnerConfig = {}): Promise<number> {
    const { maxConcurrency = 1, runId } = config
    
    console.log(`🔄 Processing tick with max concurrency: ${maxConcurrency}`)
    
    // Process jobs up to concurrency limit
    const promises: Promise<void>[] = []
    
    for (let i = 0; i < maxConcurrency; i++) {
      promises.push(this.processNextJob(runId))
    }
    
    // Wait for all jobs to complete
    await Promise.all(promises)
    
    // Return number of jobs processed
    return promises.length
  }

  /**
   * Process a single job
   */
  private async processNextJob(runId?: string): Promise<void> {
    try {
      // Pick a job from the queue
      const job = await this.jobQueue.pickJob(runId)
      
      if (!job) {
        console.log('No jobs available')
        return
      }
      
      console.log(`📋 Processing job ${job.id} for lesson ${job.lesson_id}`)
      
      // Get lesson details
      const { data: lesson, error: lessonError } = await this.supabase
        .from('program_lessons')
        .select('*')
        .eq('id', job.lesson_id)
        .single()
      
      if (lessonError || !lesson) {
        await this.jobQueue.updateJobStatus(job.id, 'failed', 'Lesson not found')
        return
      }
      
      // Get program details
      const { data: program, error: programError } = await this.supabase
        .from('programs')
        .select('*')
        .eq('id', job.program_id)
        .single()
      
      if (programError || !program) {
        await this.jobQueue.updateJobStatus(job.id, 'failed', 'Program not found')
        return
      }
      
      // Get run details
      const { data: run, error: runError } = await this.supabase
        .from('program_runs')
        .select('*')
        .eq('id', job.program_run_id)
        .single()
      
      if (runError || !run) {
        await this.jobQueue.updateJobStatus(job.id, 'failed', 'Run not found')
        return
      }
      
      // Check if run is paused or stopped
      if (run.status === 'paused' || run.status === 'stopped') {
        console.log(`Run ${run.id} is ${run.status}, skipping job`)
        // Put job back in queue
        await this.jobQueue.updateJobStatus(job.id, 'failed', `Run is ${run.status}`)
        return
      }
      
      // Get credentials if needed
      let auth = null
      if (program.credential_id) {
        const { data: credential, error: credError } = await this.supabase
          .from('external_credentials')
          .select('*')
          .eq('id', program.credential_id)
          .single()
        
        if (credError || !credential) {
          await this.jobQueue.updateJobStatus(job.id, 'failed', 'Credentials not found')
          return
        }
        
        // Decrypt cookie
        try {
          const decryptedCookie = decryptFromStorage(
            credential.cookie_encrypted,
            this.appSecretKey
          )
          auth = { cookie: decryptedCookie }
        } catch (error) {
          await this.jobQueue.updateJobStatus(job.id, 'failed', 'Failed to decrypt credentials')
          return
        }
      }
      
      // Fetch content from source
      let content: string
      try {
        const adapter = ScraperService.getAdapter(program.source_type)
        if (!adapter) {
          await this.jobQueue.updateJobStatus(job.id, 'failed', `Unknown source type: ${program.source_type}`)
          return
        }
        const lessonContent = await adapter.fetchLessonContent(lesson.url, auth || {})
        content = lessonContent.text
        
        // Check content hash for changes
        const contentHash = createContentHash(content)
        
        // Check if we already have an analysis with this hash
        const hasAnalysis = await this.jobQueue.checkContentHash(
          lesson.id,
          contentHash,
          run.metric_configuration_id
        )
        
        if (hasAnalysis) {
          console.log(`⏭️ Skipping lesson ${lesson.title} - content unchanged`)
          await this.jobQueue.updateJobStatus(job.id, 'skipped')
          return
        }
        
        // Update lesson with new content and hash
        await this.supabase
          .from('program_lessons')
          .update({
            last_content: content,
            content_hash: contentHash,
            last_fetched_at: new Date().toISOString()
          })
          .eq('id', lesson.id)
          
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch content'
        console.error(`Failed to fetch content for lesson ${lesson.id}:`, errorMessage)
        
        // Check if it's an auth error
        if (errorMessage.includes('401') || errorMessage.includes('403')) {
          await this.jobQueue.updateJobStatus(job.id, 'failed', 'Authentication failed - please update credentials')
        } else {
          await this.jobQueue.updateJobStatus(job.id, 'failed', errorMessage)
        }
        return
      }
      
      // Get metric configuration if custom mode
      let metricConfiguration = undefined
      if (run.metrics_mode === 'custom' && run.metric_configuration_id) {
        const { data: configs, error: configError } = await this.supabase
          .from('metric_configurations')
          .select('*')
          .eq('configuration_id', run.metric_configuration_id)
          .eq('is_active', true)
          .order('display_order')
        
        if (configError) {
          await this.jobQueue.updateJobStatus(job.id, 'failed', 'Failed to load metric configuration')
          return
        }
        
        metricConfiguration = configs
      }
      
      // Run analysis
      try {
        console.log(`🤖 Running analysis for lesson ${lesson.title}`)
        
        const result = await runAnalysisInternal(this.supabase, {
          content,
          modelId: program.model_id,
          metricMode: run.metrics_mode,
          metricConfiguration,
          userId: program.user_id,
          programId: program.id,
          programRunId: run.id,
          lessonId: lesson.id
        })
        
        console.log(`✅ Analysis complete for lesson ${lesson.title}`)
        await this.jobQueue.updateJobStatus(job.id, 'succeeded')
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Analysis failed'
        console.error(`Analysis failed for lesson ${lesson.id}:`, errorMessage)
        await this.jobQueue.updateJobStatus(job.id, 'failed', errorMessage)
      }
      
    } catch (error) {
      console.error('Error processing job:', error)
    }
  }

  /**
   * Clean up stale locks
   */
  async cleanupStaleLocks(): Promise<number> {
    return await this.jobQueue.releaseStateLocks()
  }
}