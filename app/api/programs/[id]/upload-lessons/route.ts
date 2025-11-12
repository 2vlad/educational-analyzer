import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase/server'
import { createHash } from 'crypto'

interface FileUpload {
  fileName: string
  content: string
  fileSize: number
  isBase64?: boolean
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  console.log('[UploadLessons API] === START ===')
  try {
    const { id: programId } = await params
    console.log('[UploadLessons API] Program ID:', programId)

    const supabase = await createClient()

    // Get user session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    console.log('[UploadLessons API] User auth:', user ? `✅ ${user.id}` : '❌ Not authenticated')

    if (authError || !user) {
      console.error('[UploadLessons API] Auth error:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify program exists and belongs to user
    console.log('[UploadLessons API] Checking program access...')
    const { data: program, error: programError } = await supabase
      .from('programs')
      .select('id, source_type')
      .eq('id', programId)
      .eq('user_id', user.id)
      .single()

    console.log(
      '[UploadLessons API] Program found:',
      program ? `✅ ${program.source_type}` : '❌ Not found',
    )

    if (programError || !program) {
      console.error('[UploadLessons API] Program error:', programError)
      return NextResponse.json({ error: 'Program not found' }, { status: 404 })
    }

    // Only allow uploads for manual programs
    if (program.source_type !== 'manual') {
      console.log('[UploadLessons API] ❌ Wrong source_type:', program.source_type)
      return NextResponse.json(
        { error: 'File uploads only allowed for manual programs' },
        { status: 400 },
      )
    }

    // Parse request body
    console.log('[UploadLessons API] Parsing request body...')
    const body = (await request.json()) as { files: FileUpload[] }
    const { files } = body

    console.log('[UploadLessons API] Files received:', files?.length || 0)

    if (!files || !Array.isArray(files) || files.length === 0) {
      console.log('[UploadLessons API] ❌ No files provided')
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    if (files.length > 100) {
      console.log('[UploadLessons API] ❌ Too many files:', files.length)
      return NextResponse.json({ error: 'Maximum 100 files allowed' }, { status: 400 })
    }

    // Get current max sort_order for this program
    console.log('[UploadLessons API] Getting max sort_order...')
    const { data: existingLessons } = await supabase
      .from('program_lessons')
      .select('sort_order')
      .eq('program_id', programId)
      .order('sort_order', { ascending: false })
      .limit(1)

    const maxSortOrder = existingLessons?.[0]?.sort_order ?? -1
    console.log('[UploadLessons API] Max sort_order:', maxSortOrder)

    // Create lessons from files
    console.log('[UploadLessons API] Processing files...')
    const lessonsToInsert = files.map((file, index) => {
      console.log(`[UploadLessons API] Processing file ${index + 1}/${files.length}:`, {
        fileName: file.fileName,
        fileSize: file.fileSize,
        isBase64: file.isBase64,
        contentLength: file.content?.length,
      })

      // Decode base64 content if needed
      let content = file.content
      if (file.isBase64) {
        try {
          console.log(`[UploadLessons API] Decoding base64 for ${file.fileName}...`)
          // Decode base64 to buffer, then to utf8 string
          const buffer = Buffer.from(file.content, 'base64')
          content = buffer.toString('utf8')
          console.log(`[UploadLessons API] ✅ Decoded: ${content.length} chars`)
        } catch (error) {
          console.error(`[UploadLessons API] ❌ Error decoding base64 for ${file.fileName}:`, error)
          // Use original content if decoding fails
          content = file.content
        }
      }

      // Generate content hash
      const contentHash = createHash('sha256').update(content).digest('hex')
      console.log(
        `[UploadLessons API] Content hash for ${file.fileName}:`,
        contentHash.substring(0, 8) + '...',
      )

      const lesson = {
        program_id: programId,
        title: file.fileName.replace(/\.[^/.]+$/, ''), // Remove extension
        file_name: file.fileName,
        content: content,
        file_size: file.fileSize,
        content_hash: contentHash,
        sort_order: maxSortOrder + 1 + index, // Start after existing lessons
        is_active: true,
      }

      console.log(`[UploadLessons API] Lesson ${index + 1} prepared:`, {
        title: lesson.title,
        sort_order: lesson.sort_order,
        content_length: lesson.content.length,
      })

      return lesson
    })

    // Insert lessons in batch
    console.log('[UploadLessons API] Inserting', lessonsToInsert.length, 'lessons into database...')
    const { data: lessons, error: insertError } = await supabase
      .from('program_lessons')
      .insert(lessonsToInsert)
      .select()

    if (insertError) {
      console.error('[UploadLessons API] ❌ Error inserting lessons:', insertError)
      return NextResponse.json(
        { error: 'Failed to save lessons', details: insertError.message },
        { status: 500 },
      )
    }

    console.log('[UploadLessons API] ✅ Successfully inserted', lessons?.length || 0, 'lessons')
    console.log('[UploadLessons API] === END ===')

    return NextResponse.json({
      success: true,
      lessonsCreated: lessons?.length || 0,
      lessons: lessons,
    })
  } catch (error) {
    console.error('[UploadLessons API] ❌ EXCEPTION:', error)
    if (error instanceof Error) {
      console.error('[UploadLessons API] Stack trace:', error.stack)
    }
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
