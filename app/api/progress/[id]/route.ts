import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { progressService } from '@/src/services/ProgressService'

// Validate UUID format
const uuidSchema = z.string().uuid()

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Await params as required in Next.js 15
    const { id } = await params

    // Validate ID format
    const validation = uuidSchema.safeParse(id)
    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid analysis ID format' }, { status: 400 })
    }

    // Get current progress from database
    const progress = await progressService.getProgressFromDb(id)

    if (!progress) {
      return NextResponse.json(
        { error: 'Analysis not found or no progress available' },
        { status: 404 },
      )
    }

    // Return progress as JSON for polling
    return NextResponse.json(progress)
  } catch (error) {
    console.error('Progress endpoint error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
