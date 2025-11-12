import OpenAI from 'openai'
import { env } from '@/src/config/env'
import { modelsManager } from '@/src/config/models'
import { LLMProvider, GenerateOptions, GenerateResult, ProviderError, ERROR_CODES } from './types'
import { parseLLMOutput } from '@/src/utils/parseLLMOutput'

/**
 * OpenRouter provider - unified API for accessing Claude, GPT, Gemini and other models
 * Uses OpenAI-compatible API
 */
export class OpenRouterProvider implements LLMProvider {
  private client: OpenAI | null = null
  private readonly providerName = 'openrouter'

  constructor() {
    if (env.isServer && env.server?.OPENROUTER_API_KEY) {
      console.log(
        '🔑 OpenRouter Provider: Initializing with API key:',
        env.server.OPENROUTER_API_KEY.substring(0, 20) + '...',
      )
      this.client = new OpenAI({
        apiKey: env.server.OPENROUTER_API_KEY,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
          'X-Title': 'Educational Analyzer',
        },
      })
    } else {
      console.log('⚠️ OpenRouter Provider: No API key found in environment')
    }
  }

  async generate(
    prompt: string,
    content: string,
    options: GenerateOptions = {},
  ): Promise<GenerateResult> {
    if (!this.client) {
      console.error('OpenRouter client not initialized - API key missing or invalid')
      throw new ProviderError(
        'OpenRouter API key not configured',
        ERROR_CODES.AUTH_ERROR,
        false,
        this.providerName,
      )
    }

    // Get model configuration
    const modelId = options.modelId || this.getDefaultModelId()
    const modelConfig = modelsManager.getModelConfig(modelId)
    if (!modelConfig) {
      throw new ProviderError(
        `Model configuration not found: ${modelId}`,
        ERROR_CODES.INVALID_REQUEST,
        false,
        this.providerName,
      )
    }

    const startTime = Date.now()
    const finalPrompt = prompt.replace('{{content}}', content)

    try {
      console.log(`🚀 OpenRouter: Using model ${modelConfig.model}`)

      const response = await this.client.chat.completions.create({
        model: options.model || modelConfig.model,
        max_tokens: options.maxTokens || modelConfig.maxTokens,
        temperature: options.temperature || modelConfig.temperature,
        messages: [
          {
            role: 'system',
            content:
              'You are a JSON API. Always respond with valid JSON only. Never add explanations, markdown formatting, or any text outside the JSON object.',
          },
          {
            role: 'user',
            content: finalPrompt,
          },
        ],
      })

      const durationMs = Date.now() - startTime

      // Extract text from response
      const responseText = response.choices[0]?.message?.content || ''

      // Log raw LLM response for debugging
      console.log('\n=== OPENROUTER RESPONSE ===')
      console.log('Model:', response.model)
      console.log('Usage:', response.usage)
      console.log('Raw text length:', responseText.length)

      try {
        const jsonResponse = JSON.parse(responseText)
        console.log('Parsed JSON response:', JSON.stringify(jsonResponse, null, 2))
      } catch {
        console.log(
          'Raw text (not valid JSON):',
          responseText.substring(0, 500) + (responseText.length > 500 ? '...' : ''),
        )
      }
      console.log('==========================\n')

      // Parse the response
      const parsed = parseLLMOutput(responseText)

      return {
        ...parsed,
        raw: response,
        tokensUsed: response.usage?.total_tokens,
        durationMs,
        provider: this.providerName,
        model: response.model,
      }
    } catch (error) {
      // Handle different error types
      const err = error as Error & { status?: number; name?: string; code?: string }

      if (err.name === 'AbortError') {
        throw new ProviderError('Request timeout', ERROR_CODES.TIMEOUT, true, this.providerName)
      }

      if (err.status === 429) {
        throw new ProviderError(
          'Rate limit exceeded',
          ERROR_CODES.RATE_LIMIT,
          true,
          this.providerName,
        )
      }

      if (err.status === 401 || err.status === 403) {
        throw new ProviderError(
          'Authentication failed',
          ERROR_CODES.AUTH_ERROR,
          false,
          this.providerName,
        )
      }

      if (err.status === 402) {
        throw new ProviderError(
          'Insufficient credits on OpenRouter',
          ERROR_CODES.RATE_LIMIT,
          false,
          this.providerName,
        )
      }

      throw new ProviderError(
        err.message || 'Provider error',
        ERROR_CODES.PROVIDER_ERROR,
        err.status ? err.status >= 500 : false,
        this.providerName,
      )
    }
  }

  private getDefaultModelId(): string {
    return 'claude-haiku'
  }
}
