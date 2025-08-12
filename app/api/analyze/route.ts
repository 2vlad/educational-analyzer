import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/src/lib/supabaseServer'
import { llmService } from '@/src/services/LLMService'
import { logger } from '@/src/utils/logger'
import { METRICS, type Metric } from '@/src/utils/prompts'
import { InsertAnalysis, InsertLLMRequest } from '@/src/types/database'

// Request schema
const analyzeRequestSchema = z.object({
  content: z.string().min(1).max(2000),
  modelId: z.string().optional()
})

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json()
    const validation = analyzeRequestSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { content, modelId } = validation.data

    // Create analysis record
    const analysisId = crypto.randomUUID()
    const analysis: InsertAnalysis = {
      content,
      status: 'running',
      model_used: modelId || llmService.getCurrentModel()
    }

    const { error: insertError } = await supabaseAdmin
      .from('analyses')
      .insert({ ...analysis, id: analysisId })

    if (insertError) {
      logger.error('Failed to create analysis', { error: insertError })
      return NextResponse.json(
        { error: 'Failed to create analysis' },
        { status: 500 }
      )
    }

    // Log analysis start
    logger.analysisStart({
      analysisId,
      contentLength: content.length,
      model: analysis.model_used!,
      metricsCount: METRICS.length
    })

    // Run all metrics in parallel
    const startTime = Date.now()
    const metricPromises = METRICS.map(async (metric) => {
      try {
        // Analyze with retry
        const result = modelId 
          ? await llmService.analyzeWithModel(content, metric, modelId)
          : await llmService.analyzeWithRetry(content, metric)

        // Store LLM request record
        const llmRequest: InsertLLMRequest = {
          analysis_id: analysisId,
          metric,
          prompt: `[${metric} analysis]`, // Don't store full prompt
          response: result,
          model: result.model,
          duration: result.durationMs
        }

        await supabaseAdmin
          .from('llm_requests')
          .insert(llmRequest)

        return {
          metric,
          success: true,
          result
        }
      } catch (error) {
        // Store failed LLM request
        const llmRequest: InsertLLMRequest = {
          analysis_id: analysisId,
          metric,
          error: error instanceof Error ? error.message : 'Unknown error'
        }

        await supabaseAdmin
          .from('llm_requests')
          .insert(llmRequest)

        return {
          metric,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })

    // Wait for all metrics to complete
    const metricResults = await Promise.allSettled(metricPromises)
    const totalDuration = Date.now() - startTime

    // Process results
    const results: any = {}
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
            durationMs: result.durationMs,
            model: result.model
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
    const finalStatus = successCount === METRICS.length 
      ? 'completed' 
      : successCount > 0 
        ? 'partial' 
        : 'failed'

    // Update analysis with results
    const { error: updateError } = await supabaseAdmin
      .from('analyses')
      .update({
        status: finalStatus,
        results,
        updated_at: new Date().toISOString()
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
      failedMetrics: failCount
    })

    // Return analysis ID for polling
    return NextResponse.json({
      analysisId,
      status: finalStatus
    })

  } catch (error) {
    logger.error('Analyze endpoint error', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    })
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}