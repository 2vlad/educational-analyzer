import { ProviderError, ERROR_CODES } from '@/providers/types'

export interface ParsedOutput {
  score: number
  comment: string
  examples: string[]
}

/**
 * Parse LLM output to extract score, comment, and examples
 */
export function parseLLMOutput(text: string): ParsedOutput {
  // Try to parse as JSON first
  const jsonResult = tryParseJSON(text)
  if (jsonResult) {
    return jsonResult
  }

  // Fallback to regex parsing
  return parseWithRegex(text)
}

/**
 * Try to parse text as JSON
 */
function tryParseJSON(text: string): ParsedOutput | null {
  try {
    // Look for JSON block in the text
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || 
                      text.match(/```\s*([\s\S]*?)\s*```/) ||
                      text.match(/\{[\s\S]*\}/)
    
    if (!jsonMatch) return null
    
    const jsonStr = jsonMatch[1] || jsonMatch[0]
    const parsed = JSON.parse(jsonStr)
    
    // Validate the parsed object
    if (typeof parsed.score !== 'number' || 
        parsed.score < -2 || 
        parsed.score > 2) {
      return null
    }
    
    return {
      score: Math.round(parsed.score), // Ensure it's an integer
      comment: parsed.comment || '',
      examples: Array.isArray(parsed.examples) 
        ? parsed.examples.slice(0, 2).map(e => String(e).substring(0, 200))
        : []
    }
  } catch (error) {
    // JSON parsing failed, will try regex
    return null
  }
}

/**
 * Parse text using regex patterns
 */
function parseWithRegex(text: string): ParsedOutput {
  // Look for score (-2 to 2)
  const scoreMatch = text.match(/(?:^|\s)(-2|-1|0|\+?1|\+?2)(?:\s|:|$)/m)
  if (!scoreMatch) {
    throw new ProviderError(
      'Could not find score in output',
      ERROR_CODES.BAD_OUTPUT,
      false
    )
  }
  
  const score = parseInt(scoreMatch[1].replace('+', ''))
  
  // Extract comment - look for text after the score or in quotes
  let comment = ''
  const quotedMatch = text.match(/"([^"]+)"/) || text.match(/'([^']+)'/)
  if (quotedMatch) {
    comment = quotedMatch[1]
  } else {
    // Get first sentence after score
    const afterScore = text.substring(text.indexOf(scoreMatch[0]) + scoreMatch[0].length)
    const sentenceMatch = afterScore.match(/[^.!?]+[.!?]/)
    if (sentenceMatch) {
      comment = sentenceMatch[0].trim()
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
      if (match[1] !== comment) { // Don't duplicate the comment
        examples.push(match[1].trim())
        if (examples.length >= 2) break
      }
    }
  }
  
  // Ensure examples are properly sized
  const finalExamples = examples
    .slice(0, 2)
    .map(e => e.substring(0, 200))
  
  return {
    score,
    comment: comment || 'Оценка без комментария',
    examples: finalExamples
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