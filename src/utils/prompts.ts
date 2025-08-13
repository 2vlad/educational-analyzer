import { readFileSync } from 'fs'
import { join } from 'path'

// Cache for loaded prompts
const promptCache = new Map<string, string>()

// Available metrics
export const METRICS = ['logic', 'practical', 'complexity', 'interest', 'care'] as const
export type Metric = (typeof METRICS)[number]

// Provider types
export type Provider = 'claude' | 'gpt' | 'gemini' | 'yandex'

/**
 * Get the provider family from a model ID
 */
export function getProviderFamily(modelId: string): Provider {
  if (modelId.includes('claude')) return 'claude'
  if (modelId.includes('gpt-4')) return 'gpt'
  if (modelId.includes('gemini')) return 'gemini'
  if (modelId.includes('yandex')) return 'yandex'

  // Default fallback based on common patterns
  return 'claude'
}

/**
 * Load a prompt for a specific provider and metric
 */
export function getPrompt(provider: Provider, metric: Metric): string {
  const cacheKey = `${provider}:${metric}`

  // Check cache first
  if (promptCache.has(cacheKey)) {
    return promptCache.get(cacheKey)!
  }

  try {
    // Build path to prompt file
    const promptPath = join(process.cwd(), 'prompts', provider, `${metric}.md`)

    // Read prompt file
    const prompt = readFileSync(promptPath, 'utf-8')

    // Cache for future use
    promptCache.set(cacheKey, prompt)

    return prompt
  } catch (error) {
    console.error(`Failed to load prompt for ${provider}/${metric}:`, error)
    throw new Error(`Prompt not found: ${provider}/${metric}`)
  }
}

/**
 * Validate that all required prompts exist
 */
export function validatePrompts(): boolean {
  const providers: Provider[] = ['claude', 'gpt', 'gemini']
  let allValid = true

  for (const provider of providers) {
    for (const metric of METRICS) {
      try {
        getPrompt(provider, metric)
      } catch {
        console.error(`Missing prompt: ${provider}/${metric}`)
        allValid = false
      }
    }
  }

  return allValid
}

/**
 * Warm the prompt cache by loading all prompts
 */
export function warmPromptCache(): void {
  const providers: Provider[] = ['claude', 'gpt', 'gemini']

  for (const provider of providers) {
    for (const metric of METRICS) {
      try {
        getPrompt(provider, metric)
      } catch {
        // Ignore errors during warming
      }
    }
  }
}

/**
 * Get a snippet of the prompt for logging
 */
export function getPromptSnippet(prompt: string, maxLength = 300): string {
  if (prompt.length <= maxLength) return prompt
  return prompt.substring(0, maxLength) + '...'
}

/**
 * Replace content placeholder in prompt
 */
export function fillPromptTemplate(prompt: string, content: string): string {
  return prompt.replace('{{content}}', content)
}
