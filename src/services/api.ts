// Client-side API service for interacting with backend

import type { MetricConfig } from '@/src/types/metrics'

export interface AnalyzeRequest {
  content: string
  modelId?: string
  metricMode?: 'lx' | 'custom'
  configurations?: MetricConfig[]
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
    lessonTitle?: string
    hotFixes?: string[]
    quickWin?: string
    [metric: string]:
      | {
          score: number
          comment: string
          examples: string[]
          detailed_analysis?: string
          recommendations?: string
          suggestions?: string[]
          durationMs: number
          model: string
        }
      | {
          error: string
        }
      | string
      | undefined
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

// Programs API types
export interface Program {
  id: string
  user_id: string
  name: string
  source_type: 'yonote' | 'generic_list' | 'manual'
  root_url?: string
  credential_id?: string
  created_at: string
  updated_at: string
  lastRun?: {
    id: string
    status: 'queued' | 'running' | 'paused' | 'stopped' | 'completed' | 'failed'
    progress: number
    totalLessons: number
    processedLessons: number
    succeeded: number
    failed: number
    createdAt: string
  }
}

export interface ProgramLesson {
  id: string
  program_id: string
  parent_id?: string
  title: string
  source_url?: string
  sort_order: number
  content_hash?: string
  last_fetched_at?: string
  is_active: boolean
  created_at: string
  content?: string
  file_name?: string
  file_size?: number
}

export interface ProgramRun {
  id: string
  program_id: string
  user_id: string
  status: 'queued' | 'running' | 'paused' | 'stopped' | 'completed' | 'failed'
  metrics_mode: 'lx' | 'custom'
  metric_configuration_id?: string
  total_lessons: number
  queued: number
  processed: number
  succeeded: number
  failed: number
  max_concurrency: number
  started_at?: string
  finished_at?: string
  created_at: string
}

export interface CreateProgramRequest {
  name: string
  sourceType: 'yonote' | 'generic_list' | 'manual'
  rootUrl?: string
  credentialId?: string
}

export interface CreateRunRequest {
  metricsMode: 'lx' | 'custom'
  metricConfigurationId?: string
  maxConcurrency?: number
}

class ApiService {
  private baseUrl = ''

  async analyze(request: AnalyzeRequest): Promise<AnalyzeResponse> {
    console.log('[API] Calling /api/analyze with:', {
      contentLength: request.content.length,
      modelId: request.modelId,
      metricMode: request.metricMode,
      configurationsCount: request.configurations?.length || 0,
    })

    // Include session ID in headers for guest users
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (typeof window !== 'undefined') {
      const sessionId = globalThis.localStorage.getItem('session_id')
      if (sessionId) {
        headers['x-session-id'] = sessionId
      }
    }

    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    })

    console.log('[API] /api/analyze response status:', response.status)

    if (!response.ok) {
      const error = await response.json()
      console.error('[API] /api/analyze error:', error)
      throw new Error(error.error || 'Failed to analyze content')
    }

    const data = await response.json()
    console.log('[API] /api/analyze success, analysis ID:', data.analysisId)

    // Store session ID for guest users
    if (data.sessionId && typeof window !== 'undefined') {
      globalThis.localStorage.setItem('session_id', data.sessionId)
    }

