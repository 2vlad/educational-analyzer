import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase/server'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: programId } = await params
    const supabase = await createClient()
    
    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user owns the program
    const { data: program, error: programError } = await supabase
      .from('programs')
      .select('id')
      .eq('id', programId)
      .eq('user_id', user.id)
      .single()

    if (programError || !program) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 })
    }

    // Get lessons for the program
    const { data: lessons, error: lessonsError } = await supabase
      .from('program_lessons')
      .select('*')
      .eq('program_id', programId)
      .order('sort_order', { ascending: true })

    if (lessonsError) {
      console.error('Error fetching lessons:', lessonsError)
      return NextResponse.json(
        { error: 'Failed to fetch lessons' },
        { status: 500 }
      )
    }

    return NextResponse.json({ lessons: lessons || [] })
  } catch (error) {
    console.error('Error in GET /api/programs/[id]/lessons:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
