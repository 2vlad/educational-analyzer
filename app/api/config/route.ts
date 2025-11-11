import { NextResponse } from 'next/server'
import { env } from '@/src/config/env'

export async function GET() {
  try {
    // Return configuration that frontend needs
    const config = {
      maxFileSizeMB: env.server?.MAX_FILE_SIZE_MB || 10,
      maxTextLength: env.server?.MAX_TEXT_LENGTH || 20000,
    }

    return NextResponse.json(config)
  } catch (error) {
    console.error('[Config API] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch configuration' }, { status: 500 })
  }
}
