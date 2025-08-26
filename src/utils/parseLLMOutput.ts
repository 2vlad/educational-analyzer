import { ProviderError, ERROR_CODES } from '@/src/providers/types'

export interface ParsedOutput {
  score: number
  comment: string
  examples: string[]
  detailed_analysis?: string
  suggestions?: string[]
}

/**
 * Parse LLM output to extract score, comment, and examples
 */
export function parseLLMOutput(text: string): ParsedOutput {
  console.log('\n=== PARSING LLM OUTPUT ===')
  console.log('Input text length:', text.length)
  console.log('First 200 chars:', text.substring(0, 200))

  // Try to parse as JSON first
  const jsonResult = tryParseJSON(text)
  if (jsonResult) {
    console.log('✅ Successfully parsed as JSON')
    console.log('Parsed result:', JSON.stringify(jsonResult, null, 2))
    console.log('========================\n')
    return jsonResult
  }

  console.log('⚠️ JSON parsing failed, trying regex...')
  // Fallback to regex parsing
  const regexResult = parseWithRegex(text)
  console.log('Regex parsed result:', JSON.stringify(regexResult, null, 2))
  console.log('========================\n')
  return regexResult
}

/**
 * Try to parse text as JSON
 */
function tryParseJSON(text: string): ParsedOutput | null {
  try {
    // Look for JSON block in the text - handle incomplete JSON from Claude
    let jsonStr = text

    // First try to extract from code blocks
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/)
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1]
    }

    // Try to find JSON object pattern
    const jsonObjMatch = jsonStr.match(/\{[\s\S]*/)
    if (jsonObjMatch) {
      jsonStr = jsonObjMatch[0]
    }

    // Handle truncated JSON by closing it properly
    if (jsonStr.includes('{') && !jsonStr.trim().endsWith('}')) {
      // Count open and close braces
      const openBraces = (jsonStr.match(/\{/g) || []).length
      const closeBraces = (jsonStr.match(/\}/g) || []).length
      const bracesToAdd = openBraces - closeBraces

      // Try to close arrays and strings if needed
      if (jsonStr.includes('"examples": [') && !jsonStr.includes(']')) {
        jsonStr += '"]'
      }

      // Add missing closing braces
      jsonStr += '}'.repeat(bracesToAdd)
    }

    // Clean up the JSON string to handle +2 notation
    jsonStr = jsonStr.replace(/"score"\s*:\s*\+(\d)/g, '"score": $1')

    const parsed = JSON.parse(jsonStr)

    // Validate the parsed object - handle both number and string scores
    let scoreValue = parsed.score
    if (typeof scoreValue === 'string') {
      scoreValue = parseInt(scoreValue.replace('+', ''))
    }

    if (typeof scoreValue !== 'number' || scoreValue < -2 || scoreValue > 2) {
      return null
    }

    return {
      score: Math.round(scoreValue), // Ensure it's an integer
      comment: parsed.comment || '',
      examples: Array.isArray(parsed.examples)
        ? parsed.examples.slice(0, 2).map((e) => String(e).substring(0, 200))
        : [],
      detailed_analysis: parsed.detailed_analysis || undefined,
      suggestions: Array.isArray(parsed.suggestions)
        ? parsed.suggestions.slice(0, 3).map((s) => String(s).substring(0, 200))
        : undefined,
    }
  } catch {
    // JSON parsing failed, will try regex
    return null
  }
}

/**
 * Parse text using regex patterns
 */
function parseWithRegex(text: string): ParsedOutput {
  // Look for score (-2 to 2) - improved patterns
  const scorePatterns = [
    /"score"\s*:\s*(\+?-?[0-2])/, // "score": 1 or "score": +1
    /score:\s*(\+?-?[0-2])/i, // score: 1
    /оценка:\s*(\+?-?[0-2])/i, // оценка: 1 (Russian)
    /(?:^|\s)(-2|-1|0|\+?1|\+?2)(?:\s|:|,|$)/m, // standalone number
  ]

  let scoreMatch = null
  for (const pattern of scorePatterns) {
    scoreMatch = text.match(pattern)
    if (scoreMatch) break
  }

  if (!scoreMatch) {
    throw new ProviderError('Could not find score in output', ERROR_CODES.BAD_OUTPUT, false)
  }

  const score = parseInt(scoreMatch[1].replace('+', ''))

  // Extract comment - look for text after "comment": or in quotes
  let comment = ''

  // First try to find comment field specifically
  const commentMatch = text.match(/"comment"\s*:\s*"([^"]+)"/)
  if (commentMatch) {
    comment = commentMatch[1]
  } else {
    // Try other quoted text, but skip if it's "score" or similar
    const quotedMatches = text.match(/"([^"]+)"/g)
    if (quotedMatches) {
      for (const match of quotedMatches) {
        const content = match.replace(/"/g, '')
        // Skip field names and score-related content
        if (
          !content.match(/^(score|comment|examples|detailed_analysis)$/i) &&
          content.length > 10
        ) {
          comment = content
          break
        }
      }
    }

    if (!comment) {
      // Get first sentence after score
      const afterScore = text.substring(text.indexOf(scoreMatch[0]) + scoreMatch[0].length)
      const sentenceMatch = afterScore.match(/[^.!?]+[.!?]/)
      if (sentenceMatch) {
        comment = sentenceMatch[0].trim()
      }
    }
  }

  // Extract examples - look for bullet points or numbered lists
  const examples: string[] = []

  // Try bullet points
  const bulletMatches = text.matchAll(/(?:^|\n)\s*[-*•]\s*(.+)/g)
  for (const match of bulletMatches) {
    examples.push(match[1].trim())
    if (examples.length >= 2) break
  }

  // If no bullets, try numbered lists
  if (examples.length === 0) {
    const numberedMatches = text.matchAll(/(?:^|\n)\s*\d+[.)]\s*(.+)/g)
    for (const match of numberedMatches) {
      examples.push(match[1].trim())
      if (examples.length >= 2) break
    }
  }

  // If still no examples, try to extract quoted text
  if (examples.length === 0) {
    const quoteMatches = text.matchAll(/["«]([^"»]+)["»]/g)
    for (const match of quoteMatches) {
      if (match[1] !== comment) {
        // Don't duplicate the comment
        examples.push(match[1].trim())
        if (examples.length >= 2) break
      }
    }
  }

  // Ensure examples are properly sized
  const finalExamples = examples.slice(0, 2).map((e) => e.substring(0, 200))

  return {
    score,
    comment: comment || 'Оценка без комментария',
    examples: finalExamples,
    detailed_analysis: undefined, // Regex parsing doesn't extract detailed analysis
    suggestions: undefined, // Regex parsing doesn't extract suggestions
  }
}

/**
 * Validate that the parsed output is complete
 */
export function validateParsedOutput(output: ParsedOutput): boolean {
  return (
    typeof output.score === 'number' &&
    output.score >= -2 &&
    output.score <= 2 &&
    typeof output.comment === 'string' &&
    output.comment.length > 0 &&
    Array.isArray(output.examples)
  )
}
