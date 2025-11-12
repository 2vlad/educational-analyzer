import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase/server'

interface RouteParams {
  params: Promise<{
    id: string
    lessonId: string
  }>
}

/**
 * GET /api/programs/[id]/lessons/[lessonId]/analysis
 *
 * Returns the latest completed analysis for a lesson
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: programId, lessonId } = await params
    const supabase = await createClient()

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify program ownership
    const { data: program, error: programError } = await supabase
      .from('programs')
      .select('id, user_id')
      .eq('id', programId)
      .eq('user_id', user.id)
      .single()

    if (programError || !program) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 })
    }

    // Verify lesson belongs to program
    const { data: lesson, error: lessonError } = await supabase
      .from('program_lessons')
      .select('id, program_id')
      .eq('id', lessonId)
      .eq('program_id', programId)
      .single()

    if (lessonError || !lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
    }

    // Get latest completed analysis for this lesson
    const { data: analysis, error: analysisError } = await supabase
      .from('analyses')
      .select('*')
      .eq('lesson_id', lessonId)
      .eq('status', 'completed')
      .not('results', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (analysisError || !analysis) {
      // No analysis found - return 404
      return NextResponse.json({ analysis: null }, { status: 404 })
    }

    return NextResponse.json({ analysis })
  } catch (error) {
    console.error('Error in GET /api/programs/[id]/lessons/[lessonId]/analysis:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
