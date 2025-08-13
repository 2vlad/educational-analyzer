import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/src/lib/supabaseServer'
import { llmService } from '@/src/services/LLMService'
import { logger } from '@/src/utils/logger'
import { METRICS } from '@/src/utils/prompts'
import { InsertAnalysis, InsertLLMRequest } from '@/src/types/database'

// Request schema
const analyzeRequestSchema = z.object({
  content: z.string().min(1).max(2000),
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

  // Check for educational keywords (at least one should be present)
  const educationalKeywords = [
    'learn',
    'teach',
    'understand',
    'explain',
    'example',
    'concept',
    'tutorial',
    'lesson',
    'exercise',
    'practice',
    'study',
    'knowledge',
    'изуч',
    'урок',
    'пример',
    'задач',
    'объясн',
    'понима',
    'практик',
    'function',
    'variable',
    'method',
    'class',
    'algorithm',
    'data',
    'переменн',
    'функци',
    'метод',
    'класс',
    'алгоритм',
    'данн',
  ]

  const lowerContent = content.toLowerCase()
  const hasEducationalContent = educationalKeywords.some((keyword) =>
    lowerContent.includes(keyword),
  )

  return hasEducationalContent
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
            'Please provide educational content such as a lesson, tutorial, or learning material. Random text or company names cannot be analyzed.',
        },
        { status: 400 },
      )
    }

    // Validate and sanitize model ID
    const validModelIds = ['claude-haiku', 'claude-sonnet-4', 'gpt-4o', 'gemini-pro']
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

    // Log analysis start
    logger.analysisStart({
      analysisId,
      contentLength: content.length,
      model: analysis.model_used!,
      metricsCount: METRICS.length,
    })

    // Run metrics sequentially with delay to avoid rate limiting
    const startTime = Date.now()
    const metricResults: Array<{
      metric: string
      success: boolean
      result?: any
      error?: string
    }> = []

    // Process metrics sequentially with 1 second delay between requests
    for (let i = 0; i < METRICS.length; i++) {
      const metric = METRICS[i]

      // Add delay between requests (except for the first one)
      if (i > 0) {
        console.log(`⏳ Waiting 1 second before next metric to avoid rate limiting...`)
        await new Promise((resolve) => globalThis.setTimeout(resolve, 1000))
      }

      try {
        // Analyze with retry
        console.log(`\n📊 Analyzing metric ${i + 1}/${METRICS.length}: ${metric}`)
        const result = finalModelId
          ? await llmService.analyzeWithModel(content, metric, finalModelId)
          : await llmService.analyzeWithRetry(content, metric)

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

        metricResults.push({
          metric,
          success: true,
          result,
        })
      } catch (error) {
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

        metricResults.push({
          metric,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
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
