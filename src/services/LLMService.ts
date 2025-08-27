import { env } from '@/src/config/env'
import { modelsManager } from '@/src/config/models'
import { logger } from '@/src/utils/logger'
import {
  getPrompt,
  getProviderFamily,
  fillPromptTemplate,
  getPromptSnippet,
  type Metric,
} from '@/src/utils/prompts'
import { ClaudeProvider } from '@/src/providers/claude'
import { OpenAIProvider } from '@/src/providers/openai'
import { GeminiProvider } from '@/src/providers/gemini'
import { YandexProvider } from '@/src/providers/yandex'
import { LLMProvider, GenerateResult, ProviderError } from '@/src/providers/types'

export class LLMService {
  private providers: Map<string, LLMProvider> = new Map()
  private currentProviderId: string

  constructor(providerId?: string) {
    this.currentProviderId = providerId || modelsManager.getDefaultModel()
    this.initializeProviders()
  }

  private initializeProviders() {
    // Initialize available providers based on API keys
    if (env.isServer && env.server) {
      if (env.server.ANTHROPIC_API_KEY) {
        this.providers.set('anthropic', new ClaudeProvider())
      }
      if (env.server.OPENAI_API_KEY) {
        this.providers.set('openai', new OpenAIProvider())
      }
      if (env.server.GOOGLE_API_KEY) {
        this.providers.set('google', new GeminiProvider())
      }
      if (env.server.YANDEX_API_KEY && env.server.YANDEX_FOLDER_ID) {
        this.providers.set('yandex', new YandexProvider())
      }
    }
  }

  public getProvider(providerId: string): LLMProvider {
    const modelConfig = modelsManager.getModelConfig(providerId)
    if (!modelConfig) {
      throw new Error(`Unknown model: ${providerId}`)
    }

    const provider = this.providers.get(modelConfig.provider)
    if (!provider) {
      throw new Error(`Provider not available: ${modelConfig.provider}`)
    }

    return provider
  }

  async analyze(
    content: string,
    metric: Metric,
    customPromptText?: string,
  ): Promise<GenerateResult> {
    const modelConfig = modelsManager.getModelConfig(this.currentProviderId)
    if (!modelConfig) {
      throw new Error(`Model configuration not found: ${this.currentProviderId}`)
    }

    // Get prompt for the provider family
    const providerFamily = getProviderFamily(this.currentProviderId)
    // Use custom prompt text if provided, otherwise load from file
    const prompt = customPromptText || getPrompt(providerFamily, metric)
    const filledPrompt = fillPromptTemplate(prompt, content)

    console.log('\n📝 LLMService.analyze()')
    console.log('Metric:', metric)
    console.log('Model:', this.currentProviderId)
    console.log('Provider:', providerFamily)
    console.log('Content length:', content.length)
    console.log('Prompt length:', filledPrompt.length)

    // Log request start
    const analysisId = globalThis.crypto.randomUUID()
    logger.llmRequestStart({
      analysisId,
      metric,
      model: this.currentProviderId,
      promptLength: filledPrompt.length,
      contentLength: content.length,
    })

    try {
      // Get provider and generate
      const provider = this.getProvider(this.currentProviderId)
      const result = await provider.generate(prompt, content, {
        model: modelConfig.model,
        temperature: modelConfig.temperature,
        maxTokens: modelConfig.maxTokens,
        timeoutMs: env.server?.REQUEST_TIMEOUT || 30000,
      })

      // Log success
      logger.llmRequestComplete({
        analysisId,
        metric,
        model: this.currentProviderId,
        duration: result.durationMs,
        tokensUsed: result.tokensUsed,
        success: true,
      })

      return result
    } catch (error) {
      // Log error
      logger.llmRequestError({
        analysisId,
        metric,
        model: this.currentProviderId,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryCount: 0,
        promptSnippet: getPromptSnippet(filledPrompt),
      })

      throw error
    }
  }

