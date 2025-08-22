import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase/server'

interface RouteParams {
  params: {
    id: string
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient()
    const { id } = params
    
    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch program with lessons
    const { data: program, error } = await supabase
      .from('programs')
      .select(`
        *,
        program_lessons(
          id,
          title,
          source_url,
          sort_order,
          content_hash,
          last_fetched_at,
          is_active
        ),
        program_runs(
          id,
          status,
          total_lessons,
          processed_lessons,
          succeeded,
          failed,
          created_at,
          finished_at
        )
      `)
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !program) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 })
    }

    // Sort lessons by order
    if (program.program_lessons) {
      program.program_lessons.sort((a: any, b: any) => a.sort_order - b.sort_order)
    }

    // Sort runs by creation date (newest first)
    if (program.program_runs) {
      program.program_runs.sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    }

    return NextResponse.json({ program })
  } catch (error) {
    console.error('Error in GET /api/programs/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient()
    const { id } = params
    
    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check program ownership
    const { data: program, error: checkError } = await supabase
      .from('programs')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (checkError || !program) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 })
    }

    // Soft delete by setting is_active to false
    const { error } = await supabase
      .from('programs')
      .update({ is_active: false })
      .eq('id', id)

    if (error) {
      console.error('Error deleting program:', error)
      return NextResponse.json({ error: 'Failed to delete program' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Program deleted successfully' })
  } catch (error) {
    console.error('Error in DELETE /api/programs/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}