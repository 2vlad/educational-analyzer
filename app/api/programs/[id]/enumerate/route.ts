import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase/server'
import { ScraperService } from '@/src/services/ScraperService'
import { decryptFromStorage } from '@/src/services/crypto/secretBox'

interface RouteParams {
  params: {
    id: string
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient()
    const { id } = params

    // Get user session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch program with credential
    const { data: program, error: programError } = await supabase
      .from('programs')
      .select(
        `
        *,
        external_credentials(
          id,
          cookie_encrypted
        )
      `,
      )
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (programError || !program) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 })
    }

    // Get the appropriate adapter
    const adapter = ScraperService.getAdapter(program.source_type)
    if (!adapter) {
      return NextResponse.json(
        { error: `No adapter found for source type: ${program.source_type}` },
        { status: 400 },
      )
    }

    // Prepare auth context
    let authContext: any = {}
    if (program.external_credentials?.cookie_encrypted) {
      const appSecretKey = process.env.APP_SECRET_KEY
      if (!appSecretKey) {
        return NextResponse.json(
          { error: 'Server configuration error: APP_SECRET_KEY not set' },
          { status: 500 },
        )
      }

      try {
        authContext.cookie = decryptFromStorage(
          program.external_credentials.cookie_encrypted,
          appSecretKey,
        )
      } catch (error) {
        return NextResponse.json(
          { error: 'Failed to decrypt credentials. Please update your Yonote connection.' },
          { status: 401 },
        )
      }
    }

    // Enumerate lessons
    let lessons
    try {
      lessons = await adapter.enumerateLessons(program.root_url, authContext)
    } catch (error: any) {
      if (error.message === 'SESSION_EXPIRED') {
        return NextResponse.json(
          { error: 'Yonote session expired. Please update your credentials.' },
          { status: 401 },
        )
      }
      throw error
    }

    // Delete existing lessons for this program
    const { error: deleteError } = await supabase
      .from('program_lessons')
      .delete()
      .eq('program_id', id)

    if (deleteError) {
      console.error('Error deleting old lessons:', deleteError)
    }

    // Insert new lessons
    const lessonsToInsert = lessons.map((lesson, index) => ({
      program_id: id,
      title: lesson.title,
      source_url: lesson.url,
      sort_order: lesson.order ?? index,
      is_active: true,
    }))

    const { data: insertedLessons, error: insertError } = await supabase
      .from('program_lessons')
      .insert(lessonsToInsert)
      .select()

    if (insertError) {
      console.error('Error inserting lessons:', insertError)
      return NextResponse.json({ error: 'Failed to save lessons' }, { status: 500 })
    }

    return NextResponse.json({
      message: `Successfully enumerated ${lessons.length} lessons`,
      count: lessons.length,
      lessons: insertedLessons,
    })
  } catch (error: any) {
    console.error('Error in POST /api/programs/[id]/enumerate:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to enumerate lessons' },
      { status: 500 },
    )
  }
}
