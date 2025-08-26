import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/src/lib/supabaseServer'
import { runAnalysisInternal } from '@/src/services/AnalysisRunner'
import { env } from '@/src/config/env'
import { createClient } from '@/src/lib/supabase/server'

// Get max text length from env or use default
const maxTextLength = env.server?.MAX_TEXT_LENGTH || 20000

// Request schema
const analyzeRequestSchema = z.object({
  content: z.string().min(1).max(maxTextLength),
  modelId: z.string().optional(),
  metricMode: z.enum(['lx', 'custom']).optional(),
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

    const { content, modelId, metricMode } = validation.data

    console.log('=== ANALYZE REQUEST ===')
    console.log('Model ID received:', modelId)
    console.log('Content length:', content.length)
    console.log('Metric mode:', metricMode)

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

    // Get user's custom metrics if in custom mode
    let metricConfiguration = undefined
    if (metricMode === 'custom') {
      try {
        // Try to get authenticated user
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
          // Fetch user's custom metrics
          const { data: configs, error } = await supabaseAdmin
            .from('metric_configurations')
            .select('*')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .order('display_order')
          
          if (!error && configs && configs.length > 0) {
            metricConfiguration = configs
            console.log(`Loaded ${configs.length} custom metrics for user`)
          } else {
            console.log('No custom metrics found, using defaults')
          }
        } else {
          console.log('No authenticated user, using default metrics for custom mode')
        }
      } catch (error) {
        console.error('Error fetching custom metrics:', error)
        // Will fall back to default metrics
      }
    }

    // Run the analysis using the extracted function
    const result = await runAnalysisInternal(supabaseAdmin, {
      content,
      modelId: finalModelId,
      metricMode: metricMode || 'lx',
      metricConfiguration,
    })

    // Return analysis ID for polling
    return NextResponse.json({
      analysisId: result.id,
      status: result.status,
    })
  } catch (error) {
    console.error('Analyze endpoint error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}