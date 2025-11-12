export interface CoherenceOutput {
  score: number
  summary: string
  strengths: string[]
  issues: string[]
  suggestions: string[]
}

/**
 * Parse LLM output for coherence analysis
 * Similar to parseLLMOutput but for coherence structure
 */
export function parseCoherenceOutput(text: string): CoherenceOutput {
  console.log('[parseCoherenceOutput] ===== START PARSING =====')
  console.log('[parseCoherenceOutput] Input text length:', text.length)
  console.log('[parseCoherenceOutput] Input text (first 1000 chars):', text.substring(0, 1000))
  console.log(
    '[parseCoherenceOutput] Input text (last 500 chars):',
    text.substring(Math.max(0, text.length - 500)),
  )

  try {
    // Look for JSON block in the text
    let jsonStr = text

    // First try to extract from code blocks (```json or ```)
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/)
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1]
      console.log('[parseCoherenceOutput] ✅ Extracted from code block, length:', jsonStr.length)
    } else {
      console.log('[parseCoherenceOutput] ⚠️ No code block found, will process raw text')
    }

    // Try to find JSON object pattern
    const jsonObjMatch = jsonStr.match(/\{[\s\S]*/)
    if (jsonObjMatch) {
      jsonStr = jsonObjMatch[0]
    }

    // Handle truncated JSON by closing it properly
    console.log('[parseCoherenceOutput] Checking if JSON needs closing...')
    if (jsonStr.includes('{') && !jsonStr.trim().endsWith('}')) {
      // Count open and close braces
      const openBraces = (jsonStr.match(/\{/g) || []).length
      const closeBraces = (jsonStr.match(/\}/g) || []).length
      const bracesToAdd = openBraces - closeBraces

      console.log(
        '[parseCoherenceOutput] JSON truncated! Open:',
        openBraces,
        'Close:',
        closeBraces,
        'ToAdd:',
        bracesToAdd,
      )

      // Try to close arrays if needed
      if (jsonStr.includes('"strengths": [') && !jsonStr.includes('"]')) {
        jsonStr += '"]'
        console.log('[parseCoherenceOutput] Closed strengths array')
      }
      if (jsonStr.includes('"issues": [') && !jsonStr.includes('"]')) {
        jsonStr += '"]'
        console.log('[parseCoherenceOutput] Closed issues array')
      }
      if (jsonStr.includes('"suggestions": [') && !jsonStr.includes('"]')) {
        jsonStr += '"]'
        console.log('[parseCoherenceOutput] Closed suggestions array')
      }

      // Add missing closing braces
      jsonStr += '}'.repeat(bracesToAdd)
      console.log('[parseCoherenceOutput] ✅ Closed truncated JSON, added', bracesToAdd, 'braces')
    } else {
      console.log('[parseCoherenceOutput] ✅ JSON appears complete')
    }

    // Clean up the JSON string to handle +2 notation
    const hadPlus = jsonStr.includes('+')
    jsonStr = jsonStr.replace(/"score"\s*:\s*\+(\d)/g, '"score": $1')
    if (hadPlus) {
      console.log('[parseCoherenceOutput] ✅ Cleaned +N notation')
    }

    console.log('[parseCoherenceOutput] Final JSON length:', jsonStr.length)
    console.log('[parseCoherenceOutput] Final JSON (full):', jsonStr)

    const parsed = JSON.parse(jsonStr)

    // Validate and normalize the parsed object
    let scoreValue = parsed.score
    if (typeof scoreValue === 'string') {
      scoreValue = parseInt(scoreValue.replace('+', ''))
    }

    if (typeof scoreValue !== 'number' || scoreValue < -2 || scoreValue > 2) {
      throw new Error(`Invalid score: ${scoreValue}`)
    }

    return {
      score: Math.round(scoreValue),
      summary: String(parsed.summary || 'Анализ связности выполнен'),
      strengths: Array.isArray(parsed.strengths)
        ? parsed.strengths.slice(0, 5).map((s: unknown) => String(s).substring(0, 200))
        : [],
      issues: Array.isArray(parsed.issues)
        ? parsed.issues.slice(0, 5).map((i: unknown) => String(i).substring(0, 200))
        : [],
      suggestions: Array.isArray(parsed.suggestions)
        ? parsed.suggestions.slice(0, 5).map((s: unknown) => String(s).substring(0, 200))
        : [],
    }
  } catch (error) {
    console.error('[parseCoherenceOutput] Failed to parse:', error)
    console.error('[parseCoherenceOutput] Input text:', text.substring(0, 1000))
    throw new Error(
      `Failed to parse coherence output: ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}
