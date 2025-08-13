// Client-side API service for interacting with backend

export interface AnalyzeRequest {
  content: string
  modelId?: string
}

export interface AnalyzeResponse {
  analysisId: string
  status: string
}

export interface AnalysisResult {
  id: string
  status: 'pending' | 'running' | 'completed' | 'partial' | 'failed'
  model_used: string
  created_at: string
  updated_at: string
  results?: {
    [metric: string]: {
      score: number
      comment: string
      examples: string[]
      detailed_analysis?: string
      durationMs: number
      model: string
    } | {
      error: string
    }
  }
  metrics: Array<{
    metric: string
    duration: number
    model: string
    error?: string
  }>
}

export interface Model {
  id: string
  name: string
  provider: string
  available: boolean
  default: boolean
  config: {
    temperature: number
    maxTokens: number
  }
}

export interface ModelsResponse {
  models: Model[]
  defaultModel: string
  switchingEnabled: boolean
}

class ApiService {
  private baseUrl = ''

  async analyze(request: AnalyzeRequest): Promise<AnalyzeResponse> {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to analyze content')
    }

    return response.json()
  }

  async getAnalysis(id: string): Promise<AnalysisResult> {
    const response = await fetch(`/api/analysis/${id}`)

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to fetch analysis')
    }

    return response.json()
  }

  async getModels(): Promise<ModelsResponse> {
    const response = await fetch('/api/models')

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to fetch models')
    }

    return response.json()
  }

  async pollAnalysis(
    id: string,
    onProgress?: (result: AnalysisResult) => void,
    maxAttempts = 60,
  ): Promise<AnalysisResult> {
    let attempts = 0

    while (attempts < maxAttempts) {
      const result = await this.getAnalysis(id)

      if (onProgress) {
        onProgress(result)
      }

      if (
        result.status === 'completed' ||
        result.status === 'failed' ||
        result.status === 'partial'
      ) {
        return result
      }

      // Wait 1 second before next poll
      await new Promise((resolve) => globalThis.setTimeout(resolve, 1000))
      attempts++
    }

    throw new Error('Analysis timeout')
  }
}

export const apiService = new ApiService()