    return data
  }

  async getAnalysis(id: string): Promise<AnalysisResult> {
    console.log(`[API] Fetching analysis status for ID: ${id}`)
    const response = await fetch(`/api/analysis/${id}`)

    console.log(`[API] /api/analysis/${id} response status:`, response.status)

    if (!response.ok) {
      const error = await response.json()
      console.error(`[API] /api/analysis/${id} error:`, error)
      throw new Error(error.error || 'Failed to fetch analysis')
    }

    const data = await response.json()
    console.log(
      `[API] Analysis status:`,
      data.status,
      'Metrics count:',
      Object.keys(data.metrics || {}).length,
    )
    return data
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

  // Programs API
  async getPrograms(): Promise<{ programs: Program[] }> {
    const response = await fetch('/api/programs')
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to fetch programs')
    }
    return response.json()
  }

  async createProgram(request: CreateProgramRequest): Promise<{ program: Program }> {
    const response = await fetch('/api/programs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create program')
    }
    return response.json()
  }

  async deleteProgram(programId: string): Promise<void> {
    const response = await fetch(`/api/programs/${programId}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete program')
    }
  }

  async enumerateLessons(
    programId: string,
  ): Promise<{ message: string; count: number; lessons: ProgramLesson[] }> {
    const response = await fetch(`/api/programs/${programId}/enumerate`, {
      method: 'POST',
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to enumerate lessons')
    }
    return response.json()
  }

  async getProgramLessons(programId: string): Promise<{ lessons: ProgramLesson[] }> {
    const response = await fetch(`/api/programs/${programId}/lessons`)
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to fetch lessons')
    }
    return response.json()
  }

  async deleteLesson(programId: string, lessonId: string): Promise<{ message: string }> {
    const response = await fetch(`/api/programs/${programId}/lessons/${lessonId}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete lesson')
    }
    return response.json()
  }

  async deleteLessons(programId: string, lessonIds: string[]): Promise<{ message: string }> {
    // Delete multiple lessons one by one
    const results = await Promise.allSettled(
      lessonIds.map((lessonId) => this.deleteLesson(programId, lessonId)),
    )

    const failed = results.filter((r) => r.status === 'rejected').length
    const succeeded = results.filter((r) => r.status === 'fulfilled').length

    if (failed > 0) {
      throw new Error(
        `Удалено ${succeeded} из ${lessonIds.length} уроков. ${failed} не удалось удалить.`,
      )
    }

    return { message: `Успешно удалено ${succeeded} уроков` }
  }

  async uploadLessons(
    programId: string,
    files: Array<{ fileName: string; content: string; fileSize: number }>,
  ): Promise<{ success: boolean; lessonsCreated: number; lessons: ProgramLesson[] }> {
    const response = await fetch(`/api/programs/${programId}/upload-lessons`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ files }),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to upload lessons')
    }
    return response.json()
  }

  async createRun(
    programId: string,
    request: CreateRunRequest,
  ): Promise<{ run: ProgramRun; message: string }> {
    const response = await fetch(`/api/programs/${programId}/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create run')
    }
    return response.json()
  }

  async analyzeLesson(programId: string, lessonId: string): Promise<{ message: string }> {
    const response = await fetch(`/api/programs/${programId}/lessons/${lessonId}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to analyze lesson')
    }
    return response.json()
  }

  async getRunStatus(runId: string): Promise<{ run: ProgramRun }> {
    const response = await fetch(`/api/program-runs/${runId}/status`)
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to fetch run status')
    }
    return response.json()
  }

  async pauseRun(runId: string): Promise<{ message: string }> {
    const response = await fetch(`/api/program-runs/${runId}/pause`, {
      method: 'POST',
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to pause run')
    }
    return response.json()
  }

  async resumeRun(runId: string): Promise<{ message: string }> {
    const response = await fetch(`/api/program-runs/${runId}/resume`, {
      method: 'POST',
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to resume run')
    }
    return response.json()
  }

  async stopRun(runId: string): Promise<{ message: string }> {
    const response = await fetch(`/api/program-runs/${runId}/stop`, {
      method: 'POST',
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to stop run')
    }
    return response.json()
  }

  async pollRunProgress(
    runId: string,
    onProgress?: (run: ProgramRun) => void,
    maxAttempts = 300,
  ): Promise<ProgramRun> {
    let attempts = 0

    while (attempts < maxAttempts) {
      const { run } = await this.getRunStatus(runId)

      if (onProgress) {
        onProgress(run)
      }

      if (run.status === 'completed' || run.status === 'failed' || run.status === 'stopped') {
        return run
      }

      // Wait 2 seconds before next poll
      await new Promise((resolve) => globalThis.setTimeout(resolve, 2000))
      attempts++
    }

    throw new Error('Run timeout')
  }

  // Get aggregated metrics summary for a program
  async getProgramMetricsSummary(programId: string): Promise<{
    programId: string
    metrics: Array<{
      name: string
      avgScore: number
      roundedScore: number
      topComment: string | null
      lessonsAnalyzed: number
    }>
    lessonsTotal: number
    lessonsAnalyzed: number
  }> {
    const response = await fetch(`/api/programs/${programId}/metrics-summary`)
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to fetch metrics summary')
    }
    return response.json()
  }
}

export const apiService = new ApiService()
export { ApiService }
