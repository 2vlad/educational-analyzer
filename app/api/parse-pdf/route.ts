import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/src/config/env'

// Dynamic import to avoid build issues
async function parsePDF(buffer: Buffer): Promise<{ text: string; pages: number }> {
  try {
    // Dynamic import for serverless compatibility
    const pdfParse = (await import('pdf-parse-new')).default
    const data = await pdfParse(buffer)

    return {
      text: data.text || '',
      pages: data.numpages || 1,
    }
  } catch (error) {
    console.error('[PDF Parser] Error:', error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  console.log('[PDF API] Received PDF parse request')

  try {
    const formData = await request.formData()
    const file = formData.get('file') as globalThis.File

    if (!file) {
      console.log('[PDF API] No file provided in request')
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    console.log('[PDF API] File received:', {
      name: file.name,
      size: file.size,
      type: file.type,
    })

    // Check file type
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      console.log('[PDF API] Invalid file type:', file.type)
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 })
    }

    // Check file size
    const maxSizeMB = env.server?.MAX_FILE_SIZE_MB || 10
    const maxSizeBytes = maxSizeMB * 1024 * 1024
    if (file.size > maxSizeBytes) {
      console.log('[PDF API] File too large:', file.size, 'Max:', maxSizeBytes)
      return NextResponse.json(
        { error: `File size must be less than ${maxSizeMB}MB` },
        { status: 400 },
      )
    }

    // Convert file to buffer
    console.log('[PDF API] Converting file to buffer...')
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Check if it's a valid PDF by checking the header
    const header = buffer.toString('utf-8', 0, Math.min(5, buffer.length))
    if (!header.startsWith('%PDF')) {
      console.log('[PDF API] Invalid PDF header:', header)
      return NextResponse.json({ error: 'Invalid PDF file' }, { status: 400 })
    }

    // Extract text from PDF
    console.log('[PDF API] Starting text extraction...')
    let result = { text: '', pages: 1 }

    try {
      result = await parsePDF(buffer)
      console.log(
        '[PDF API] Extraction successful. Pages:',
        result.pages,
        'Text length:',
        result.text.length,
      )
    } catch (parseError) {
      console.error('[PDF API] PDF extraction failed:', parseError)

      // Try fallback method for simple PDFs
      console.log('[PDF API] Trying fallback extraction method...')
      result = extractTextFallback(buffer)

      if (!result.text) {
        return NextResponse.json(
          {
            error:
              'Unable to extract text from this PDF. The file may be corrupted, image-based, or use unsupported encoding.',
            text: '',
            pages: 0,
          },
          { status: 400 },
        )
      }
    }

    // Clean up the text
    let text = result.text
      .replace(/\r\n/g, '\n') // Normalize line breaks
      .replace(/\n{3,}/g, '\n\n') // Remove excessive line breaks
      .replace(/[ \t]+/g, ' ') // Normalize spaces
      // Remove null characters (Unicode 0000)
      .split('\u0000')
      .join('')
      // Keep only printable ASCII and Cyrillic
      .replace(/[^\x20-\x7E\u0400-\u04FF\n]/g, '')
      .trim()

    console.log('[PDF API] Cleaned text length:', text.length)

    // Check if sufficient text was extracted
    if (!text || text.length < 50) {
      console.log('[PDF API] Insufficient text extracted')
      return NextResponse.json(
        {
          error:
            'Could not extract sufficient text from PDF. The file may be image-based or contain only graphics.',
          text: text || '',
          pages: result.pages,
        },
        { status: 400 },
      )
    }

    // Truncate to 20000 characters if needed
    const truncated = text.length > 20000
    if (truncated) {
      console.log('[PDF API] Truncating text from', text.length, 'to 20000 characters')
      text = text.substring(0, 20000)
    }

    const processingTime = Date.now() - startTime
    console.log('[PDF API] Successfully processed PDF in', processingTime, 'ms')

    return NextResponse.json({
      text,
      truncated,
      pages: result.pages,
      originalLength: result.text.length,
      processingTime,
    })
  } catch (error) {
    const processingTime = Date.now() - startTime
    console.error('[PDF API] Unexpected error after', processingTime, 'ms:', error)

    return NextResponse.json(
      {
        error: 'Failed to process PDF file. Please try again or paste the text directly.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

// Fallback method for simple text extraction
function extractTextFallback(buffer: Buffer): { text: string; pages: number } {
  console.log('[PDF Fallback] Attempting basic text extraction')

  const text = buffer.toString('utf-8', 0, buffer.length)
  const textContent: string[] = []
  let pageCount = 0

  // Count pages
  const pageMatches = text.match(/\/Type\s*\/Page[^s]/g)
  pageCount = pageMatches ? pageMatches.length : 1

  // Extract text between BT and ET markers
  const textMatches = text.matchAll(/BT(.*?)ET/gs)
  for (const match of textMatches) {
    const content = match[1]
    // Extract text from Tj operators
    const tjMatches = content.matchAll(/\((.*?)\)\s*Tj/g)
    for (const tjMatch of tjMatches) {
      let extractedText = tjMatch[1]
      // Basic escape sequence handling
      extractedText = extractedText
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\\(/g, '(')
        .replace(/\\\)/g, ')')
        .replace(/\\\\/g, '\\')

      if (extractedText.trim()) {
        textContent.push(extractedText)
      }
    }
  }

  // Also try to extract from stream objects
  const streamMatches = text.matchAll(/stream(.*?)endstream/gs)
  for (const match of streamMatches) {
    const stream = match[1]
    // Look for readable text patterns
    const readableText = stream.match(/[a-zA-Z0-9\s.,;:!?'"()-]{20,}/g)
    if (readableText) {
      textContent.push(...readableText.filter((t) => t.trim().length > 10))
    }
  }

  const extractedText = textContent.join(' ').replace(/\s+/g, ' ').trim()
  console.log('[PDF Fallback] Extracted text length:', extractedText.length)

  return {
    text: extractedText,
    pages: pageCount,
  }
}