  async analyzeWithRetry(
    content: string,
    metric: Metric,
    maxRetries?: number,
    customPromptText?: string,
  ): Promise<GenerateResult> {
    const retries = maxRetries || env.server?.MAX_RETRIES || 3
    let lastError: Error | undefined

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await this.analyze(content, metric, customPromptText)

        if (attempt > 1) {
          logger.llmSuccess({ metric, attempt })
        }

        return result
      } catch (error) {
        lastError = error as Error

        // Check if error is retryable
        if (error instanceof ProviderError && !error.retryable) {
          throw error
        }

        logger.llmRetry({
          metric,
          attempt,
          error: lastError.message,
        })

        // Add exponential backoff delay before retry (except on last attempt)
        if (attempt < retries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000) // 1s, 2s, 4s, max 10s
          console.log(`⏳ Waiting ${delay}ms before retry attempt ${attempt + 1}/${retries}...`)
          await new Promise((resolve) => globalThis.setTimeout(resolve, delay))
        }

        // If this was the last attempt and model switching is enabled, try fallback
        if (attempt === retries && modelsManager.isModelSwitchingEnabled()) {
          const fallbackModel = modelsManager.getNextFallbackModel(this.currentProviderId)

          if (fallbackModel) {
            logger.modelFallback({ metric, fallbackModel })

            // Switch to fallback model and try once more
            const oldModel = this.currentProviderId
            this.currentProviderId = fallbackModel

            logger.modelSwitch({
              from: oldModel,
              to: fallbackModel,
              reason: 'Max retries reached',
            })

            try {
              return await this.analyze(content, metric, customPromptText)
            } catch (fallbackError) {
              // Restore original model
              this.currentProviderId = oldModel
              throw fallbackError
            }
          }
        }

        // Add exponential backoff between retries
        if (attempt < retries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
          await new Promise((resolve) => globalThis.setTimeout(resolve, delay))
        }
      }
    }

    throw lastError || new Error('Max retries reached')
  }

  async generateTitle(content: string, providerId?: string): Promise<GenerateResult> {
    const modelId = providerId || this.currentProviderId
    const modelConfig = modelsManager.getModelConfig(modelId)
    if (!modelConfig) {
      throw new Error(`Model configuration not found: ${modelId}`)
    }

    const titlePrompt = `Проанализируй этот учебный материал и дай ему конкретное техническое название (3-6 слов), которое точно отражает тему. 
Избегай общих слов типа "Основы", "Введение", "Учебный материал". 
Используй конкретные технологии, методы или концепции из текста.
Ответь только названием, без объяснений.

Материал:
${content.substring(0, 1500)}...

Название:`

    try {
      const provider = this.getProvider(modelId)
      const result = await provider.generate(titlePrompt, '', {
        model: modelConfig.model,
        temperature: 0.3,
        maxTokens: 50,
        timeoutMs: 5000,
      })

      // Clean up the title
      if (result.comment) {
        result.comment = result.comment.trim().replace(/["`']/g, '').substring(0, 100)
      }

      return result
    } catch (error) {
      console.error('Failed to generate title:', error)
      return {
        score: 0,
        comment: 'Учебный материал',
        model: modelId,
        durationMs: 0,
      }
    }
  }

  async analyzeWithModel(
    content: string,
    metric: Metric,
    providerId: string,
    customPromptText?: string,
  ): Promise<GenerateResult> {
    const oldModel = this.currentProviderId
    this.currentProviderId = providerId

    try {
      logger.modelSwitch({
        from: oldModel,
        to: providerId,
        reason: 'Explicit model selection',
      })

      return await this.analyze(content, metric, customPromptText)
    } finally {
      this.currentProviderId = oldModel
    }
  }

  getCurrentModel(): string {
    return this.currentProviderId
  }

  getAvailableModels(): string[] {
    return modelsManager.getAvailableModels()
  }
}

// Export singleton for convenience
export const llmService = new LLMService()
