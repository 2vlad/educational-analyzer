export interface GenerateOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  timeoutMs?: number
  metadata?: Record<string, unknown>
}

export interface GenerateResult {
  score: number
  comment: string
  examples: string[]
  detailed_analysis?: string
  raw: unknown
  tokensUsed?: number
  durationMs: number
  provider: string
  model: string
}

export interface LLMProvider {
  generate(prompt: string, content: string, options?: GenerateOptions): Promise<GenerateResult>
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean = false,
    public provider?: string,
  ) {
    super(message)
    this.name = 'ProviderError'
  }
}

export const ERROR_CODES = {
  TIMEOUT: 'TIMEOUT',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  BAD_OUTPUT: 'BAD_OUTPUT',
  AUTH_ERROR: 'AUTH_ERROR',
  RATE_LIMIT: 'RATE_LIMIT',
  INVALID_REQUEST: 'INVALID_REQUEST',
} as const
