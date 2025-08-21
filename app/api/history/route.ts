import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase/server'

/**
 * GET /api/history
 * Fetch user's analysis history with pagination and filtering
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')
    const search = searchParams.get('search') || ''
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const modelUsed = searchParams.get('model')

    // Calculate offset
    const offset = (page - 1) * pageSize

    // Build query
    let query = supabase
      .from('analyses')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    // Apply filters
    if (search) {
      query = query.ilike('content', `%${search}%`)
    }

    if (startDate) {
      query = query.gte('created_at', startDate)
    }

    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    if (modelUsed) {
      query = query.eq('model_used', modelUsed)
    }

    // Apply pagination
    query = query.range(offset, offset + pageSize - 1)

    const { data: analyses, error, count } = await query

    if (error) {
      console.error('Failed to fetch analyses:', error)
      return NextResponse.json({ error: 'Failed to fetch analysis history' }, { status: 500 })
    }

    // Calculate pagination metadata
    const totalPages = Math.ceil((count || 0) / pageSize)
    const hasNextPage = page < totalPages
    const hasPreviousPage = page > 1

    return NextResponse.json({
      analyses: analyses || [],
      pagination: {
        page,
        pageSize,
        totalItems: count || 0,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      },
    })
  } catch (error) {
    console.error('History API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/history/compare
 * Find analyses with similar content for comparison
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { analysisId, contentSimilarityThreshold = 0.8 } = body

    // Get the reference analysis
    const { data: referenceAnalysis, error: refError } = await supabase
      .from('analyses')
      .select('*')
      .eq('id', analysisId)
      .eq('user_id', user.id)
      .single()

    if (refError || !referenceAnalysis) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 })
    }

    // Find similar analyses (simplified - in production, use vector similarity)
    // For now, we'll find analyses with similar content length
    const contentLength = referenceAnalysis.content.length
    const lengthTolerance = contentLength * 0.2 // 20% tolerance

    const { data: similarAnalyses, error: simError } = await supabase
      .from('analyses')
      .select('*')
      .eq('user_id', user.id)
      .neq('id', analysisId)
      .gte('char_length(content)', contentLength - lengthTolerance)
      .lte('char_length(content)', contentLength + lengthTolerance)
      .order('created_at', { ascending: false })
      .limit(10)

    if (simError) {
      console.error('Failed to find similar analyses:', simError)
      return NextResponse.json({ error: 'Failed to find similar analyses' }, { status: 500 })
    }

    return NextResponse.json({
      referenceAnalysis,
      similarAnalyses: similarAnalyses || [],
    })
  } catch (error) {
    console.error('Compare API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
