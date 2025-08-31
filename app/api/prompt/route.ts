import { NextRequest, NextResponse } from 'next/server'
import { getPrompt, getProviderFamily, METRICS, type Metric } from '@/src/utils/prompts'
import { modelsManager } from '@/src/config/models'

// Ensure Node.js runtime (needed for fs access in getPrompt)
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const metricParam = searchParams.get('metric')?.trim()
    const modelParam = searchParams.get('model')?.trim()

    if (!metricParam) {
      return NextResponse.json({ error: 'metric is required' }, { status: 400 })
    }

    // Normalize and validate metric id
    const metricId = metricParam as Metric
    if (!METRICS.includes(metricId)) {
      return NextResponse.json({ error: `unknown metric: ${metricParam}` }, { status: 400 })
    }

    // Choose model (fallback to default) and map to provider family
    const modelId = modelParam || modelsManager.getDefaultModel()
    const provider = getProviderFamily(modelId)

    // Load prompt from prompts/<provider>/<metric>.md
    try {
      const prompt = getPrompt(provider, metricId)
      return NextResponse.json({ metric: metricId, model: modelId, provider, prompt })
    } catch (e) {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 })
    }
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
