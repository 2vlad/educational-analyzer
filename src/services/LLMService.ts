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
import { OpenRouterProvider } from '@/src/providers/openrouter'
import { LLMProvider, GenerateResult, ProviderError } from '@/src/providers/types'
import { parseCoherenceOutput } from '@/src/utils/parseCoherenceOutput'

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
      // OpenRouter - unified provider for Claude, GPT, Gemini
      if (env.server.OPENROUTER_API_KEY) {
        console.log('✅ Initializing OpenRouter provider')
        this.providers.set('openrouter', new OpenRouterProvider())
      } else {
        console.log('⚠️ OpenRouter API key not found')
      }

      // Legacy direct providers (kept for fallback)
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

      // Yandex - always direct
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
    // Try to use Claude Sonnet through OpenRouter first, fallback to Yandex
    // User's model choice is ignored here to ensure consistent, high-quality results
    let forcedModelId = 'claude-sonnet-4'
    const userRequestedModel = providerId || this.currentProviderId

    console.log(
      `[Coherence Analysis] Preferred model ${forcedModelId} (user requested: ${userRequestedModel})`,
    )

    // Check if OpenRouter is available, otherwise use OpenAI GPT-4 as fallback
    let useOpenAIFallback = false
    if (!env.server?.OPENROUTER_API_KEY) {
      console.log(
        '[Coherence Analysis] OpenRouter not available, will use OpenAI GPT-4 as fallback',
      )
      forcedModelId = 'gpt-4o'
      useOpenAIFallback = true
    }

    const modelConfig = modelsManager.getModelConfig(forcedModelId)
    if (!modelConfig) {
      throw new Error(`Model configuration not found: ${forcedModelId}`)
    }

    console.log('[Coherence Analysis] Starting analysis...')
    console.log('[Coherence Analysis] Model:', forcedModelId)
    console.log('[Coherence Analysis] Number of lessons:', lessons.length)

    // Validate lesson content
    const validLessons = lessons.filter(
      (lesson) => lesson.content && lesson.content.trim().length > 0,
    )
    console.log('[Coherence Analysis] Valid lessons with content:', validLessons.length)

    if (validLessons.length < 2) {
      console.error('[Coherence Analysis] Not enough lessons with content')
      return {
        score: 0,
        summary: `Недостаточно уроков с содержимым для анализа связности (найдено ${validLessons.length} из ${lessons.length})`,
        strengths: [],
        issues: ['Большинство уроков не содержат текст или содержимое не было загружено'],
        suggestions: ['Убедитесь, что все файлы уроков содержат текст и были успешно загружены'],
      }
    }

    // Create a compact representation of lessons for analysis
    const lessonsOverview = validLessons
      .map((lesson, i) => {
        // Take first 800 chars of each lesson for better context
        const preview = lesson.content.substring(0, 800)
        return `Урок ${i + 1}: "${lesson.title}"\n${preview}${lesson.content.length > 800 ? '...' : ''}`
      })
      .join('\n\n---\n\n')

    console.log('[Coherence Analysis] Overview length:', lessonsOverview.length, 'chars')

    const coherencePrompt = `You are a JSON-only API. Analyze the coherence and sequence of ${validLessons.length} lessons.

Lessons:
${lessonsOverview}

CRITICAL: Return ONLY a raw JSON object. No explanation, no markdown, no text before or after.

Response format (exactly this structure):
{
  "score": -2,
  "summary": "brief description in Russian",
  "strengths": ["strength 1 in Russian"],
  "issues": ["issue 1 in Russian"],
  "suggestions": ["suggestion 1 in Russian"]
}

Score scale:
-2 = not connected
-1 = weak connection  
0 = neutral
+1 = good connection
+2 = excellent connection

Return ONLY the JSON object, nothing else:`

    try {
      let provider: LLMProvider
      let actualModel = modelConfig.model

      if (useOpenAIFallback) {
        // Use OpenAI provider as fallback
        provider = this.providers.get('openai')
        if (!provider) {
          throw new Error('Neither OpenRouter nor OpenAI provider available')
        }
        console.log('[Coherence Analysis] Using OpenAI fallback with model:', actualModel)
      } else {
        // Use OpenRouter
        provider = this.getProvider(forcedModelId)
        console.log('[Coherence Analysis] Using OpenRouter with model:', actualModel)
      }

      console.log(
        '[Coherence Analysis] Calling provider with prompt length:',
        coherencePrompt.length,
      )

      const result = await provider.generate(coherencePrompt, '', {
        model: actualModel,
        temperature: 0.2, // Low temperature for consistent JSON output
        maxTokens: 1500,
        timeoutMs: 45000, // Longer timeout
      })

      console.log('[Coherence Analysis] LLM call completed')
      console.log('[Coherence Analysis] Raw response length:', result.comment?.length || 0)
      console.log('[Coherence Analysis] Raw response (full):', result.comment)
      console.log('[Coherence Analysis] Provider:', result.provider)
      console.log('[Coherence Analysis] Model:', result.model)

      // Parse the response using the same robust parser as regular analysis
      try {
        const parsed = parseCoherenceOutput(result.comment || '')
        console.log('[Coherence Analysis] Parse successful:', JSON.stringify(parsed))
        return parsed
      } catch (parseError) {
        console.error('[Coherence Analysis] Parse failed:', parseError)
        console.error(
          '[Coherence Analysis] Error:',
          parseError instanceof Error ? parseError.message : 'Unknown',
        )

        // Return a fallback analysis with debug info
        const errorMsg = parseError instanceof Error ? parseError.message : 'Unknown error'
        const rawResponse = result.comment || 'Empty response'

        return {
          score: 0,
          summary: `Не удалось распарсить ответ: ${errorMsg}`,
          strengths: [],
          issues: [
            `Raw response length: ${rawResponse.length}`,
            `First 200 chars: ${rawResponse.substring(0, 200)}`,
          ],
          suggestions: [
            'Ответ AI не был в правильном формате',
            `Error: ${errorMsg}`,
            'Попробуйте повторить анализ',
          ],
        }
      }
    } catch (error) {
      console.error('[Coherence Analysis] Error:', error)
      console.error(
        '[Coherence Analysis] Error type:',
        error instanceof Error ? error.constructor.name : typeof error,
      )
      console.error(
        '[Coherence Analysis] Error message:',
        error instanceof Error ? error.message : String(error),
      )
      console.error(
        '[Coherence Analysis] Error stack:',
        error instanceof Error ? error.stack : 'No stack trace',
      )

      // Return detailed error information for debugging
      const errorMsg = error instanceof Error ? error.message : String(error)
      return {
        score: 0,
        summary: `Не удалось выполнить анализ связности уроков: ${errorMsg}`,
        strengths: [],
        issues: [],
        suggestions: [
          'Произошла ошибка при обращении к AI модели',
          `Детали ошибки: ${errorMsg}`,
          'Попробуйте повторить попытку или выбрать другую модель',
        ],
      }
    }
  }
}

// Export singleton for convenience
export const llmService = new LLMService()
