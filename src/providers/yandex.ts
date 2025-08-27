import { env } from '@/src/config/env'
import { modelsManager } from '@/src/config/models'
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

    const modelId = options.model === 'yandexgpt/rc' ? 'yandex-gpt-pro' : 'yandex-gpt-pro'
    const modelConfig = modelsManager.getModelConfig(modelId)

    if (!modelConfig) {
      throw new ProviderError(
        `Yandex model configuration not found: ${modelId}`,
        ERROR_CODES.INVALID_REQUEST,
        false,
        this.providerName,
      )
    }

    const startTime = Date.now()
    const finalPrompt = prompt.replace('{{content}}', content)

    try {
      // Prepare the request body
      const requestBody: YandexGPTRequest = {
        modelUri: `gpt://${env.server.YANDEX_FOLDER_ID}/yandexgpt/rc`, // Using latest RC version
        completionOptions: {
          stream: false,
          temperature: options.temperature || modelConfig.temperature,
          maxTokens: String(options.maxTokens || modelConfig.maxTokens),
        },
        messages: [
          {
            role: 'system',
            text: 'Ты помощник для анализа образовательного контента. Отвечай только в формате JSON.',
          },
          {
            role: 'user',
            text: finalPrompt,
          },
        ],
      }

      debug.debug('\n=== YANDEX GPT REQUEST ===')
      debug.debug('Model URI:', requestBody.modelUri)
      debug.debug('Temperature:', requestBody.completionOptions.temperature)
      debug.debug('Max tokens:', requestBody.completionOptions.maxTokens)
      debug.payload('Request messages', requestBody.messages)
      debug.debug('====================\n')

      // Make the API request
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          Authorization: `Api-Key ${env.server.YANDEX_API_KEY}`,
          'Content-Type': 'application/json',
          'x-data-logging-enabled': 'false', // Disable logging for privacy
        },
        body: JSON.stringify(requestBody),
        signal: options.timeoutMs ? globalThis.AbortSignal.timeout(options.timeoutMs) : undefined,
      })

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
