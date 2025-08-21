import { supabaseAdmin } from '@/src/lib/supabaseServer'

export interface MetricProgress {
  metric: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number // 0-100 for individual metric
  startTime?: number
  endTime?: number
}

export interface AnalysisProgress {
  analysisId: string
  overallProgress: number // 0-100
  message: string
  currentMetric?: string
  completedMetrics: number
  totalMetrics: number
  metricStatus: MetricProgress[]
  timestamp: number
}

export class ProgressService {
  private static instance: ProgressService
  private progressData: Map<string, AnalysisProgress> = new Map()
  private progressListeners: Map<string, Set<(progress: AnalysisProgress) => void>> = new Map()

  static getInstance(): ProgressService {
    if (!this.instance) {
      this.instance = new ProgressService()
    }
    return this.instance
  }

  // Initialize progress for a new analysis
  async initializeProgress(analysisId: string, metrics: string[]): Promise<void> {
    const initialProgress: AnalysisProgress = {
      analysisId,
      overallProgress: 5, // Start at 5% (analysis initiated)
      message: 'Initializing analysis...',
      completedMetrics: 0,
      totalMetrics: metrics.length,
      metricStatus: metrics.map((metric) => ({
        metric,
        status: 'pending',
        progress: 0,
      })),
      timestamp: Date.now(),
    }

    this.progressData.set(analysisId, initialProgress)

    // Store in database
    await this.saveProgressToDb(initialProgress)

    // Notify listeners
    this.notifyListeners(analysisId, initialProgress)
  }

  // Update progress for a specific metric
  async updateMetricProgress(
    analysisId: string,
    metric: string,
    status: 'processing' | 'completed' | 'failed',
    metricProgress: number = 0,
  ): Promise<void> {
    const progress = this.progressData.get(analysisId)
    if (!progress) return

    // Update metric status
    const metricIndex = progress.metricStatus.findIndex((m) => m.metric === metric)
    if (metricIndex >= 0) {
      const now = Date.now()
      progress.metricStatus[metricIndex] = {
        ...progress.metricStatus[metricIndex],
        status,
        progress: metricProgress,
        startTime: status === 'processing' ? now : progress.metricStatus[metricIndex].startTime,
        endTime: status === 'completed' || status === 'failed' ? now : undefined,
      }

      // Update current metric
      if (status === 'processing') {
        progress.currentMetric = metric
        progress.message = `Analyzing ${this.getMetricDisplayName(metric)}...`
      }

      // Update completed count
      if (status === 'completed' || status === 'failed') {
        progress.completedMetrics = progress.metricStatus.filter(
          (m) => m.status === 'completed' || m.status === 'failed',
        ).length
      }

      // Calculate overall progress
      progress.overallProgress = this.calculateOverallProgress(progress)
      progress.timestamp = now

      // Save and notify
      await this.saveProgressToDb(progress)
      this.notifyListeners(analysisId, progress)
    }
  }

  // Update granular progress within a metric (for smooth animations)
  async updateGranularProgress(
    analysisId: string,
    metric: string,
    subProgress: number, // 0-100 within the metric
  ): Promise<void> {
    const progress = this.progressData.get(analysisId)
    if (!progress) return

    const metricIndex = progress.metricStatus.findIndex((m) => m.metric === metric)
    if (metricIndex >= 0 && progress.metricStatus[metricIndex].status === 'processing') {
      progress.metricStatus[metricIndex].progress = subProgress

      // Recalculate overall progress
      progress.overallProgress = this.calculateOverallProgress(progress)
      progress.timestamp = Date.now()

      // Update message based on sub-progress
      progress.message = this.getProgressMessage(metric, subProgress)

      // Don't save every granular update to DB (too many writes)
      // Only notify listeners for smooth UI updates
      this.notifyListeners(analysisId, progress)

      // Save to DB occasionally (every 25%)
      if (subProgress % 25 === 0) {
        await this.saveProgressToDb(progress)
      }
    }
  }

