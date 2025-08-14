import OpenAI from 'openai'
import { env } from '@/src/config/env'
import { modelsManager } from '@/src/config/models'
import { LLMProvider, GenerateOptions, GenerateResult, ProviderError, ERROR_CODES } from './types'
import { parseLLMOutput } from '@/src/utils/parseLLMOutput'

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI | null = null
  private readonly providerName = 'openai'

  constructor() {
    if (env.isServer && env.server?.OPENAI_API_KEY) {
      this.client = new OpenAI({
        apiKey: env.server.OPENAI_API_KEY,
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
        'OpenAI API key not configured',
        ERROR_CODES.AUTH_ERROR,
        false,
        this.providerName,
      )
    }

    const modelConfig = modelsManager.getModelConfig('gpt-4o')
    if (!modelConfig) {
      throw new ProviderError(
        'GPT model configuration not found',
        ERROR_CODES.INVALID_REQUEST,
        false,
        this.providerName,
      )
    }

    const startTime = Date.now()
    const finalPrompt = prompt.replace('{{content}}', content)

    try {
      const response = await this.client.chat.completions.create({
        model: options.model || modelConfig.model,
        max_tokens: options.maxTokens || modelConfig.maxTokens,
        temperature: options.temperature || modelConfig.temperature,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that analyzes educational content.',
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
    } catch (error: any) {
      // Handle different error types
      if (error.name === 'AbortError') {
        throw new ProviderError('Request timeout', ERROR_CODES.TIMEOUT, true, this.providerName)
      }

      // Check for insufficient quota error
      if (error.code === 'insufficient_quota' || error.error?.code === 'insufficient_quota') {
        throw new ProviderError(
          'OpenAI API quota exceeded. Please check your billing details',
          ERROR_CODES.RATE_LIMIT,
          false,
          this.providerName,
        )
      }

      if (error.status === 429) {
        throw new ProviderError(
          'Rate limit exceeded',
          ERROR_CODES.RATE_LIMIT,
          true,
          this.providerName,
        )
      }

      if (error.status === 401) {
        throw new ProviderError(
          'Authentication failed',
          ERROR_CODES.AUTH_ERROR,
          false,
          this.providerName,
        )
      }

      throw new ProviderError(
        error.message || 'Provider error',
        ERROR_CODES.PROVIDER_ERROR,
        error.status >= 500,
        this.providerName,
      )
    }
  }
}
