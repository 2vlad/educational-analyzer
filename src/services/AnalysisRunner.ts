/**
 * AnalysisRunner - Reusable analysis logic extracted from the analyze endpoint
 * Used by both the direct API endpoint and the job queue runner
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { llmService } from '@/src/services/LLMService'
import { logger } from '@/src/utils/logger'
import { progressService } from '@/src/services/ProgressService'
import { createHash } from 'crypto'
import { env } from '@/src/config/env'

export interface AnalysisInput {
  content: string
  modelId?: string
  metricMode?: 'lx' | 'custom'
  metricConfiguration?: MetricConfig[]
  userId?: string
  sessionId?: string
  programId?: string
  programRunId?: string
  lessonId?: string
}

export interface MetricConfig {
  id: string
  name: string
  prompt_text: string
  display_order: number
}

export interface AnalysisResult {
  id: string
  status: 'completed' | 'partial' | 'failed'
  results: Record<string, any>
  contentHash: string
  totalDuration: number
  model: string
}

/**
 * Get metrics based on mode and configuration
 */
function getMetrics(
  metricMode: 'lx' | 'custom' = 'lx',
  configuration?: MetricConfig[],
): MetricConfig[] {
  // Default LX metrics
  const defaultMetrics: MetricConfig[] = [
    {
      id: 'logic',
      name: 'logic',
      prompt_text: 'Оцените логическую структуру и аргументацию',
      display_order: 1,
    },
    {
      id: 'practical',
      name: 'practical',
      prompt_text: 'Оцените практическую применимость',
      display_order: 2,
    },
    {
      id: 'complexity',
      name: 'complexity',
      prompt_text: 'Оцените глубину и сложность содержания',
      display_order: 3,
    },
    {
      id: 'interest',
      name: 'interest',
      prompt_text: 'Оцените вовлеченность и уровень интереса',
      display_order: 4,
    },
    {
      id: 'care',
      name: 'care',
      prompt_text: 'Оцените внимание к деталям и качество',
      display_order: 5,
    },
  ]

  // Optional: Cognitive Load metric behind a feature flag
  const enableCognitiveLoad = env.isServer ? env.server?.ENABLE_COGNITIVE_LOAD : true
  if (enableCognitiveLoad) {
    defaultMetrics.push({
      id: 'cognitive_load',
      name: 'cognitive_load',
      prompt_text:
        'Оцените когнитивную нагрузку (баланс сложности темы, удаление лишнего, примеры/структура)',
      display_order: 6,
    })
  }

  if (metricMode === 'lx') {
    return defaultMetrics
  }

  // For custom mode, use configuration if available, otherwise fall back to defaults
  if (!configuration || configuration.length === 0) {
    console.log('No custom metrics found, using default metrics for custom mode')
    return defaultMetrics
  }

  return configuration
}

/**
 * Create content hash for idempotency checking
 */
export function createContentHash(text: string): string {
  // Normalize text: trim, collapse whitespace
  const normalized = text.trim().replace(/\s+/g, ' ').toLowerCase()

  return createHash('sha256').update(normalized).digest('hex')
}

/**
 * Run analysis on content - extracted from the analyze endpoint
 */
