import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase/server'
import { createHash } from 'crypto'

interface FileUpload {
  fileName: string
  content: string
  fileSize: number
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: programId } = await params
    const supabase = await createClient()

    // Get user session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify program exists and belongs to user
    const { data: program, error: programError } = await supabase
      .from('programs')
      .select('id, source_type')
      .eq('id', programId)
      .eq('user_id', user.id)
      .single()

    if (programError || !program) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 })
    }

    // Only allow uploads for manual programs
    if (program.source_type !== 'manual') {
      return NextResponse.json(
        { error: 'File uploads only allowed for manual programs' },
        { status: 400 },
      )
    }

    // Parse request body
    const body = (await request.json()) as { files: FileUpload[] }
    const { files } = body

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    if (files.length > 100) {
      return NextResponse.json({ error: 'Maximum 100 files allowed' }, { status: 400 })
    }

    // Create lessons from files
    const lessonsToInsert = files.map((file, index) => {
      // Generate content hash
      const contentHash = createHash('sha256').update(file.content).digest('hex')

      return {
        program_id: programId,
        title: file.fileName.replace(/\.[^/.]+$/, ''), // Remove extension
        file_name: file.fileName,
        content: file.content,
        file_size: file.fileSize,
        content_hash: contentHash,
        sort_order: index,
        is_active: true,
      }
    })

    // Insert lessons in batch
    const { data: lessons, error: insertError } = await supabase
      .from('program_lessons')
      .insert(lessonsToInsert)
      .select()

    if (insertError) {
      console.error('Error inserting lessons:', insertError)
      return NextResponse.json(
        { error: 'Failed to save lessons', details: insertError.message },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      lessonsCreated: lessons?.length || 0,
      lessons: lessons,
    })
  } catch (error) {
    console.error('Error uploading lessons:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
