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
    const defaultModel = modelsManager.getDefaultModel()

    // Format response with model details
    const models = Object.entries(allModels.models).map(([id, config]) => {
      // Format names properly
      let name = id
      if (id === 'claude-haiku') name = 'Claude 3 Haiku'
      else if (id === 'claude-sonnet-4') name = 'Claude 3.5 Sonnet'
      else if (id === 'gpt-4o') name = 'GPT-4o'
      else if (id === 'gemini-pro') name = 'Gemini 1.5 Pro'
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

    return NextResponse.json({
      models,
      defaultModel,
      switchingEnabled: modelsManager.isModelSwitchingEnabled(),
    })
  } catch (error) {
    console.error('Models endpoint error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch models'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
