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
import {
  MetricConfig,
  MetricResult,
  AnalysisResponse,
  DynamicAnalysisOptions,
  DEFAULT_METRIC_CONFIGS,
  validateMetricConfigs,
  ValidationError,
} from '@/src/types/metrics'

/**
 * Enhanced LLM Service that supports dynamic metric configurations
 * Maintains backward compatibility with the original LLMService
 */
export class DynamicLLMService {
  private providers: Map<string, LLMProvider> = new Map()
  private currentProviderId: string
  private defaultConfigs: MetricConfig[] = DEFAULT_METRIC_CONFIGS

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

  private getProvider(providerId: string): LLMProvider {
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

  /**
   * Analyze content using a single metric configuration
   */
  private async analyzeSingleMetric(content: string, config: MetricConfig): Promise<MetricResult> {
    const modelConfig = modelsManager.getModelConfig(this.currentProviderId)
    if (!modelConfig) {
      throw new Error(`Model configuration not found: ${this.currentProviderId}`)
    }

    // Replace {{content}} placeholder with actual content
    const filledPrompt = config.prompt_text.replace('{{content}}', content)

    console.log('\n📝 DynamicLLMService.analyzeSingleMetric()')
    console.log('Metric:', config.name)
    console.log('Model:', this.currentProviderId)
    console.log('Content length:', content.length)
    console.log('Prompt length:', filledPrompt.length)

    // Log request start
    const analysisId = globalThis.crypto.randomUUID()
    logger.llmRequestStart({
      analysisId,
      metric: config.id as Metric,
      model: this.currentProviderId,
      promptLength: filledPrompt.length,
      contentLength: content.length,
    })

    try {
      // Get provider and generate
      const provider = this.getProvider(this.currentProviderId)

      // For backward compatibility, try to load existing prompt file if it exists
      // Otherwise use the dynamic prompt
      let promptToUse = filledPrompt
      try {
        const providerFamily = getProviderFamily(this.currentProviderId)
        const existingPrompt = getPrompt(providerFamily, config.id as Metric)
        if (existingPrompt) {
          promptToUse = fillPromptTemplate(existingPrompt, content)
        }
      } catch {
        // If existing prompt doesn't exist, use the dynamic one
      }

      const result = await provider.generate(
        promptToUse,
        '', // Content is already in the prompt
        {
          model: modelConfig.model,
          temperature: modelConfig.temperature,
          maxTokens: modelConfig.maxTokens,
          timeoutMs: env.server?.REQUEST_TIMEOUT || 30000,
        },
      )

      // Log success
      logger.llmRequestComplete({
        analysisId,
        metric: config.id as Metric,
        model: this.currentProviderId,
        duration: result.durationMs,
        tokensUsed: result.tokensUsed,
        success: true,
      })

      // Parse the response to extract score and feedback
      const parsedResult = this.parseMetricResponse(result.text, config)
      return parsedResult
    } catch (error) {
      // Log error
      logger.llmRequestError({
        analysisId,
        metric: config.id as Metric,
        model: this.currentProviderId,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryCount: 0,
        promptSnippet: getPromptSnippet(filledPrompt),
      })

      // Return error result
      return {
        metric: config.name,
        score: 0,
        feedback: 'Analysis failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Parse LLM response to extract score and feedback
   */
  private parseMetricResponse(response: string, config: MetricConfig): MetricResult {
    // Try to extract score from response
    // Look for patterns like: "+1", "-1", "0", "Score: 1", etc.
    const scorePatterns = [
      /[Ss]core[:\s]+([+-]?\d+(?:\.\d+)?)/,
      /([+-]?\d+(?:\.\d+)?)\s*\/\s*1/,
      /^([+-]?\d+(?:\.\d+)?)/m,
      /:\s*([+-]?\d+(?:\.\d+)?)/,
    ]

    let score = 0
    for (const pattern of scorePatterns) {
      const match = response.match(pattern)
      if (match && match[1]) {
        const parsedScore = parseFloat(match[1])
        if (!isNaN(parsedScore) && parsedScore >= -1 && parsedScore <= 1) {
          score = parsedScore
          break
        }
      }
    }

    // Extract feedback (everything except the score line)
    const feedback = response
      .split('\n')
      .filter((line) => !line.match(/^[Ss]core[:\s]/))
      .join('\n')
      .trim()

    return {
      metric: config.name,
      score,
      feedback: feedback || response,
    }
  }

  /**
   * Analyze content using dynamic metric configurations
   */
  async analyzeWithConfigs(
    content: string,
    options: DynamicAnalysisOptions = {},
  ): Promise<AnalysisResponse> {
    // Use provided configs or fall back to defaults
    const configs = options.configurations || this.defaultConfigs

    // Validate configurations
    const errors = validateMetricConfigs(configs)
    if (errors.length > 0) {
      throw new Error(`Invalid configurations: ${errors.map((e) => e.message).join(', ')}`)
    }

    // Filter active configs and sort by display order
    const activeConfigs = configs
      .filter((c) => c.is_active)
      .sort((a, b) => a.display_order - b.display_order)

    // Apply max metrics limit if specified
    const maxMetrics = options.maxMetrics || 20
    const configsToProcess = activeConfigs.slice(0, maxMetrics)

    console.log(`\n🔄 Processing ${configsToProcess.length} metrics...`)

    // Process all metrics in parallel for better performance
    const startTime = Date.now()
    const results = await Promise.all(
      configsToProcess.map((config) => this.analyzeSingleMetric(content, config)),
    )

    // Calculate overall score (average of all scores)
    const validScores = results
      .filter((r) => !r.error && typeof r.score === 'number')
      .map((r) => r.score)

    const overallScore =
      validScores.length > 0
        ? validScores.reduce((sum, score) => sum + score, 0) / validScores.length
        : 0

    const duration = Date.now() - startTime

    return {
      results,
      overallScore,
      model: this.currentProviderId,
      duration,
      configurationSnapshot: configsToProcess,
    }
  }

  /**
   * Backward compatible analyze method for single metric
   * Used when migrating from the old system
   */
  async analyze(content: string, metric: Metric): Promise<GenerateResult> {
    // Find matching config from defaults
    const config = this.defaultConfigs.find((c) => c.id === metric)
    if (!config) {
      throw new Error(`Unknown metric: ${metric}`)
    }

    // Use the original analyze logic for backward compatibility
    const modelConfig = modelsManager.getModelConfig(this.currentProviderId)
    if (!modelConfig) {
      throw new Error(`Model configuration not found: ${this.currentProviderId}`)
    }

    // Get prompt for the provider family
    const providerFamily = getProviderFamily(this.currentProviderId)
    const prompt = getPrompt(providerFamily, metric)
    const filledPrompt = fillPromptTemplate(prompt, content)

    // Get provider and generate
    const provider = this.getProvider(this.currentProviderId)
    return await provider.generate(prompt, content, {
      model: modelConfig.model,
      temperature: modelConfig.temperature,
      maxTokens: modelConfig.maxTokens,
      timeoutMs: env.server?.REQUEST_TIMEOUT || 30000,
    })
  }

  /**
   * Analyze with retry logic for reliability
   */
  async analyzeWithRetry(
    content: string,
    metric: Metric,
    maxRetries?: number,
  ): Promise<GenerateResult> {
    const retries = maxRetries || env.server?.MAX_RETRIES || 3
    let lastError: Error | undefined

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await this.analyze(content, metric)

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
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
          console.log(`⏳ Waiting ${delay}ms before retry attempt ${attempt + 1}/${retries}...`)
          await new Promise((resolve) => globalThis.setTimeout(resolve, delay))
        }
      }
    }

    throw lastError || new Error('Max retries reached')
  }

  /**
   * Get or set default configurations
   */
  getDefaultConfigs(): MetricConfig[] {
    return [...this.defaultConfigs]
  }

  setDefaultConfigs(configs: MetricConfig[]): void {
    const errors = validateMetricConfigs(configs)
    if (errors.length > 0) {
      throw new Error(`Invalid default configurations: ${errors.map((e) => e.message).join(', ')}`)
    }
    this.defaultConfigs = configs
  }

  getCurrentModel(): string {
    return this.currentProviderId
  }

  getAvailableModels(): string[] {
    return modelsManager.getAvailableModels()
  }
}

// Export singleton for convenience
export const dynamicLLMService = new DynamicLLMService()
