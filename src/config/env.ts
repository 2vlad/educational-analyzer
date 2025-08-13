import { z } from 'zod'

// Server-side environment variables schema
const serverEnvSchema = z.object({
  // Supabase
  SUPABASE_SERVICE_KEY: z.string().min(1, 'SUPABASE_SERVICE_KEY is required'),

  // LLM Providers (at least one required)
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),

  // LLM Config
  DEFAULT_MODEL: z.string().default('claude-sonnet-4'),
  ENABLE_MODEL_SWITCHING: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),
  MAX_RETRIES: z.string().transform(Number).default('3'),
  REQUEST_TIMEOUT: z.string().transform(Number).default('30000'),

  // App config
  MAX_FILE_SIZE_MB: z.string().transform(Number).default('10'),
  MAX_TEXT_LENGTH: z.string().transform(Number).default('2000'),
  RATE_LIMIT_PER_HOUR: z.string().transform(Number).default('10'),

  // Security
  RATE_LIMIT_SALT: z.string().min(1, 'RATE_LIMIT_SALT is required'),

  // Railway
  RAILWAY_STATIC_URL: z.string().optional(),
})

// Client-side environment variables schema
const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('Invalid NEXT_PUBLIC_SUPABASE_URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
})

// Validate that at least one LLM provider is configured
const validateLLMProviders = (env: z.infer<typeof serverEnvSchema>) => {
  if (!env.ANTHROPIC_API_KEY && !env.OPENAI_API_KEY && !env.GOOGLE_API_KEY) {
    throw new Error('At least one LLM provider API key must be configured')
  }
}

// Parse and validate server environment
let serverEnv: z.infer<typeof serverEnvSchema> | undefined

// Only validate server env on server-side
if (typeof window === 'undefined') {
  try {
    console.log('🔍 Checking environment variables:')
    console.log(
      'ANTHROPIC_API_KEY from process.env:',
      process.env.ANTHROPIC_API_KEY?.substring(0, 20) + '...',
    )
    serverEnv = serverEnvSchema.parse(process.env)
    validateLLMProviders(serverEnv)
    console.log('✅ Environment validated successfully')
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Invalid environment variables:', error.flatten().fieldErrors)
      throw new Error('Invalid environment variables')
    }
    throw error
  }
}

// Parse and validate client environment
const clientEnv = clientEnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
})

// Export validated environment variables
export const env = {
  // Client-safe variables
  client: clientEnv,

  // Server-only variables (undefined on client)
  server: serverEnv,

  // Helper to check if we're on server
  isServer: typeof window === 'undefined',
}

// Type exports for use across the app
export type ServerEnv = z.infer<typeof serverEnvSchema>
export type ClientEnv = z.infer<typeof clientEnvSchema>
