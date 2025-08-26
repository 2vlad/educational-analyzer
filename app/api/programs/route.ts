import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase/server'
import { z } from 'zod'

const createProgramSchema = z.object({
  name: z.string().min(1).max(255),
  sourceType: z.enum(['yonote', 'generic_list']),
  rootUrl: z.string().url(),
  credentialId: z.string().uuid().optional(),
})

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user's programs with last run summary
    const { data: programs, error } = await supabase
      .from('programs')
      .select(`
        *,
        program_runs(
          id,
          status,
          total_lessons,
          processed_lessons,
          succeeded,
          failed,
          created_at
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching programs:', error)
      return NextResponse.json({ error: 'Failed to fetch programs' }, { status: 500 })
    }

    // Format response with last run info
    const formattedPrograms = programs?.map(program => {
      const lastRun = program.program_runs?.[0]
      return {
        ...program,
        lastRun: lastRun ? {
          id: lastRun.id,
          status: lastRun.status,
          progress: lastRun.total_lessons > 0 
            ? (lastRun.processed_lessons / lastRun.total_lessons) * 100 
            : 0,
          totalLessons: lastRun.total_lessons,
          processedLessons: lastRun.processed_lessons,
          succeeded: lastRun.succeeded,
          failed: lastRun.failed,
          createdAt: lastRun.created_at
        } : null,
        program_runs: undefined // Remove raw runs data
      }
    })

    return NextResponse.json({ programs: formattedPrograms || [] })
  } catch (error) {
    console.error('Error in GET /api/programs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse and validate request body
    const body = await request.json()
    const validationResult = createProgramSchema.safeParse(body)
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const { name, sourceType, rootUrl, credentialId } = validationResult.data

    // Validate URL based on source type
    if (sourceType === 'yonote') {
      const url = new URL(rootUrl)
      const allowedHosts = ['yonote.ru', 'practicum.yandex.ru', 'praktikum.yandex.ru']
      if (!allowedHosts.some(host => url.hostname.includes(host))) {
        return NextResponse.json(
          { error: 'Invalid Yonote URL. Must be from yonote.ru or practicum domains.' },
          { status: 400 }
        )
      }
    }

    // Create program
    const { data: program, error } = await supabase
      .from('programs')
      .insert({
        user_id: user.id,
        name,
        source_type: sourceType,
        root_url: rootUrl,
        credential_id: credentialId || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating program:', error)
      return NextResponse.json({ error: 'Failed to create program' }, { status: 500 })
    }

    return NextResponse.json({ program }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/programs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}