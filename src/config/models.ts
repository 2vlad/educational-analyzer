import { z } from 'zod'
import { env } from './env'
import modelsConfig from '../../config/models.json'

// Model configuration schema
const modelSchema = z.object({
  provider: z.enum(['anthropic', 'openai', 'google', 'yandex']),
  model: z.string(),
  maxTokens: z.number(),
  temperature: z.number(),
})

const modelsConfigSchema = z.object({
  default: z.string(),
  models: z.record(modelSchema),
})

// Type definitions
export type ModelConfig = z.infer<typeof modelSchema>
export type ModelsConfig = z.infer<typeof modelsConfigSchema>

class ModelsManager {
  private config: ModelsConfig

  constructor() {
    // Validate and load models configuration
    try {
      this.config = modelsConfigSchema.parse(modelsConfig)
    } catch (error) {
      console.error('Invalid models configuration:', error)
      throw new Error('Failed to load models configuration')
    }
  }

  getDefaultModel(): string {
    // Use env override if available and it's not the old default
    if (env.isServer && env.server?.DEFAULT_MODEL && env.server.DEFAULT_MODEL !== 'claude-haiku') {
      return env.server.DEFAULT_MODEL
    }
    // Always prefer yandex-gpt-pro if no valid env override
    return 'yandex-gpt-pro'
  }

  listModels(): string[] {
    return Object.keys(this.config.models)
  }

  getModelConfig(modelId: string): ModelConfig | undefined {
    return this.config.models[modelId]
  }

  isModelSwitchingEnabled(): boolean {
    if (env.isServer && env.server) {
      return env.server.ENABLE_MODEL_SWITCHING
    }
    return true // Default to enabled
  }

  getAvailableModels(): string[] {
    // Filter models based on available API keys
    if (!env.isServer || !env.server) {
      return []
    }

    const available: string[] = []

    for (const [modelId, config] of Object.entries(this.config.models)) {
      const hasKey = this.hasApiKeyForProvider(config.provider)
      if (hasKey) {
        available.push(modelId)
      }
    }

    return available
  }

  private hasApiKeyForProvider(provider: string): boolean {
    if (!env.isServer || !env.server) return false

    switch (provider) {
      case 'anthropic':
        return !!env.server.ANTHROPIC_API_KEY
      case 'openai':
        return !!env.server.OPENAI_API_KEY
      case 'google':
        return !!env.server.GOOGLE_API_KEY
      case 'yandex':
        return !!env.server.YANDEX_API_KEY && !!env.server.YANDEX_FOLDER_ID
      default:
        return false
    }
  }

  getNextFallbackModel(currentModelId: string): string | null {
    const available = this.getAvailableModels()
    const currentIndex = available.indexOf(currentModelId)

    if (currentIndex === -1 || available.length <= 1) {
      return null
    }

    // Return next model in circular fashion
    const nextIndex = (currentIndex + 1) % available.length
    return available[nextIndex]
  }

  getAllConfigs(): ModelsConfig {
    return this.config
  }
}

// Export singleton instance
export const modelsManager = new ModelsManager()

// Export for testing
export { ModelsManager }
