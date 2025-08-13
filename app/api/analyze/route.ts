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
    
    // Validate and sanitize model ID
    const validModelIds = ['claude-sonnet-4', 'gpt-4o', 'gemini-pro']
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

    // Run all metrics in parallel
    const startTime = Date.now()
    const metricPromises = METRICS.map(async (metric) => {
      try {
        // Analyze with retry
        console.log(`\n📊 Analyzing metric: ${metric}`)
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

        return {
          metric,
          success: true,
          result,
        }
      } catch (error) {
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
    const metricResults = await Promise.allSettled(metricPromises)
    const totalDuration = Date.now() - startTime

    // Process results
    const results: Record<string, unknown> = {}
    let successCount = 0
    let failCount = 0

    for (const settledResult of metricResults) {
      if (settledResult.status === 'fulfilled') {
        const { metric, success, result, error } = settledResult.value
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
      } else {
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
