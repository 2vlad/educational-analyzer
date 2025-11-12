import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase/server'
import { z } from 'zod'

const createProgramSchema = z
  .object({
    name: z.string().min(1).max(255),
    sourceType: z.enum(['yonote', 'generic_list', 'manual']),
    rootUrl: z.string().url().optional(),
    credentialId: z.string().uuid().optional(),
  })
  .refine(
    (data) => {
      // rootUrl is required for yonote and generic_list, but not for manual
      if (data.sourceType !== 'manual' && !data.rootUrl) {
        return false
      }
      return true
    },
    {
      message: 'rootUrl is required for yonote and generic_list source types',
      path: ['rootUrl'],
    },
  )

export async function GET(request: NextRequest) {
  try {
    console.log('[GET /api/programs] Starting request', {
      url: request.url,
      headers: Object.fromEntries(request.headers.entries()),
    })

    const supabase = await createClient()

    // Get user session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    console.log('[GET /api/programs] Auth check:', {
      hasUser: !!user,
      userId: user?.id,
      email: user?.email,
      authError: authError?.message,
      authErrorDetails: authError,
    })

    if (authError || !user) {
      console.error('[GET /api/programs] Unauthorized - no user session found', {
        authError: authError?.message,
        authErrorDetails: authError,
      })
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Please log in to view programs' },
        { status: 401 },
      )
    }

    // Check if user has profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('id', user.id)
      .single()

    console.log('[GET /api/programs] Profile check:', {
      hasProfile: !!profile,
      profileEmail: profile?.email,
      profileError: profileError?.message,
    })

    // Fetch user's programs with last run summary
    const { data: programs, error } = await supabase
      .from('programs')
      .select(
        `
        *,
        program_runs(
          id,
          status,
          total_lessons,
          processed,
          succeeded,
          failed,
          created_at
        )
      `,
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    console.log('[GET /api/programs] Programs query:', {
      programCount: programs?.length || 0,
      error: error?.message,
      errorDetails: error,
    })

    if (error) {
      console.error('[GET /api/programs] Error fetching programs:', error)
      return NextResponse.json({ error: 'Failed to fetch programs' }, { status: 500 })
    }

    // Format response with last run info
    const formattedPrograms = programs?.map((program) => {
      const lastRun = program.program_runs?.[0]
      return {
        ...program,
        lastRun: lastRun
          ? {
              id: lastRun.id,
              status: lastRun.status,
              progress:
                lastRun.total_lessons > 0 ? (lastRun.processed / lastRun.total_lessons) * 100 : 0,
              totalLessons: lastRun.total_lessons,
              processedLessons: lastRun.processed,
              succeeded: lastRun.succeeded,
              failed: lastRun.failed,
              createdAt: lastRun.created_at,
            }
          : null,
        program_runs: undefined, // Remove raw runs data
      }
    })

    console.log('[GET /api/programs] Success:', {
      programCount: formattedPrograms?.length || 0,
    })

    return NextResponse.json({ programs: formattedPrograms || [] })
  } catch (error) {
    console.error('[GET /api/programs] Caught error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get user session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse and validate request body
    const body = await request.json()
    const validationResult = createProgramSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.errors },
        { status: 400 },
      )
    }

    const { name, sourceType, rootUrl, credentialId } = validationResult.data

    // Validate URL based on source type (skip for manual)
    if (sourceType === 'yonote' && rootUrl) {
      const url = new globalThis.URL(rootUrl)
      const allowedHosts = ['yonote.ru', 'practicum.yandex.ru', 'praktikum.yandex.ru']
      if (!allowedHosts.some((host) => url.hostname.includes(host))) {
        return NextResponse.json(
          { error: 'Invalid Yonote URL. Must be from yonote.ru or practicum domains.' },
          { status: 400 },
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
        root_url: rootUrl || null,
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
