/**
 * Utilities for managing guest user metrics in LocalStorage
 */

import { MetricConfig, DEFAULT_METRIC_CONFIGS } from '@/src/types/metrics'

const STORAGE_KEY = 'guest_custom_metrics'

/**
 * Load metrics from LocalStorage for guest users
 * Returns default metrics if none are saved
 */
export function loadGuestMetrics(): MetricConfig[] {
  if (typeof window === 'undefined') return DEFAULT_METRIC_CONFIGS

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      // First time - save defaults and return them
      saveGuestMetrics(DEFAULT_METRIC_CONFIGS)
      return DEFAULT_METRIC_CONFIGS
    }

    const parsed = JSON.parse(stored)

    // Validate that it's an array
    if (!Array.isArray(parsed)) {
      console.warn('Invalid metrics format in LocalStorage, resetting to defaults')
      saveGuestMetrics(DEFAULT_METRIC_CONFIGS)
      return DEFAULT_METRIC_CONFIGS
    }

    // Basic validation of metric structure
    const valid = parsed.every(
      (m) =>
        typeof m === 'object' &&
        typeof m.id === 'string' &&
        typeof m.name === 'string' &&
        typeof m.prompt_text === 'string' &&
        typeof m.is_active === 'boolean' &&
        typeof m.display_order === 'number',
    )

    if (!valid) {
      console.warn('Invalid metric structure in LocalStorage, resetting to defaults')
      saveGuestMetrics(DEFAULT_METRIC_CONFIGS)
      return DEFAULT_METRIC_CONFIGS
    }

    return parsed
  } catch (error) {
    console.error('Error loading guest metrics from LocalStorage:', error)
    // Fallback to defaults on error
    saveGuestMetrics(DEFAULT_METRIC_CONFIGS)
    return DEFAULT_METRIC_CONFIGS
  }
}

/**
 * Save metrics to LocalStorage for guest users
 */
export function saveGuestMetrics(metrics: MetricConfig[]): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(metrics))
  } catch (error) {
    console.error('Error saving guest metrics to LocalStorage:', error)
    // Handle quota exceeded or other errors
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      console.warn('LocalStorage quota exceeded, clearing old data')
      localStorage.removeItem(STORAGE_KEY)
      // Try again with just the metrics
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(metrics))
      } catch {
        console.error('Failed to save metrics even after clearing')
      }
    }
  }
}

/**
 * Add a new metric for guest users
 */
export function addGuestMetric(metric: Omit<MetricConfig, 'id'>): MetricConfig {
  const current = loadGuestMetrics()

  // Generate a unique ID
  const id = `custom_${Date.now()}_${Math.random().toString(36).substring(7)}`

  const newMetric: MetricConfig = {
    ...metric,
    id,
  }

  const updated = [...current, newMetric]
  saveGuestMetrics(updated)

  return newMetric
}

/**
 * Update an existing metric for guest users
 */
export function updateGuestMetric(id: string, updates: Partial<MetricConfig>): boolean {
  const current = loadGuestMetrics()
  const index = current.findIndex((m) => m.id === id)

  if (index === -1) return false

  current[index] = { ...current[index], ...updates }
  saveGuestMetrics(current)

  return true
}

/**
 * Delete a metric for guest users
 */
export function deleteGuestMetric(id: string): boolean {
  const current = loadGuestMetrics()
  const filtered = current.filter((m) => m.id !== id)

  if (filtered.length === current.length) return false

  saveGuestMetrics(filtered)
  return true
}

/**
 * Reorder metrics for guest users
 */
export function reorderGuestMetrics(metrics: MetricConfig[]): void {
  // Update display_order based on array position
  const updated = metrics.map((m, index) => ({
    ...m,
    display_order: index + 1,
  }))

  saveGuestMetrics(updated)
}

/**
 * Reset to default metrics for guest users
 */
export function resetGuestMetrics(): MetricConfig[] {
  saveGuestMetrics(DEFAULT_METRIC_CONFIGS)
  return DEFAULT_METRIC_CONFIGS
}

/**
 * Export metrics configuration as JSON for download
 */
export function exportMetricsConfig(metrics: MetricConfig[]): string {
  return JSON.stringify(
    {
      version: '1.0',
      exported_at: new Date().toISOString(),
      metrics,
    },
    null,
    2,
  )
}

/**
 * Import metrics configuration from JSON
 */
export function importMetricsConfig(jsonString: string): {
  success: boolean
  metrics?: MetricConfig[]
  error?: string
} {
  try {
    const parsed = JSON.parse(jsonString)

    if (!parsed.metrics || !Array.isArray(parsed.metrics)) {
      return {
        success: false,
        error: 'Invalid format: missing or invalid metrics array',
      }
    }

    // Validate metric structure
    const valid = parsed.metrics.every(
      (m: any) =>
        typeof m === 'object' &&
        typeof m.id === 'string' &&
        typeof m.name === 'string' &&
        typeof m.prompt_text === 'string' &&
        typeof m.is_active === 'boolean' &&
        typeof m.display_order === 'number',
    )

    if (!valid) {
      return {
        success: false,
        error: 'Invalid format: metrics have incorrect structure',
      }
    }

    return {
      success: true,
      metrics: parsed.metrics,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse JSON',
    }
  }
}

/**
 * Get active metrics only (for analysis)
 */
export function getActiveGuestMetrics(): MetricConfig[] {
  return loadGuestMetrics()
    .filter((m) => m.is_active)
    .sort((a, b) => a.display_order - b.display_order)
}
