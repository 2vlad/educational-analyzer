import { env } from '@/src/config/env'
import { LLMProvider, GenerateOptions, GenerateResult, ProviderError, ERROR_CODES } from './types'
import { parseLLMOutput } from '@/src/utils/parseLLMOutput'
import { debug } from '@/src/utils/debug'

interface YandexGPTMessage {
  role: 'system' | 'user' | 'assistant'
  text: string
}

interface YandexGPTRequest {
  modelUri: string
  completionOptions: {
    stream: boolean
    temperature: number
    maxTokens: string
  }
  messages: YandexGPTMessage[]
}

interface YandexGPTResponse {
  result: {
    alternatives: Array<{
      message: {
        role: string
        text: string
      }
      status: string
    }>
    usage: {
      inputTextTokens: string
      completionTokens: string
      totalTokens: string
    }
    modelVersion: string
  }
}

export class YandexProvider implements LLMProvider {
  private readonly providerName = 'yandex'
  private readonly apiEndpoint = 'https://llm.api.cloud.yandex.net/foundationModels/v1/completion'

  constructor() {
    if (env.isServer) {
      if (!env.server?.YANDEX_API_KEY) {
        console.log('⚠️ Yandex Provider: No API key found in environment')
      } else {
        console.log(
          '🔑 Yandex Provider: Initialized with API key:',
          env.server.YANDEX_API_KEY.substring(0, 20) + '...',
        )
      }

      if (!env.server?.YANDEX_FOLDER_ID) {
        console.log('⚠️ Yandex Provider: No folder ID found in environment')
      }
    }
  }

