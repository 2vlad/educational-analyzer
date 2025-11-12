import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase/server'

interface RouteParams {
  params: Promise<{
    id: string
    lessonId: string
  }>
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: programId, lessonId } = await params
    const supabase = await createClient()

    console.log('[DELETE /api/programs/[id]/lessons/[lessonId]] Request:', {
      programId,
      lessonId,
    })

    // Get user session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    console.log('[DELETE /api/programs/[id]/lessons/[lessonId]] Auth check:', {
      hasUser: !!user,
      userId: user?.id,
    })

    if (authError || !user) {
      console.error(
        '[DELETE /api/programs/[id]/lessons/[lessonId]] Unauthorized:',
        authError?.message,
      )
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Please log in to delete lessons' },
        { status: 401 },
      )
    }

    // Verify user owns the program
    const { data: program, error: programError } = await supabase
      .from('programs')
      .select('id')
      .eq('id', programId)
      .eq('user_id', user.id)
      .single()

    if (programError || !program) {
      console.error('[DELETE /api/programs/[id]/lessons/[lessonId]] Program not found:', {
        programId,
        userId: user.id,
        error: programError?.message,
      })
      return NextResponse.json({ error: 'Program not found' }, { status: 404 })
    }

    // Delete the lesson
    const { error: deleteError } = await supabase
      .from('program_lessons')
      .delete()
      .eq('id', lessonId)
      .eq('program_id', programId)

    if (deleteError) {
      console.error('[DELETE /api/programs/[id]/lessons/[lessonId]] Error deleting lesson:', {
        lessonId,
        error: deleteError.message,
        errorDetails: deleteError,
      })
      return NextResponse.json({ error: 'Failed to delete lesson' }, { status: 500 })
    }

    console.log('[DELETE /api/programs/[id]/lessons/[lessonId]] Success:', {
      lessonId,
      programId,
    })

    return NextResponse.json({ message: 'Lesson deleted successfully' })
  } catch (error) {
    console.error('Error in DELETE /api/programs/[id]/lessons/[lessonId]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
