import { NextResponse } from 'next/server'
import { modelsManager } from '@/src/config/models'

export async function GET() {
  try {
    const allModels = modelsManager.getAllConfigs()
    const availableModels = modelsManager.getAvailableModels()
    const defaultModel = modelsManager.getDefaultModel()

    // Format response with model details
    const models = Object.entries(allModels.models).map(([id, config]) => ({
      id,
      name: id.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      provider: config.provider,
      available: availableModels.includes(id),
      default: id === defaultModel,
      config: {
        temperature: config.temperature,
        maxTokens: config.maxTokens
      }
    }))

    return NextResponse.json({
      models,
      defaultModel,
      switchingEnabled: modelsManager.isModelSwitchingEnabled()
    })

  } catch (error) {
    console.error('Models endpoint error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch models' },
      { status: 500 }
    )
  }
}