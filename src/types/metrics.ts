/**
 * Type definitions for metric configurations and analysis
 */

/**
 * Configuration for a single analysis metric
 */
export interface MetricConfig {
  /** Unique identifier for the metric */
  id: string

  /** Display name of the metric (e.g., 'Logic', 'Practical') */
  name: string

  /** The prompt text template with {{content}} placeholder */
  prompt_text: string

  /** Whether this metric is active and should be evaluated */
  is_active: boolean

  /** Display order for UI presentation (1-based) */
  display_order: number
}

/**
 * Result from analyzing a single metric
 */
export interface MetricResult {
  /** The metric that was analyzed */
  metric: string

  /** Score from -1 to +1 */
  score: number

  /** Detailed feedback text */
  feedback: string

  /** Optional error if analysis failed */
  error?: string
}

/**
 * Complete analysis response
 */
export interface AnalysisResponse {
  /** Array of metric results */
  results: MetricResult[]

  /** Overall score calculated from individual metrics */
  overallScore?: number

  /** Model used for analysis */
  model?: string

  /** Total time taken for analysis */
  duration?: number

  /** Configuration snapshot for historical reference */
  configurationSnapshot?: MetricConfig[]
}

/**
 * Error types for configuration validation
 */
export interface ValidationError {
  field: string
  message: string
  value?: any
}

/**
 * Options for dynamic analysis
 */
export interface DynamicAnalysisOptions {
  /** Custom metric configurations to use */
  configurations?: MetricConfig[]

  /** Whether to use default configurations if none provided */
  useDefaults?: boolean

  /** Maximum number of metrics to process */
  maxMetrics?: number

  /** Model to use for analysis */
  model?: string
}

/**
 * Default metric configurations matching existing system
 * These are used when no custom configurations are provided
 */
export const DEFAULT_METRIC_CONFIGS: MetricConfig[] = [
  {
    id: 'logic',
    name: 'Logic',
    prompt_text: `Analyze the logical structure and argumentation of the following educational content. 
Evaluate the coherence, reasoning quality, and flow of ideas. 
Provide a score from -1 to +1.

{{content}}`,
    is_active: true,
    display_order: 1,
  },
  {
    id: 'practical',
    name: 'Practical',
    prompt_text: `Evaluate the practical applicability and real-world relevance of the following educational content. 
Consider how easily students can apply these concepts. 
Provide a score from -1 to +1.

{{content}}`,
    is_active: true,
    display_order: 2,
  },
  {
    id: 'complexity',
    name: 'Complexity',
    prompt_text: `Assess the depth and complexity of the following educational content. 
Consider if the material is appropriately challenging and comprehensive. 
Provide a score from -1 to +1.

{{content}}`,
    is_active: true,
    display_order: 3,
  },
  {
    id: 'interest',
    name: 'Interest',
    prompt_text: `Evaluate how engaging and interesting the following educational content is. 
Consider factors that would maintain student attention and curiosity. 
Provide a score from -1 to +1.

{{content}}`,
    is_active: true,
    display_order: 4,
  },
  {
    id: 'care',
    name: 'Care',
    prompt_text: `Assess the attention to detail and overall quality of the following educational content. 
Consider formatting, clarity, and professional presentation. 
Provide a score from -1 to +1.

{{content}}`,
    is_active: true,
    display_order: 5,
  },
]

/**
 * Type guard to check if an object is a valid MetricConfig
 */
export function isValidMetricConfig(obj: any): obj is MetricConfig {
  return (
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.prompt_text === 'string' &&
    typeof obj.is_active === 'boolean' &&
    typeof obj.display_order === 'number' &&
    obj.display_order > 0
  )
}

/**
 * Validate an array of metric configurations
 */
export function validateMetricConfigs(configs: any[]): ValidationError[] {
  const errors: ValidationError[] = []

  if (!Array.isArray(configs)) {
    errors.push({
      field: 'configurations',
      message: 'Configurations must be an array',
    })
    return errors
  }

  if (configs.length === 0) {
    errors.push({
      field: 'configurations',
      message: 'At least one metric configuration is required',
    })
    return errors
  }

  if (configs.length > 20) {
    errors.push({
      field: 'configurations',
      message: 'Maximum 20 metric configurations allowed',
      value: configs.length,
    })
  }

  configs.forEach((config, index) => {
    if (!isValidMetricConfig(config)) {
      errors.push({
        field: `configurations[${index}]`,
        message: 'Invalid metric configuration structure',
        value: config,
      })
      return
    }

    // Validate field lengths
    if (config.name.length > 50) {
      errors.push({
        field: `configurations[${index}].name`,
        message: 'Metric name must be 50 characters or less',
        value: config.name,
      })
    }

    if (config.prompt_text.length > 5000) {
      errors.push({
        field: `configurations[${index}].prompt_text`,
        message: 'Prompt text must be 5000 characters or less',
        value: config.prompt_text.length,
      })
    }

    // Check for prompt injection attempts
    const suspiciousPatterns = [
      /system\s*:/i,
      /ignore\s+previous/i,
      /disregard\s+instructions/i,
      /\{\{.*\}\}/g, // Check for multiple template variables
    ]

    const templateCount = (config.prompt_text.match(/\{\{content\}\}/g) || []).length
    if (templateCount !== 1) {
      errors.push({
        field: `configurations[${index}].prompt_text`,
        message: 'Prompt must contain exactly one {{content}} placeholder',
        value: templateCount,
      })
    }

    suspiciousPatterns.forEach((pattern) => {
      if (pattern.test(config.prompt_text) && !pattern.toString().includes('content')) {
        errors.push({
          field: `configurations[${index}].prompt_text`,
          message: 'Prompt contains suspicious patterns',
          value: config.prompt_text,
        })
      }
    })
  })

  // Check for duplicate IDs
  const ids = configs.map((c) => c.id)
  const uniqueIds = new Set(ids)
  if (ids.length !== uniqueIds.size) {
    errors.push({
      field: 'configurations',
      message: 'Duplicate metric IDs found',
    })
  }

  // Check for duplicate display orders
  const activeConfigs = configs.filter((c) => c.is_active)
  const orders = activeConfigs.map((c) => c.display_order)
  const uniqueOrders = new Set(orders)
  if (orders.length !== uniqueOrders.size) {
    errors.push({
      field: 'configurations',
      message: 'Duplicate display_order values found for active metrics',
    })
  }

  return errors
}
