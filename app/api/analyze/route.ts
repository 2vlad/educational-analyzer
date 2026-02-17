import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/src/lib/supabaseServer'
import { runAnalysisInternal } from '@/src/services/AnalysisRunner'
import { env } from '@/src/config/env'
import { createClient } from '@/src/lib/supabase/server'

// Use Node runtime so we can access fs to read prompts
export const runtime = 'nodejs'

// Get max text length from env or use default
const maxTextLength = env.server?.MAX_TEXT_LENGTH || 20000

// Metric configuration schema
const metricConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  prompt_text: z.string(),
  is_active: z.boolean(),
  display_order: z.number(),
})

// Request schema
const analyzeRequestSchema = z.object({
  content: z.string().min(1).max(maxTextLength),
  modelId: z.string().optional(),
  metricMode: z.enum(['lx', 'custom']).optional(),
  configurations: z.array(metricConfigSchema).optional(),
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
    console.log('Analyze request received')

    // Parse and validate request body
    const body = await request.json()
    const validation = analyzeRequestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 },
      )
    }

    const { content, modelId, metricMode, configurations } = validation.data

    console.log('=== ANALYZE REQUEST ===')
    console.log('Model ID received:', modelId)
    console.log('Content length:', content.length)
    console.log('Metric mode:', metricMode)
    console.log(
      'Custom configurations:',
      configurations ? `${configurations.length} metrics` : 'none',
    )

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

    console.log('Final model to use:', finalModelId)
    console.log('====================')

    // Create supabase client for auth check
    const supabase = await createClient()
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    // Get user's custom metrics if in custom mode
    let metricConfiguration = undefined
    if (metricMode === 'custom') {
      try {
        // Priority 1: Use configurations from request (for guest users or override)
        if (configurations && configurations.length > 0) {
          // Filter active and sort by display order
          metricConfiguration = configurations
            .filter((c) => c.is_active)
            .sort((a, b) => a.display_order - b.display_order)
          console.log(`Using ${metricConfiguration.length} custom metrics from request`)
        }
        // Priority 2: Fetch from database for authenticated users
        else if (authUser) {
          // Fetch user's custom metrics
          const { data: configs, error } = await supabaseAdmin
            .from('metric_configurations')
            .select('*')
            .eq('user_id', authUser.id)
            .eq('is_active', true)
            .order('display_order')

          if (!error && configs && configs.length > 0) {
            metricConfiguration = configs
            console.log(`Loaded ${configs.length} custom metrics from database`)
            // Debug: Log the metrics to see if they have prompt_text
            configs.forEach((config) => {
              console.log(`Metric: ${config.name}, has prompt_text: ${!!config.prompt_text}`)
            })
          } else {
            console.log('No custom metrics found in database, using defaults')
          }
        } else {
          console.log('No authenticated user and no configurations provided, using default metrics')
        }
      } catch (error) {
        console.error('Error processing custom metrics:', error)
        // Will fall back to default metrics
      }
    }

    // Get or create session ID for guest users
    let sessionId: string | undefined
    if (!authUser) {
      // For guest users, use or create a session ID
      sessionId =
        request.headers.get('x-session-id') ||
        request.cookies.get('session_id')?.value ||
        globalThis.crypto.randomUUID()
    }

    // Run the analysis using the extracted function
    const result = await runAnalysisInternal(supabaseAdmin, {
      content,
      modelId: finalModelId,
      metricMode: metricMode || 'lx',
      metricConfiguration,
      userId: authUser?.id,
      sessionId,
    })

    // Create response with session ID for guest users
    const response = NextResponse.json({
      analysisId: result.id,
      status: result.status,
      sessionId: sessionId, // Include session ID for client to store
    })

    // Set session cookie for guest users
    if (sessionId && !authUser) {
      response.cookies.set('session_id', sessionId, {
        httpOnly: false, // Allow client-side access
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      })
    }

    return response
  } catch (error) {
    console.error(
      'Analyze endpoint error:',
      error instanceof Error ? error.message : 'Unknown error',
    )

    // Return more specific error message
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      {
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
      { status: 500 },
    )
  }
}
