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
    console.log('🔧 Initializing LLM providers...')
    console.log('Environment check:')
    console.log('- env.isServer:', env.isServer)
    console.log('- env.server exists:', !!env.server)

    // Initialize available providers based on API keys
    if (env.isServer && env.server) {
      if (env.server.ANTHROPIC_API_KEY) {
        console.log('✅ Initializing Anthropic provider')
        this.providers.set('anthropic', new ClaudeProvider())
      } else {
        console.log('⚠️ Anthropic API key not found')
      }

      if (env.server.OPENAI_API_KEY) {
        console.log('✅ Initializing OpenAI provider')
        this.providers.set('openai', new OpenAIProvider())
      } else {
        console.log('⚠️ OpenAI API key not found')
      }

      if (env.server.GOOGLE_API_KEY) {
        console.log('✅ Initializing Google provider')
        this.providers.set('google', new GeminiProvider())
      } else {
        console.log('⚠️ Google API key not found')
      }

      if (env.server.YANDEX_API_KEY && env.server.YANDEX_FOLDER_ID) {
        console.log('✅ Initializing Yandex provider')
        console.log('  - API Key length:', env.server.YANDEX_API_KEY.length)
        console.log('  - Folder ID:', env.server.YANDEX_FOLDER_ID)
        this.providers.set('yandex', new YandexProvider())
      } else {
        console.log('⚠️ Yandex provider not initialized:')
        console.log('  - API Key:', env.server?.YANDEX_API_KEY ? 'SET' : 'NOT SET')
        console.log('  - Folder ID:', env.server?.YANDEX_FOLDER_ID ? 'SET' : 'NOT SET')
      }
    } else {
      console.error('❌ Not on server or env.server is not available!')
    }

    console.log('🤖 LLMService initialized with providers:', Array.from(this.providers.keys()))

    if (this.providers.size === 0) {
      console.error('❌ CRITICAL: No LLM providers available! Analysis will fail.')
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
    let prompt = customPromptText || getPrompt(providerFamily, metric)

    // For custom prompts, ensure JSON format for proper parsing
    if (customPromptText && !customPromptText.includes('json')) {
      prompt = `${customPromptText}

ВАЖНО: Ответь строго в формате JSON с детальным анализом:
\`\`\`json
{
  "score": -2|-1|0|1|2,
  "comment": "краткий комментарий (макс 150 символов)",
  "examples": [
    "Конкретный пример из текста, который иллюстрирует вашу оценку",
    "Еще один пример из материала"
  ],
  "detailed_analysis": "Подробный анализ материала по данному критерию (2-3 предложения)",
  "suggestions": [
    "Конкретная рекомендация по улучшению",
    "Еще одна рекомендация"
  ]
}
\`\`\`

Материал для анализа:
{{content}}`
    }

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
        examples: [],
        model: modelId,
        durationMs: 0,
        raw: null,
        provider: 'unknown',
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

  /**
   * Analyze coherence and connections between multiple lessons
   * @param lessons Array of lessons with titles and content
   * @param providerId Optional specific model to use
   * @returns Analysis of lesson coherence
   */
  async analyzeCoherence(
    lessons: Array<{ title: string; content: string }>,
    providerId?: string,
  ): Promise<{
    score: number
    summary: string
    strengths: string[]
    issues: string[]
    suggestions: string[]
  }> {
    const modelId = providerId || this.currentProviderId
    const modelConfig = modelsManager.getModelConfig(modelId)
    if (!modelConfig) {
      throw new Error(`Model configuration not found: ${modelId}`)
    }

    // Create a compact representation of lessons for analysis
    const lessonsOverview = lessons
      .map((lesson, i) => {
        // Take first 500 chars of each lesson for context
        const preview = lesson.content.substring(0, 500)
        return `${i + 1}. "${lesson.title}"\n${preview}...`
      })
      .join('\n\n')

    const coherencePrompt = `Ты — эксперт по учебным программам. Проанализируй связность и последовательность уроков.

Уроки для анализа:
${lessonsOverview}

Оцени по шкале от -2 до +2:
- -2: Уроки совершенно не связаны, хаотичная последовательность
- -1: Слабая связь, есть логические пробелы
- 0: Нейтральная связь, материал разрозненный но понятный
- +1: Хорошая связанность, логичная последовательность
- +2: Отличная связность, каждый урок плавно продолжает предыдущий

Ответь в формате JSON:
\`\`\`json
{
  "score": -2|-1|0|1|2,
  "summary": "Краткое описание общей связности (2-3 предложения)",
  "strengths": ["Сильная сторона 1", "Сильная сторона 2"],
  "issues": ["Проблема 1", "Проблема 2"],
  "suggestions": ["Рекомендация 1", "Рекомендация 2"]
}
\`\`\``

    try {
      const provider = this.getProvider(modelId)
      const result = await provider.generate(coherencePrompt, '', {
        model: modelConfig.model,
        temperature: 0.3,
        maxTokens: 1000,
        timeoutMs: 20000,
      })

      // Parse the response
      let parsed: {
        score?: number
        summary?: string
        strengths?: string[]
        issues?: string[]
        suggestions?: string[]
      }
      try {
        // Try to extract JSON from the response
        const jsonMatch = result.comment?.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0])
        } else {
          throw new Error('No JSON found in response')
        }
      } catch (parseError) {
        console.error('Failed to parse coherence analysis:', parseError)
        // Return default structure
        return {
          score: 0,
          summary: result.comment || 'Не удалось проанализировать связность уроков',
          strengths: [],
          issues: [],
          suggestions: [],
        }
      }

      return {
        score: parsed.score || 0,
        summary: parsed.summary || 'Анализ связности выполнен',
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
        issues: Array.isArray(parsed.issues) ? parsed.issues : [],
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      }
    } catch (error) {
      console.error('Failed to analyze coherence:', error)
      return {
        score: 0,
        summary: 'Не удалось выполнить анализ связности уроков',
        strengths: [],
        issues: [],
        suggestions: [],
      }
    }
  }
}

// Export singleton for convenience
export const llmService = new LLMService()