  async generate(
    prompt: string,
    content: string,
    options: GenerateOptions = {},
  ): Promise<GenerateResult> {
    if (!env.server?.YANDEX_API_KEY) {
      throw new ProviderError(
        'Yandex API key not configured',
        ERROR_CODES.AUTH_ERROR,
        false,
        this.providerName,
      )
    }

    if (!env.server?.YANDEX_FOLDER_ID) {
      throw new ProviderError(
        'Yandex folder ID not configured',
        ERROR_CODES.INVALID_REQUEST,
        false,
        this.providerName,
      )
    }

    // The options.model already contains the actual Yandex model path (e.g., "yandexgpt/rc")
    // when called from LLMService. We'll use that directly or fall back to a default.
    const yandexModelPath = options.model || 'yandexgpt/latest'

    // For temperature and maxTokens, use options or defaults
    const temperature = options.temperature ?? 0.3
    const maxTokens = options.maxTokens ?? 2000

    const startTime = Date.now()
    const finalPrompt = prompt.replace('{{content}}', content)

    try {
      // Build modelUri from configuration; prefer stable "latest" in production
      // Ensure we trim any whitespace from the folder ID
      const trimmedFolderId = env.server.YANDEX_FOLDER_ID.trim()

      // Get the model name and replace /rc with /latest for stability
      const configuredModel = yandexModelPath.replace(/\/rc$/, '/latest')

      // Validate that we're using the correct Yandex model format
      if (!configuredModel.startsWith('yandexgpt')) {
        console.warn(`Warning: Unexpected Yandex model format: ${configuredModel}`)
      }

      const primaryUri = `gpt://${trimmedFolderId}/${configuredModel}`

      // Add validation to ensure no newlines in the URI
      if (primaryUri.includes('\n') || primaryUri.includes('\r')) {
        console.error('ERROR: Model URI contains newline characters:', primaryUri)
        throw new ProviderError(
          'Invalid model URI format - contains newline characters',
          ERROR_CODES.INVALID_REQUEST,
          false,
          this.providerName,
        )
      }

      const makeBody = (modelUri: string): YandexGPTRequest => ({
        modelUri,
        completionOptions: {
          stream: false,
          temperature: temperature,
          maxTokens: String(maxTokens),
        },
        messages: [
          {
            role: 'system',
            text: 'Ты помощник для анализа образовательного контента. Отвечай только в формате JSON.',
          },
          { role: 'user', text: finalPrompt },
        ],
      })

      // Create the request body for primary model
      const requestBody = makeBody(primaryUri)

      debug.debug('\n=== YANDEX GPT REQUEST ===')
      debug.debug('Model URI:', requestBody.modelUri)
      debug.debug('Temperature:', requestBody.completionOptions.temperature)
      debug.debug('Max tokens:', requestBody.completionOptions.maxTokens)
      debug.payload('Request messages', requestBody.messages)
      debug.debug('====================\n')

      // Helper to call Yandex endpoint
      const callYandex = async (uri: string) =>
        await fetch(this.apiEndpoint, {
          method: 'POST',
          headers: {
            Authorization: `Api-Key ${env.server.YANDEX_API_KEY}`,
            'Content-Type': 'application/json',
            'x-data-logging-enabled': 'false',
            'x-folder-id': env.server.YANDEX_FOLDER_ID || '',
          },
          body: JSON.stringify(makeBody(uri)),
          signal: options.timeoutMs ? globalThis.AbortSignal.timeout(options.timeoutMs) : undefined,
        })

      // Try primary modelUri; if YC reports invalid model_uri, retry with "yandexgpt/latest"
      let response = await callYandex(primaryUri)
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Yandex API error:', response.status, errorText)
        const shouldRetryWithLatest =
          response.status === 400 && /invalid model_uri/i.test(errorText)
        if (shouldRetryWithLatest) {
          const fallbackUri = `gpt://${trimmedFolderId}/yandexgpt/latest`
          console.warn('Retrying Yandex with fallback modelUri:', fallbackUri)
          response = await callYandex(fallbackUri)
        } else {
          // Recreate Response body for downstream error handling
          throw new ProviderError(
            `API error: ${response.status}`,
            ERROR_CODES.PROVIDER_ERROR,
            response.status >= 500,
            this.providerName,
          )
        }
      }
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Yandex API error:', response.status, errorText)
        if (response.status === 401) {
          throw new ProviderError(
            'Authentication failed - check API key',
            ERROR_CODES.AUTH_ERROR,
            false,
            this.providerName,
          )
        }

        if (response.status === 429) {
          throw new ProviderError(
            'Rate limit exceeded',
            ERROR_CODES.RATE_LIMIT,
            true,
            this.providerName,
          )
        }

        throw new ProviderError(
          `API error: ${response.status}`,
          ERROR_CODES.PROVIDER_ERROR,
          response.status >= 500,
          this.providerName,
        )
      }

      const data = (await response.json()) as YandexGPTResponse
      const durationMs = Date.now() - startTime

      // Extract the response text
      const responseText = data.result.alternatives[0]?.message?.text || ''

      debug.debug('\n=== YANDEX RESPONSE ===')
      debug.debug('Model version:', data.result.modelVersion)
      debug.debug('Usage:', {
        input: data.result.usage.inputTextTokens,
        output: data.result.usage.completionTokens,
        total: data.result.usage.totalTokens,
      })
      debug.debug('Raw text length:', responseText.length)
      debug.payload('Response text', responseText)
      debug.debug('====================\n')

      // Parse the response
      const parsed = parseLLMOutput(responseText)

      return {
        ...parsed,
        raw: data,
        tokensUsed: parseInt(data.result.usage.completionTokens),
        durationMs,
        provider: this.providerName,
        model: data.result.modelVersion || 'yandexgpt',
      }
    } catch (error) {
      // Handle different error types
      const err = error as Error & { name?: string }

      if (err.name === 'AbortError') {
        throw new ProviderError('Request timeout', ERROR_CODES.TIMEOUT, true, this.providerName)
      }

      if (error instanceof ProviderError) {
        throw error
      }

      throw new ProviderError(
        err.message || 'Provider error',
        ERROR_CODES.PROVIDER_ERROR,
        false,
        this.providerName,
      )
    }
  }
}