  // Calculate overall progress based on metric statuses
  private calculateOverallProgress(progress: AnalysisProgress): number {
    // Base progress: 5% for starting, 95% for all metrics, 5% for finalizing
    const baseProgress = 5
    const metricProgress = 90 // Total allocated for all metrics
    const finalizingProgress = 5

    // Calculate progress per metric
    const perMetricAllocation = metricProgress / progress.totalMetrics

    let totalProgress = baseProgress

    progress.metricStatus.forEach((metric) => {
      if (metric.status === 'completed') {
        totalProgress += perMetricAllocation
      } else if (metric.status === 'processing') {
        totalProgress += (perMetricAllocation * metric.progress) / 100
      } else if (metric.status === 'failed') {
        totalProgress += perMetricAllocation // Count failed as completed for progress
      }
    })

    // Add finalizing progress if all metrics done
    if (progress.completedMetrics === progress.totalMetrics) {
      totalProgress += finalizingProgress
    }

    return Math.min(100, Math.round(totalProgress * 100) / 100)
  }

  // Get display name for metric
  private getMetricDisplayName(metric: string): string {
    const names: Record<string, string> = {
      logic: 'Logic Structure',
      practical: 'Practical Value',
      complexity: 'Complexity Level',
      interest: 'Engagement Factor',
      care: 'Quality of Care',
    }
    return names[metric] || metric
  }

  // Get progress message based on metric and sub-progress
  private getProgressMessage(metric: string, subProgress: number): string {
    const metricName = this.getMetricDisplayName(metric)

    if (subProgress < 30) {
      return `Initializing ${metricName} analysis...`
    } else if (subProgress < 60) {
      return `Processing ${metricName}...`
    } else if (subProgress < 90) {
      return `Finalizing ${metricName} results...`
    } else {
      return `Completing ${metricName}...`
    }
  }

  // Save progress to database
  private async saveProgressToDb(progress: AnalysisProgress): Promise<void> {
    try {
      await supabaseAdmin.from('analysis_progress').insert({
        analysis_id: progress.analysisId,
        progress: progress.overallProgress,
        message: progress.message,
        metric_status: progress.metricStatus,
        current_metric: progress.currentMetric,
        completed_metrics: progress.completedMetrics,
        total_metrics: progress.totalMetrics,
      })
    } catch (error) {
      console.error('Failed to save progress to database:', error)
    }
  }

  // Get latest progress from database
  async getProgressFromDb(analysisId: string): Promise<AnalysisProgress | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('analysis_progress')
        .select('*')
        .eq('analysis_id', analysisId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error || !data) return null

      return {
        analysisId: data.analysis_id,
        overallProgress: Number(data.progress),
        message: data.message,
        currentMetric: data.current_metric,
        completedMetrics: data.completed_metrics,
        totalMetrics: data.total_metrics,
        metricStatus: data.metric_status as MetricProgress[],
        timestamp: new Date(data.created_at).getTime(),
      }
    } catch (error) {
      console.error('Failed to get progress from database:', error)
      return null
    }
  }

  // Register a listener for progress updates
  addListener(analysisId: string, listener: (progress: AnalysisProgress) => void): void {
    if (!this.progressListeners.has(analysisId)) {
      this.progressListeners.set(analysisId, new Set())
    }
    this.progressListeners.get(analysisId)?.add(listener)
  }

  // Remove a listener
  removeListener(analysisId: string, listener: (progress: AnalysisProgress) => void): void {
    this.progressListeners.get(analysisId)?.delete(listener)
  }

  // Notify all listeners for an analysis
  private notifyListeners(analysisId: string, progress: AnalysisProgress): void {
    const listeners = this.progressListeners.get(analysisId)
    if (listeners) {
      listeners.forEach((listener) => listener(progress))
    }
  }

  // Clean up data for completed analysis
  cleanup(analysisId: string): void {
    this.progressData.delete(analysisId)
    this.progressListeners.delete(analysisId)
  }
}

export const progressService = ProgressService.getInstance()
