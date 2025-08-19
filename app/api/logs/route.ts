import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Lazy load dependencies to catch import errors
    const [{ supabaseAdmin }, { env }] = await Promise.all([
      import('@/src/lib/supabaseServer').catch(() => ({ supabaseAdmin: null })),
      import('@/src/config/env').catch(() => ({ env: { server: null } })),
    ])

    // Simple auth check - you can improve this with proper auth
    const authHeader = request.headers.get('authorization')
    const expectedToken = env.server?.RATE_LIMIT_SALT // Using salt as simple token for now

    if (authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 503 })
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
      return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 })
    }

    return NextResponse.json({
      logs: logs || [],
      pagination: {
        limit,
        offset,
        total: count || 0,
      },
    })
  } catch (error) {
    console.error('Logs endpoint error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
