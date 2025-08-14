import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { progressService } from '@/src/services/ProgressService'
import type { AnalysisProgress } from '@/src/services/ProgressService'

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

    // Set up SSE headers
    const headers = new globalThis.Headers({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
    })

    // Create a readable stream for SSE
    const stream = new globalThis.ReadableStream({
      async start(controller) {
        const encoder = new globalThis.TextEncoder()

        // Send initial progress from database
        const initialProgress = await progressService.getProgressFromDb(id)
        if (initialProgress) {
          const data = `data: ${JSON.stringify(initialProgress)}\n\n`
          controller.enqueue(encoder.encode(data))
        }

        // Set up progress listener
        const progressListener = (progress: AnalysisProgress) => {
          try {
            const data = `data: ${JSON.stringify(progress)}\n\n`
            controller.enqueue(encoder.encode(data))
          } catch (error) {
            console.error('Error sending progress update:', error)
          }
        }

        // Register listener
        progressService.addListener(id, progressListener)

        // Send heartbeat every 30 seconds to keep connection alive
        const heartbeatInterval = globalThis.setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': heartbeat\n\n'))
          } catch {
            // Connection closed
            globalThis.clearInterval(heartbeatInterval)
          }
        }, 30000)

        // Handle client disconnect
        request.signal.addEventListener('abort', () => {
          progressService.removeListener(id, progressListener)
          globalThis.clearInterval(heartbeatInterval)
          controller.close()
        })

        // Clean up after 5 minutes (max analysis time)
        globalThis.setTimeout(() => {
          progressService.removeListener(id, progressListener)
          globalThis.clearInterval(heartbeatInterval)
          controller.close()
        }, 5 * 60 * 1000)
      },
    })

    return new globalThis.Response(stream, { headers })
  } catch (error) {
    console.error('Progress SSE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}