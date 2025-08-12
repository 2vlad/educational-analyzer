import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseServer'
import { env } from '@/config/env'

export async function GET(request: NextRequest) {
  try {
    // Simple auth check - you can improve this with proper auth
    const authHeader = request.headers.get('authorization')
    const expectedToken = env.server?.RATE_LIMIT_SALT // Using salt as simple token for now
    
    if (authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')
    const level = searchParams.get('level')
    const search = searchParams.get('search')

    // Build query
    let query = supabaseAdmin
      .from('system_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (level) {
      query = query.eq('level', level)
    }
    if (search) {
      query = query.ilike('message', `%${search}%`)
    }

    const { data: logs, error, count } = await query

    if (error) {
      console.error('Logs fetch error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch logs' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      logs: logs || [],
      pagination: {
        limit,
        offset,
        total: count || 0
      }
    })

  } catch (error) {
    console.error('Logs endpoint error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}