export async function runAnalysisInternal(
  supabase: SupabaseClient,
  input: AnalysisInput,
): Promise<AnalysisResult> {
  const {
    content,
    modelId,
    metricMode = 'lx',
    metricConfiguration,
    userId,
    sessionId,
    // programId, programRunId, lessonId - will be used when database migration is applied
  } = input

  // Get metrics based on mode
  const metrics = getMetrics(metricMode, metricConfiguration)

  // Create content hash
  const contentHash = createContentHash(content)

  // Create analysis record
  const analysisId = globalThis.crypto.randomUUID()
  const analysisRecord: Record<string, unknown> = {
    id: analysisId,
    content,
    status: 'running',
    model_used: modelId || llmService.getCurrentModel(),
    // Temporarily disabled columns until database migration is applied:
    // content_hash: contentHash,
    // program_id: programId || null,
    // program_run_id: programRunId || null,
    // lesson_id: lessonId || null,
    user_id: userId || null,
    session_id: sessionId || null,
    configuration_snapshot: metricMode === 'custom' ? { metrics } : null,
  }

  const { error: insertError } = await supabase.from('analyses').insert(analysisRecord)

  if (insertError) {
    logger.error('Failed to create analysis', { error: insertError })
    throw new Error('Failed to create analysis')
  }

  // Initialize progress tracking
  await progressService.initializeProgress(
    analysisId,
    metrics.map((m) => m.name),
  )

  // Log analysis start
  logger.analysisStart({
    analysisId,
    contentLength: content.length,
    model: analysisRecord.model_used as string,
    metricsCount: metrics.length,
  })

  // Run metrics in parallel for faster processing
  const startTime = Date.now()

  console.log(`\n📊 Analyzing ${metrics.length} metrics in parallel...`)
  console.log(`Model ID: ${modelId}`)
  console.log(`Metric mode: ${metricMode}`)
  console.log(
    `Metrics:`,
    metrics.map((m) => m.name),
  )

  // Generate lesson title first
  let lessonTitle = ''
  try {
    console.log(`Generating title with model: ${modelId}`)
    const titleResult = await llmService.generateTitle(content, modelId)
    lessonTitle = titleResult.comment || 'Учебный материал'
    console.log('Generated lesson title:', lessonTitle)
  } catch (error) {
    console.error('Failed to generate title:', error)
    console.error('Title generation error details:', {
      message: error instanceof Error ? error.message : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined,
    })
    lessonTitle = 'Учебный материал'
  }

  // Process all metrics in parallel
  const metricPromises = metrics.map(async (metric, index) => {
    // Small staggered delay to avoid hitting rate limits
    await new Promise((resolve) => globalThis.setTimeout(resolve, index * 200))

    // Update progress: metric starting to process
    await progressService.updateMetricProgress(analysisId, metric.name, 'processing', 10)

    // Determine if we should use custom prompt text (BEFORE try-catch for error logging access)
    // Standard metrics (logic, practical, complexity, interest, care) use prompt files
    // Custom metrics use prompt_text from database
    const standardMetrics = [
      'logic',
      'practical',
      'complexity',
      'interest',
      'care',
      'cognitive_load',
    ]
    const isStandardMetric = standardMetrics.includes(metric.name)
    const customPromptText =
      !isStandardMetric && metric.prompt_text ? metric.prompt_text : undefined

    try {
      // Simulate granular progress updates during LLM processing
      const progressInterval = globalThis.setInterval(async () => {
        const currentProgress = await getCurrentMetricProgress(analysisId, metric.name)
        if (currentProgress < 90) {
          await progressService.updateGranularProgress(
            analysisId,
            metric.name,
            Math.min(90, currentProgress + 15),
          )
        }
      }, 500) // Update every 500ms for smooth animation

      // Analyze with retry
      console.log(`\n📊 Analyzing metric ${index + 1}/${metrics.length}: ${metric.name}`)

      // Debug logging
      if (metric.name === 'ярость' || (!isStandardMetric && !metric.prompt_text)) {
        console.log(`📌 Metric ${metric.name}:`)
        console.log(`  Is standard: ${isStandardMetric}`)
        console.log(`  Has prompt_text: ${!!metric.prompt_text}`)
        console.log(`  Using custom prompt: ${!!customPromptText}`)
      }

      const result = modelId
        ? await llmService.analyzeWithModel(content, metric.name as any, modelId, customPromptText)
        : await llmService.analyzeWithRetry(
            content,
            metric.name as any,
            undefined,
            customPromptText,
          )

      // Clear the progress interval
      globalThis.clearInterval(progressInterval)

      // Mark metric as completed
      await progressService.updateMetricProgress(analysisId, metric.name, 'completed', 100)

      console.log(`✅ Metric ${metric.name} complete:`, {
        score: result.score,
        comment: result.comment,
        examplesCount: result.examples?.length,
        hasDetailedAnalysis: !!result.detailed_analysis,
        duration: result.durationMs,
      })

      // Store LLM request record
      await supabase.from('llm_requests').insert({
        analysis_id: analysisId,
        metric: metric.name,
        prompt: `[${metric.name} analysis]`, // Don't store full prompt
        response: result,
        model: result.model,
        duration: result.durationMs,
      })

      return {
        metric: metric.name,
        success: true,
        result,
      }
    } catch (error) {
      // Mark metric as failed
      await progressService.updateMetricProgress(analysisId, metric.name, 'failed', 0)

      console.error(`❌ Metric ${metric.name} failed:`, error)
      console.error(`Error details for ${metric.name}:`, {
        message: error instanceof Error ? error.message : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined,
        modelId,
        isStandardMetric,
        hasCustomPrompt: !!customPromptText,
      })

      // Store failed LLM request
      await supabase.from('llm_requests').insert({
        analysis_id: analysisId,
        metric: metric.name,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return {
        metric: metric.name,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  // Wait for all metrics to complete
  const metricResults = await Promise.all(metricPromises)

  // Log analysis summary
  console.log('\n📊 Analysis Summary:')
  console.log(`Total metrics: ${metricResults.length}`)
  console.log(`Successful: ${metricResults.filter((r) => r.success).length}`)
  console.log(`Failed: ${metricResults.filter((r) => !r.success).length}`)

  const failedMetrics = metricResults.filter((r) => !r.success)
  if (failedMetrics.length > 0) {
    console.error(
      '❌ Failed metrics:',
      failedMetrics.map((r) => `${r.metric}: ${r.error}`),
    )
  }

  // Helper function to get current metric progress
  async function getCurrentMetricProgress(analysisId: string, metric: string): Promise<number> {
    const progress = await progressService.getProgressFromDb(analysisId)
    if (progress) {
      const metricStatus = progress.metricStatus.find((m) => m.metric === metric)
      return metricStatus?.progress || 0
    }
    return 0
  }

  const totalDuration = Date.now() - startTime

  // Process results
  const results: Record<string, unknown> = {}
  let successCount = 0
  let failCount = 0

  for (const metricResult of metricResults) {
    const { metric, success, result, error } = metricResult
    if (success && result) {
      results[metric] = {
        score: result.score,
        comment: result.comment,
        examples: result.examples,
        detailed_analysis: result.detailed_analysis,
        suggestions: result.suggestions,
        durationMs: result.durationMs,
        model: result.model,
      }
      successCount++
    } else {
      results[metric] = { error }
      failCount++
    }
  }

  // Determine final status
  const finalStatus =
    successCount === metrics.length ? 'completed' : successCount > 0 ? 'partial' : 'failed'

  // Add lesson title to results
  results.lessonTitle = lessonTitle

  // Update analysis with results
  const { error: updateError } = await supabase
    .from('analyses')
    .update({
      status: finalStatus,
      results,
      updated_at: new Date().toISOString(),
    })
    .eq('id', analysisId)

  if (updateError) {
    logger.error('Failed to update analysis', { error: updateError })
  }

  // Log analysis complete
  logger.analysisComplete({
    analysisId,
    totalDuration,
    successfulMetrics: successCount,
    failedMetrics: failCount,
  })

  console.log('\n🎯 ANALYSIS COMPLETE')
  console.log('Analysis ID:', analysisId)
  console.log('Status:', finalStatus)
  console.log('Success count:', successCount)
  console.log('Fail count:', failCount)
  console.log('Total duration:', totalDuration, 'ms')
  console.log('\nResults summary:')
  Object.entries(results).forEach(([metric, data]: [string, any]) => {
    if (data.error) {
      console.log(`  ❌ ${metric}: Error - ${data.error}`)
    } else if (metric !== 'lessonTitle') {
      console.log(`  ✅ ${metric}: Score ${data.score}, "${data.comment}"`)
    }
  })
  console.log('=================\n')

  // Clean up progress tracking for this analysis
  progressService.cleanup(analysisId)

  return {
    id: analysisId,
    status: finalStatus,
    results,
    contentHash,
    totalDuration,
    model: analysisRecord.model_used,
  }
}
