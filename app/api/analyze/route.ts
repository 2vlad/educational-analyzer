import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/src/lib/supabaseServer'
import { llmService } from '@/src/services/LLMService'
import { logger } from '@/src/utils/logger'
import { METRICS } from '@/src/utils/prompts'
import { InsertAnalysis, InsertLLMRequest } from '@/src/types/database'
import { progressService } from '@/src/services/ProgressService'

// Request schema
const analyzeRequestSchema = z.object({
  content: z.string().min(1).max(20000),
  modelId: z.string().optional(),
})

// Check if content looks like educational material
function isEducationalContent(content: string): boolean {
  // Must have at least 100 characters of meaningful content
  if (content.length < 100) return false

  // Count words (rough estimate)
  const words = content.split(/\s+/).filter((word) => word.length > 2)
  if (words.length < 20) return false

  // Check for sentence structure (should have periods, question marks, etc.)
  const sentences = content.split(/[.!?]+/)
  if (sentences.length < 2) return false

  // Check if it's just a URL or company name
  const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/
  if (urlPattern.test(content.trim())) return false

  // More flexible educational content detection
  // Accept any content that has substantial text with proper sentence structure
  // We already checked for minimum length, words, and sentences above
  return true
}

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json()
    const validation = analyzeRequestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 },
      )
    }

    const { content, modelId } = validation.data

    console.log('=== ANALYZE REQUEST ===')
    console.log('Model ID received:', modelId)
    console.log('Content length:', content.length)

    // Check if content is educational
    if (!isEducationalContent(content)) {
      console.log('❌ Content rejected: Not educational material')
      return NextResponse.json(
        {
          error: 'Invalid content',
          details:
            'Please provide substantial text content with at least 100 characters, 20 words, and multiple sentences.',
        },
        { status: 400 },
      )
    }

    // Validate and sanitize model ID
    const validModelIds = [
      'claude-haiku',
      'claude-sonnet-4',
      'gpt-4o',
      'gemini-pro',
      'yandex-gpt-pro',
    ]
    let finalModelId = modelId

    if (modelId && !validModelIds.includes(modelId)) {
      console.warn('Invalid model ID received:', modelId)
      console.log('Using default model instead')
      finalModelId = undefined // Will use default
    }

    console.log('Final model to use:', finalModelId || llmService.getCurrentModel())
    console.log('====================')

    // Create analysis record
    const analysisId = globalThis.crypto.randomUUID()
    const analysis: InsertAnalysis = {
      content,
      status: 'running',
      model_used: finalModelId || llmService.getCurrentModel(),
    }

    const { error: insertError } = await supabaseAdmin
      .from('analyses')
      .insert({ ...analysis, id: analysisId })

    if (insertError) {
      logger.error('Failed to create analysis', { error: insertError })
      return NextResponse.json({ error: 'Failed to create analysis' }, { status: 500 })
    }

    // Initialize progress tracking
    await progressService.initializeProgress(analysisId, METRICS as unknown as string[])

    // Log analysis start
    logger.analysisStart({
      analysisId,
      contentLength: content.length,
      model: analysis.model_used!,
      metricsCount: METRICS.length,
    })

    // Run metrics in parallel for faster processing
    const startTime = Date.now()

    console.log(`\n📊 Analyzing ${METRICS.length} metrics in parallel...`)

    // Generate lesson title first
    let lessonTitle = ''
    try {
      const titlePrompt = `Проанализируй этот учебный материал и дай ему конкретное техническое название (3-6 слов), которое точно отражает тему. 
Избегай общих слов типа "Основы", "Введение", "Учебный материал". 
Используй конкретные технологии, методы или концепции из текста.
Ответь только названием, без объяснений.

Материал:
${content.substring(0, 1500)}...

Название:`

      const titleResult = await llmService.analyze(titlePrompt, content.substring(0, 1000), {
        model: finalModelId,
        maxTokens: 50,
        temperature: 0.3,
      })

      if (titleResult) {
        // Use the comment field which contains the parsed title
        lessonTitle = titleResult.comment || 'Учебный материал'
        // Clean up the title
        lessonTitle = lessonTitle.trim().replace(/["'`]/g, '').substring(0, 100)
      }
    } catch (error) {
      console.error('Failed to generate title:', error)
      lessonTitle = 'Учебный материал'
    }

    // Process all metrics in parallel
    const metricPromises = METRICS.map(async (metric, index) => {
      // Small staggered delay to avoid hitting rate limits
      await new Promise((resolve) => globalThis.setTimeout(resolve, index * 200))

      // Update progress: metric starting to process
      await progressService.updateMetricProgress(analysisId, metric, 'processing', 10)

      try {
        // Simulate granular progress updates during LLM processing
        const progressInterval = globalThis.setInterval(async () => {
          const currentProgress = await getCurrentMetricProgress(analysisId, metric)
          if (currentProgress < 90) {
            await progressService.updateGranularProgress(
              analysisId,
              metric,
              Math.min(90, currentProgress + 15),
            )
          }
        }, 500) // Update every 500ms for smooth animation

        // Analyze with retry
        console.log(`\n📊 Analyzing metric ${index + 1}/${METRICS.length}: ${metric}`)
        const result = finalModelId
          ? await llmService.analyzeWithModel(content, metric, finalModelId)
          : await llmService.analyzeWithRetry(content, metric)

        // Clear the progress interval
        globalThis.clearInterval(progressInterval)

        // Mark metric as completed
        await progressService.updateMetricProgress(analysisId, metric, 'completed', 100)

        console.log(`✅ Metric ${metric} complete:`, {
          score: result.score,
          comment: result.comment,
          examplesCount: result.examples?.length,
          hasDetailedAnalysis: !!result.detailed_analysis,
          duration: result.durationMs,
        })

        // Store LLM request record
        const llmRequest: InsertLLMRequest = {
          analysis_id: analysisId,
          metric,
          prompt: `[${metric} analysis]`, // Don't store full prompt
          response: result,
          model: result.model,
          duration: result.durationMs,
        }

        await supabaseAdmin.from('llm_requests').insert(llmRequest)

        return {
          metric,
          success: true,
          result,
        }
      } catch (error) {
        // Mark metric as failed
        await progressService.updateMetricProgress(analysisId, metric, 'failed', 0)

        console.log(
          `❌ Metric ${metric} failed:`,
          error instanceof Error ? error.message : 'Unknown error',
        )

        // Store failed LLM request
        const llmRequest: InsertLLMRequest = {
          analysis_id: analysisId,
          metric,
          error: error instanceof Error ? error.message : 'Unknown error',
        }

        await supabaseAdmin.from('llm_requests').insert(llmRequest)

        return {
          metric,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }
    })

    // Wait for all metrics to complete
    const metricResults = await Promise.all(metricPromises)

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
      successCount === METRICS.length ? 'completed' : successCount > 0 ? 'partial' : 'failed'

    // Add lesson title to results
    results.lessonTitle = lessonTitle

    // Update analysis with results
    const { error: updateError } = await supabaseAdmin
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
      } else {
        console.log(`  ✅ ${metric}: Score ${data.score}, "${data.comment}"`)
      }
    })
    console.log('=================\n')

    // Clean up progress tracking for this analysis
    progressService.cleanup(analysisId)

    // Return analysis ID for polling
    return NextResponse.json({
      analysisId,
      status: finalStatus,
    })
  } catch (error) {
    logger.error('Analyze endpoint error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
