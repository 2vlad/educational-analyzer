import { NextRequest, NextResponse } from 'next/server'

// Simple PDF text extraction without external library
async function extractTextFromPDF(buffer: Buffer): Promise<{ text: string; pages: number }> {
  const text = buffer.toString('utf-8')

  // Basic PDF text extraction (works for simple PDFs)
  const textContent: string[] = []
  let pageCount = 0

  // Count pages
  const pageMatches = text.match(/\/Type\s*\/Page[^s]/g)
  pageCount = pageMatches ? pageMatches.length : 1

  // Extract text between BT and ET markers (text objects in PDF)
  const textMatches = text.matchAll(/BT(.*?)ET/gs)
  for (const match of textMatches) {
    const content = match[1]
    // Extract text from Tj and TJ operators
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
      textContent.push(extractedText)
    }
  }

  // Also try to extract text from stream objects
  const streamMatches = text.matchAll(/stream(.*?)endstream/gs)
  for (const match of streamMatches) {
    const stream = match[1]
    // Look for readable text patterns
    const readableText = stream.match(/[a-zA-Z0-9\s.,;:!?'"()-]{20,}/g)
    if (readableText) {
      textContent.push(...readableText)
    }
  }

  const extractedText = textContent.join(' ').replace(/\s+/g, ' ').trim()

  return {
    text:
      extractedText ||
      'Could not extract text from PDF. Please try copying and pasting the text directly.',
    pages: pageCount,
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as globalThis.File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Check file type
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 })
    }

    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 10MB' }, { status: 400 })
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Try to extract text from PDF
    let result = { text: '', pages: 1 }

    try {
      // First check if it's actually a PDF
      const pdfHeader = buffer.toString('utf-8', 0, Math.min(5, buffer.length))
      if (!pdfHeader.startsWith('%PDF')) {
        return NextResponse.json({ error: 'Invalid PDF file' }, { status: 400 })
      }

      // Extract text
      result = await extractTextFromPDF(buffer)
    } catch (parseError) {
      console.error('PDF extraction error:', parseError)
      // Fallback message
      result.text =
        'Could not extract text from this PDF. The file may be image-based, encrypted, or use complex formatting. Please try copying and pasting the text directly.'
    }

    // Clean up the text
    let text = result.text
      .replace(/\r\n/g, '\n') // Normalize line breaks
      .replace(/\n{3,}/g, '\n\n') // Remove excessive line breaks
      .replace(/[ \t]+/g, ' ') // Normalize spaces
      .trim()

    // Check if text was extracted
    if (!text || text.length < 50) {
      return NextResponse.json(
        {
          error:
            'Could not extract sufficient text from PDF. Please try copying and pasting the text directly.',
          text: text || '',
          pages: result.pages,
        },
        { status: 400 },
      )
    }

    // Truncate to 20000 characters if needed
    const truncated = text.length > 20000
    if (truncated) {
      text = text.substring(0, 20000)
    }

    return NextResponse.json({
      text,
      truncated,
      pages: result.pages,
      originalLength: text.length,
    })
  } catch (error) {
    console.error('PDF parsing error:', error)

    return NextResponse.json(
      { error: 'Failed to parse PDF file. Please try copying and pasting the text directly.' },
      { status: 500 },
    )
  }
}
