import { GoogleGenerativeAI } from '@google/generative-ai'
import { env } from '@/config/env'
import { modelsManager } from '@/config/models'
import { LLMProvider, GenerateOptions, GenerateResult, ProviderError, ERROR_CODES } from './types'
import { parseLLMOutput } from '@/utils/parseLLMOutput'

export class GeminiProvider implements LLMProvider {
  private client: GoogleGenerativeAI | null = null
  private readonly providerName = 'google'

  constructor() {
    if (env.isServer && env.server?.GOOGLE_API_KEY) {
      this.client = new GoogleGenerativeAI(env.server.GOOGLE_API_KEY)
    }
  }

  async generate(prompt: string, content: string, options: GenerateOptions = {}): Promise<GenerateResult> {
    if (!this.client) {
      throw new ProviderError(
        'Google API key not configured',
        ERROR_CODES.AUTH_ERROR,
        false,
        this.providerName
      )
    }

    const modelConfig = modelsManager.getModelConfig('gemini-pro')
    if (!modelConfig) {
      throw new ProviderError(
        'Gemini model configuration not found',
        ERROR_CODES.INVALID_REQUEST,
        false,
        this.providerName
      )
    }

    const startTime = Date.now()
    const finalPrompt = prompt.replace('{{content}}', content)

    try {
      // Get the generative model
      const model = this.client.getGenerativeModel({ 
        model: options.model || modelConfig.model,
      })

      // Configure generation settings
      const generationConfig = {
        temperature: options.temperature || modelConfig.temperature,
        maxOutputTokens: options.maxTokens || modelConfig.maxTokens,
      }

      // Create timeout promise if needed
      let timeoutId: NodeJS.Timeout | undefined
      const timeoutPromise = options.timeoutMs 
        ? new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
              reject(new Error('Timeout'))
            }, options.timeoutMs)
          })
        : null

      // Generate content with potential timeout
      const generatePromise = model.generateContent({
        contents: [{ role: 'user', parts: [{ text: finalPrompt }] }],
        generationConfig,
      })

      const result = timeoutPromise 
        ? await Promise.race([generatePromise, timeoutPromise])
        : await generatePromise

      if (timeoutId) clearTimeout(timeoutId)

      const durationMs = Date.now() - startTime
      
      // Extract text from response
      const response = result.response
      const responseText = response.text()

      // Parse the response
      const parsed = parseLLMOutput(responseText)

      return {
        ...parsed,
        raw: result,
        tokensUsed: undefined, // Gemini doesn't provide token usage in the same way
        durationMs,
        provider: this.providerName,
        model: modelConfig.model
      }
    } catch (error: any) {
      // Handle different error types
      if (error.message === 'Timeout') {
        throw new ProviderError(
          'Request timeout',
          ERROR_CODES.TIMEOUT,
          true,
          this.providerName
        )
      }
      
      if (error.status === 429 || error.message?.includes('quota')) {
        throw new ProviderError(
          'Rate limit exceeded',
          ERROR_CODES.RATE_LIMIT,
          true,
          this.providerName
        )
      }
      
      if (error.status === 401 || error.message?.includes('API key')) {
        throw new ProviderError(
          'Authentication failed',
          ERROR_CODES.AUTH_ERROR,
          false,
          this.providerName
        )
      }

      throw new ProviderError(
        error.message || 'Provider error',
        ERROR_CODES.PROVIDER_ERROR,
        error.status >= 500,
        this.providerName
      )
    }
  }
}