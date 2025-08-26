// Database types for Supabase tables

export type AnalysisStatus = 'pending' | 'running' | 'completed' | 'partial' | 'failed'
export type LogLevel = 'info' | 'warn' | 'error'

export interface Analysis {
  id: string
  content: string
  status: AnalysisStatus
  results?: AnalysisResults
  model_used?: string
  created_at: string
  updated_at: string
  logs?: any
}

export interface AnalysisResults {
  [metric: string]: {
    score: number
    comment: string
    examples: string[]
    durationMs: number
    model: string
  }
}

export interface LLMRequest {
  id: string
  analysis_id: string
  metric: string
  prompt?: string
  response?: any
  model?: string
  duration?: number
  error?: string
  created_at: string
}

export interface SystemLog {
  id: string
  level: LogLevel
  message: string
  metadata?: any
  timestamp: string
}

export interface RateLimit {
  ip_hash: string
  window_start: string
  count: number
}

export interface AnalysisProgressRecord {
  id: string
  analysis_id: string
  progress: number
  message: string
  metric_status?: any // JSONB
  current_metric?: string
  completed_metrics: number
  total_metrics: number
  created_at: string
}

// Insert types (without auto-generated fields)
export type InsertAnalysis = Omit<Analysis, 'id' | 'created_at' | 'updated_at'>
export type InsertLLMRequest = Omit<LLMRequest, 'id' | 'created_at'>
export type InsertSystemLog = Omit<SystemLog, 'id' | 'timestamp'>
export type InsertRateLimit = RateLimit
export type InsertAnalysisProgress = Omit<AnalysisProgressRecord, 'id' | 'created_at'>
