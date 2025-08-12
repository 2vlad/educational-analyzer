import Anthropic from '@anthropic-ai/sdk'
import { env } from '@/src/config/env'
import { modelsManager } from '@/src/config/models'
import { LLMProvider, GenerateOptions, GenerateResult, ProviderError, ERROR_CODES } from './types'
import { parseLLMOutput } from '@/src/utils/parseLLMOutput'

export class ClaudeProvider implements LLMProvider {
  private client: Anthropic | null = null
  private readonly providerName = 'anthropic'

  constructor() {
    if (env.isServer && env.server?.ANTHROPIC_API_KEY) {
      this.client = new Anthropic({
        apiKey: env.server.ANTHROPIC_API_KEY,
      })
    }
  }

  async generate(
    prompt: string,
    content: string,
    options: GenerateOptions = {},
  ): Promise<GenerateResult> {
    if (!this.client) {
      throw new ProviderError(
        'Anthropic API key not configured',
        ERROR_CODES.AUTH_ERROR,
        false,
        this.providerName,
      )
    }

    const modelConfig = modelsManager.getModelConfig('claude-sonnet-4')
    if (!modelConfig) {
      throw new ProviderError(
        'Claude model configuration not found',
        ERROR_CODES.INVALID_REQUEST,
        false,
        this.providerName,
      )
    }

    const startTime = Date.now()
    const finalPrompt = prompt.replace('{{content}}', content)

    try {
      const response = await this.client.messages.create({
        model: options.model || modelConfig.model,
        max_tokens: options.maxTokens || modelConfig.maxTokens,
        temperature: options.temperature || modelConfig.temperature,
        messages: [
          {
            role: 'user',
            content: finalPrompt,
          },
        ],
        // Add timeout using AbortController if needed
        ...(options.timeoutMs && {
          signal: globalThis.AbortSignal.timeout(options.timeoutMs),
        }),
      } as Anthropic.MessageCreateParams)

      const durationMs = Date.now() - startTime

      // Extract text from response
      const responseText = response.content[0].type === 'text' ? response.content[0].text : ''

      // Log raw LLM response for debugging
      console.log('\n=== CLAUDE RESPONSE ===')
      console.log('Model:', response.model)
      console.log('Usage:', response.usage)
      console.log(
        'Raw text:',
        responseText.substring(0, 500) + (responseText.length > 500 ? '...' : ''),
      )
      console.log('Full response:', JSON.stringify(JSON.parse(responseText), null, 2))
      console.log('====================\n')

      // Parse the response
      const parsed = parseLLMOutput(responseText)

      return {
        ...parsed,
        raw: response,
        tokensUsed: response.usage?.output_tokens,
        durationMs,
        provider: this.providerName,
        model: response.model,
      }
    } catch (error) {
      // Handle different error types
      const err = error as Error & { status?: number; name?: string }
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

      if (err.status === 401) {
        throw new ProviderError(
          'Authentication failed',
          ERROR_CODES.AUTH_ERROR,
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
}
