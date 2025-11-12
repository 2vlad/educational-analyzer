import { NextResponse } from 'next/server'

export async function GET() {
  // IMPORTANT: This endpoint should be removed after debugging!
  // It exposes environment variable information

  const envDebug = {
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    envVars: {
      // Check if variables exist (don't expose actual values)
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY
        ? `SET (length: ${process.env.OPENROUTER_API_KEY.length})`
        : 'NOT SET',
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY
        ? `SET (length: ${process.env.ANTHROPIC_API_KEY.length})`
        : 'NOT SET',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY
        ? `SET (length: ${process.env.OPENAI_API_KEY.length})`
        : 'NOT SET',
      YANDEX_API_KEY: process.env.YANDEX_API_KEY
        ? `SET (length: ${process.env.YANDEX_API_KEY.length})`
        : 'NOT SET',
      // Also check what env.ts sees
    },
    processEnvKeys: Object.keys(process.env)
      .filter((key) => key.includes('API') || key.includes('KEY') || key.includes('OPENROUTER'))
      .sort(),
  }

  // Try to load env config
  try {
    const { env } = await import('@/src/config/env')
    envDebug.envConfig = {
      isServer: env.isServer,
      serverExists: !!env.server,
      serverKeys: env.server
        ? Object.keys(env.server).filter(
            (k) => k.includes('API') || k.includes('KEY') || k.includes('OPENROUTER'),
          )
        : [],
      openRouterInServer: env.server?.OPENROUTER_API_KEY
        ? `SET (length: ${env.server.OPENROUTER_API_KEY.length})`
        : 'NOT SET',
    }
  } catch (error) {
    envDebug.envConfig = {
      error: error instanceof Error ? error.message : 'Unknown error loading env config',
    }
  }

  return NextResponse.json(envDebug)
}
