import { NextResponse } from 'next/server'
import { modelsManager } from '@/src/config/models'

export async function GET() {
  try {
    const allModels = modelsManager.getAllConfigs()
    const availableModels = modelsManager.getAvailableModels()
    const defaultModel = modelsManager.getDefaultModel()

    // Format response with model details
    const models = Object.entries(allModels.models).map(([id, config]) => {
      // Format names properly
      let name = id
      if (id === 'claude-haiku') name = 'Claude 3 Haiku (Fast & Cheap)'
      else if (id === 'claude-sonnet-4') name = 'Claude 3.5 Sonnet (Best)'
      else if (id === 'gpt-4o') name = 'GPT-4o (OpenAI)'
      else if (id === 'gemini-pro') name = 'Gemini 1.5 Pro (Google)'
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
    return NextResponse.json({ error: 'Failed to fetch models' }, { status: 500 })
  }
}
