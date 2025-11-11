import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Lazy load the models manager to catch import errors
    const { modelsManager } = await import('@/src/config/models').catch((error) => {
      console.error('Failed to load models configuration:', error)
      throw new Error('Models configuration not available. Please check environment variables.')
    })

    const allModels = modelsManager.getAllConfigs()
    const availableModels = modelsManager.getAvailableModels()
    let defaultModel = modelsManager.getDefaultModel()

    // Log the default model for debugging
    console.log('Default model from manager:', defaultModel)
    console.log('DEFAULT_MODEL env var:', process.env.DEFAULT_MODEL || 'not set')
    console.log('Config default:', allModels.default)

    // Ensure yandex-gpt-pro is default if available
    if (!defaultModel || defaultModel === 'claude-haiku') {
      if (availableModels.includes('yandex-gpt-pro')) {
        defaultModel = 'yandex-gpt-pro'
        console.log('Overriding default to yandex-gpt-pro')
      }
    }

    // Format response with model details
    const models = Object.entries(allModels.models).map(([id, config]) => {
      // Format names properly without descriptions
      let name = id
      if (id === 'claude-haiku') name = 'Claude 3.5 Haiku'
      else if (id === 'claude-sonnet-4') name = 'Claude 3.5 Sonnet'
      else if (id === 'gpt-4o') name = 'GPT-4o'
      else if (id === 'gemini-pro') name = 'Gemini 2.5 Flash'
      else if (id === 'yandex-gpt-pro') name = 'YandexGPT Pro'
      else name = id.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())

      return {
        id,
        name,
        provider: config.provider,
        available: availableModels.includes(id),
        default: id === defaultModel,
        config: {
          temperature: config.temperature,
          maxTokens: config.maxTokens,
        },
      }
    })

    // Sort models to put default first
    const sortedModels = models.sort((a, b) => {
      if (a.id === defaultModel) return -1
      if (b.id === defaultModel) return 1
      // Then sort yandex-gpt-pro before others
      if (a.id === 'yandex-gpt-pro') return -1
      if (b.id === 'yandex-gpt-pro') return 1
      return 0
    })

    return NextResponse.json({
      models: sortedModels,
      defaultModel,
      switchingEnabled: modelsManager.isModelSwitchingEnabled(),
    })
  } catch (error) {
    console.error('Models endpoint error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch models'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
