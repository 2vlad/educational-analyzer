import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { URL } from 'url'
import { createClient, createServiceClient } from '@/src/lib/supabase/server'
import { DynamicLLMService } from '@/src/services/DynamicLLMService'
import { logger } from '@/src/utils/logger'
import { MetricConfig } from '@/src/types/metrics'
import { InsertAnalysis } from '@/src/types/database'
import { progressService } from '@/src/services/ProgressService'
import { rateLimiter, getRateLimitIdentifier } from '@/src/lib/rate-limit'
import { DEFAULT_STUDENT_CHARACTER, normalizeStudentCharacter } from '@/src/utils/studentCharacter'

// Request schema
const analyzeRequestSchema = z.object({
  content: z.string().min(1).max(20000),
  modelId: z.string().optional(),
  studentCharacter: z.string().min(5).max(500).optional(),
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

  return true
}

/**
 * Enhanced analyze endpoint with multi-user support
 * - Supports authenticated users with custom metric configurations
 * - Maintains backward compatibility for guest users
 * - Saves configuration snapshots for historical accuracy
 */
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

    const { content, modelId, studentCharacter } = validation.data

    console.log('=== ANALYZE V2 REQUEST ===')
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

    // Create Supabase clients
    const supabase = createClient()
    const supabaseAdmin = createServiceClient()

    // Get user session (if authenticated)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    console.log('User authenticated:', !!user)
    console.log('User ID:', user?.id || 'Guest')

    let finalStudentCharacter = studentCharacter

    if (!finalStudentCharacter && user) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('student_character')
        .eq('id', user.id)
        .single()

      if (!profileError) {
        finalStudentCharacter = profile?.student_character || undefined
      } else {
        console.error('Failed to load student character for user:', profileError)
      }
    }

    const normalizedCharacter = normalizeStudentCharacter(
      finalStudentCharacter || DEFAULT_STUDENT_CHARACTER,
    )

    // Check rate limit
    const rateLimitId = getRateLimitIdentifier(request, user?.id)
    const rateLimit = await rateLimiter.checkLimit(rateLimitId)

    if (!rateLimit.success) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          limit: rateLimit.limit,
          remaining: rateLimit.remaining,
          reset: rateLimit.reset.toISOString(),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimit.limit.toString(),
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': rateLimit.reset.toISOString(),
            'Retry-After': Math.ceil((rateLimit.reset.getTime() - Date.now()) / 1000).toString(),
          },
        },
      )
    }

    // Add rate limit headers to successful responses
    const rateLimitHeaders = {
      'X-RateLimit-Limit': rateLimit.limit.toString(),
      'X-RateLimit-Remaining': rateLimit.remaining.toString(),
      'X-RateLimit-Reset': rateLimit.reset.toISOString(),
    }

    // Load metric configurations
    let metricConfigs: MetricConfig[] = []

    if (user) {
      // Load user-specific configurations
      const { data: userConfigs, error: configError } = await supabase
        .from('metric_configurations')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('display_order')

      if (configError) {
        console.error('Failed to load user configurations:', configError)
        // Fall back to defaults on error
      } else if (userConfigs && userConfigs.length > 0) {
        metricConfigs = userConfigs.map((config) => ({
          id: config.id,
          name: config.name,
          prompt_text: config.prompt_text,
          is_active: config.is_active,
          display_order: config.display_order,
        }))
        console.log(`Loaded ${metricConfigs.length} user-specific configurations`)
      }
    }

    // If no user configs or guest, load defaults
    if (metricConfigs.length === 0) {
      const { data: defaultConfigs, error: defaultError } = await supabase
        .from('metric_configurations')
        .select('*')
        .is('user_id', null)
        .eq('is_active', true)
        .order('display_order')

      if (defaultError) {
        console.error('Failed to load default configurations:', defaultError)
        return NextResponse.json({ error: 'Failed to load metric configurations' }, { status: 500 })
      }

      if (defaultConfigs && defaultConfigs.length > 0) {
        metricConfigs = defaultConfigs.map((config) => ({
          id: config.id,
          name: config.name,
          prompt_text: config.prompt_text,
          is_active: config.is_active,
          display_order: config.display_order,
        }))
        console.log(`Loaded ${metricConfigs.length} default configurations`)
      }
    }

    if (metricConfigs.length === 0) {
      return NextResponse.json({ error: 'No metric configurations available' }, { status: 500 })
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
      finalModelId = undefined
    }

    // Initialize LLM service
    const llmService = new DynamicLLMService(finalModelId)

    console.log('Final model to use:', finalModelId || llmService.getCurrentModel())
    console.log('Metrics to analyze:', metricConfigs.length)
    console.log('====================')

    // Create analysis record with user_id and configuration_snapshot
    const analysisId = globalThis.crypto.randomUUID()
    const analysis: InsertAnalysis & {
      user_id?: string
      configuration_snapshot?: any
    } = {
      content,
      status: 'running',
      model_used: finalModelId || llmService.getCurrentModel(),
      user_id: user?.id || null,
      configuration_snapshot: {
        metrics: metricConfigs,
        studentCharacter: normalizedCharacter,
      }, // Save the exact configs used
    }

    const { error: insertError } = await supabaseAdmin
      .from('analyses')
      .insert({ ...analysis, id: analysisId })

    if (insertError) {
      logger.error('Failed to create analysis', { error: insertError })
      return NextResponse.json({ error: 'Failed to create analysis' }, { status: 500 })
    }

    // Initialize progress tracking
    await progressService.initializeProgress(
      analysisId,
      metricConfigs.map((c) => c.name),
    )

    // Log analysis start
    logger.analysisStart({
      analysisId,
      contentLength: content.length,
      model: analysis.model_used!,
      metricsCount: metricConfigs.length,
    })

    // Run analysis with dynamic configurations
    const startTime = Date.now()

    console.log(`\n📊 Analyzing ${metricConfigs.length} metrics with dynamic configurations...`)

    try {
      // Use the new dynamic analysis method
      const analysisResponse = await llmService.analyzeWithConfigs(content, {
        configurations: metricConfigs,
        model: finalModelId,
        studentCharacter: normalizedCharacter,
      })

      const totalDuration = Date.now() - startTime

      // Process results for storage
      const results: Record<string, unknown> = {}
      let successCount = 0
      let failCount = 0

      for (const result of analysisResponse.results) {
        if (!result.error) {
          results[result.metric] = {
            score: result.score,
            comment: result.feedback,
            model: analysisResponse.model,
          }
          successCount++

          // Update progress
          await progressService.updateMetricProgress(analysisId, result.metric, 'completed', 100)
        } else {
          results[result.metric] = { error: result.error }
          failCount++

          // Update progress
          await progressService.updateMetricProgress(analysisId, result.metric, 'failed', 0)
        }

        // Store LLM request record for audit
        await supabaseAdmin.from('llm_requests').insert({
          analysis_id: analysisId,
          metric: result.metric,
          prompt: `[${result.metric} analysis]`,
          response: result.error ? null : result,
          model: analysisResponse.model,
          duration: analysisResponse.duration,
          error: result.error,
        })
      }

      // Add overall score
      results.overallScore = analysisResponse.overallScore

      // Determine final status
      const finalStatus =
        successCount === metricConfigs.length
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

      console.log('\n🎯 ANALYSIS V2 COMPLETE')
      console.log('Analysis ID:', analysisId)
      console.log('User ID:', user?.id || 'Guest')
      console.log('Status:', finalStatus)
      console.log('Success count:', successCount)
      console.log('Fail count:', failCount)
      console.log('Total duration:', totalDuration, 'ms')
      console.log('Overall score:', analysisResponse.overallScore)
      console.log('=================\n')

      // Clean up progress tracking
      progressService.cleanup(analysisId)

      // Return analysis ID and status with rate limit headers
      return NextResponse.json(
        {
          analysisId,
          status: finalStatus,
          userId: user?.id || null,
          metricsCount: metricConfigs.length,
        },
        {
          headers: rateLimitHeaders,
        },
      )
    } catch (error) {
      // Update analysis status to failed
      await supabaseAdmin
        .from('analyses')
        .update({
          status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', analysisId)

      logger.error('Analysis processing error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        analysisId,
      })

      return NextResponse.json({ error: 'Failed to process analysis' }, { status: 500 })
    }
  } catch (error) {
    logger.error('Analyze V2 endpoint error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET endpoint to check analysis status
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const analysisId = searchParams.get('id')

  if (!analysisId) {
    return NextResponse.json({ error: 'Analysis ID required' }, { status: 400 })
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Build query based on authentication status
  let query = supabase.from('analyses').select('*').eq('id', analysisId)

  // If authenticated, ensure user owns the analysis
  // If guest, only allow analyses with null user_id
  if (user) {
    query = query.eq('user_id', user.id)
  } else {
    query = query.is('user_id', null)
  }

  const { data, error } = await query.single()

  if (error || !data) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 })
  }

  return NextResponse.json({
    id: data.id,
    status: data.status,
    results: data.results,
    createdAt: data.created_at,
    userId: data.user_id,
  })
}
