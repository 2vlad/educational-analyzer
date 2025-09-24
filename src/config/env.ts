import { z } from 'zod'

// Server-side environment variables schema
const serverEnvSchema = z.object({
  // Supabase (accept either SERVICE_ROLE_KEY or SERVICE_KEY)
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_SERVICE_KEY: z.string().optional(),

  // LLM Providers (at least one required)
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  YANDEX_API_KEY: z.string().optional(),
  YANDEX_FOLDER_ID: z.string().optional(),

  // LLM Config
  DEFAULT_MODEL: z.string().default('yandex-gpt-pro'),
  ENABLE_MODEL_SWITCHING: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),
  ENABLE_COGNITIVE_LOAD: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),
  MAX_RETRIES: z.string().transform(Number).default('3'),
  REQUEST_TIMEOUT: z.string().transform(Number).default('30000'),

  // App config
  MAX_FILE_SIZE_MB: z.string().transform(Number).default('10'),
  MAX_TEXT_LENGTH: z.string().transform(Number).default('20000'),
  RATE_LIMIT_PER_HOUR: z.string().transform(Number).default('10'),

  // Security
  RATE_LIMIT_SALT: z.string().optional().default('default-salt-for-rate-limiting'),

  // Debug/Logging
  DEBUG: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Railway
  RAILWAY_STATIC_URL: z.string().optional(),
})

// Client-side environment variables schema
const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('Invalid NEXT_PUBLIC_SUPABASE_URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
})

type ClientEnv = z.infer<typeof clientEnvSchema>

// Validate that at least one LLM provider is configured
const validateLLMProviders = (env: z.infer<typeof serverEnvSchema>) => {
  if (!env.ANTHROPIC_API_KEY && !env.OPENAI_API_KEY && !env.GOOGLE_API_KEY && !env.YANDEX_API_KEY) {
    throw new Error('At least one LLM provider API key must be configured')
  }
}

// Validate that at least one Supabase service key is configured
const validateSupabaseKeys = (env: z.infer<typeof serverEnvSchema>) => {
  if (!env.SUPABASE_SERVICE_ROLE_KEY && !env.SUPABASE_SERVICE_KEY) {
    console.warn(
      '⚠️ Warning: No SUPABASE_SERVICE_ROLE_KEY configured. Database operations may fail.',
    )
  }
}

// Parse and validate server environment
let serverEnv: z.infer<typeof serverEnvSchema> | undefined

// Only validate server env on server-side
if (typeof window === 'undefined') {
  try {
    console.log('🔍 Starting environment validation...')
    console.log('Available environment variables:')
    console.log('- ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? 'SET' : 'NOT SET')
    console.log('- OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET')
    console.log('- GOOGLE_API_KEY:', process.env.GOOGLE_API_KEY ? 'SET' : 'NOT SET')
    console.log('- YANDEX_API_KEY:', process.env.YANDEX_API_KEY ? 'SET' : 'NOT SET')
    console.log('- YANDEX_FOLDER_ID:', process.env.YANDEX_FOLDER_ID ? 'SET' : 'NOT SET')
    console.log(
      '- SUPABASE_SERVICE_ROLE_KEY:',
      process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET',
    )
    console.log('- SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY ? 'SET' : 'NOT SET')
    console.log('- RATE_LIMIT_SALT:', process.env.RATE_LIMIT_SALT ? 'SET' : 'NOT SET')

    serverEnv = serverEnvSchema.parse(process.env)

    console.log('✅ Schema validation passed')

    validateLLMProviders(serverEnv)
    console.log('✅ LLM providers validated')

    validateSupabaseKeys(serverEnv)
    console.log('✅ Supabase keys checked')

    console.log('✅ Environment validated successfully')
    console.log('Available API providers:')
    if (serverEnv.ANTHROPIC_API_KEY) console.log('  - Anthropic')
    if (serverEnv.OPENAI_API_KEY) console.log('  - OpenAI')
    if (serverEnv.GOOGLE_API_KEY) console.log('  - Google')
    if (serverEnv.YANDEX_API_KEY) console.log('  - Yandex')
  } catch (error) {
    console.error('❌ Environment validation failed!')
    if (error instanceof z.ZodError) {
      console.error('Validation errors:', error.flatten().fieldErrors)
      console.error('Missing required fields:', Object.keys(error.flatten().fieldErrors))
    } else {
      console.error('Error:', error)
    }
    throw error
  }
}

// Parse and validate client environment when possible
const rawClientEnv = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
}

const clientEnvResult = clientEnvSchema.safeParse(rawClientEnv)

if (!clientEnvResult.success) {
  console.warn('⚠️ Supabase client environment variables are not fully configured.')
  console.warn(
    '   NEXT_PUBLIC_SUPABASE_URL set:',
    rawClientEnv.NEXT_PUBLIC_SUPABASE_URL ? 'YES' : 'NO',
  )
  console.warn(
    '   NEXT_PUBLIC_SUPABASE_ANON_KEY set:',
    rawClientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'YES' : 'NO',
  )
  console.warn('   Features that require Supabase will fail until these values are provided.')
}

const clientEnv: ClientEnv | null = clientEnvResult.success ? clientEnvResult.data : null

const ensureClientEnv = (): ClientEnv => {
  if (!clientEnvResult.success) {
    throw new Error(
      'Supabase client environment variables NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be provided.',
    )
  }

  return clientEnvResult.data
}

// Export validated environment variables
export const env = {
  // Client-safe variables
  client: clientEnv,

  // Server-only variables (undefined on client)
  server: serverEnv,

  // Helper to check if we're on server
  isServer: typeof window === 'undefined',

  // Runtime assertion for client env
  requireClient: ensureClientEnv,
}

// Type exports for use across the app
export type ServerEnv = z.infer<typeof serverEnvSchema>
export type { ClientEnv }
