/**
 * ScraperService - Registry for source adapters
 * Manages different content sources for batch analysis
 */

import { YonoteAdapter } from './adapters/YonoteAdapter'
import { GenericListAdapter } from './adapters/GenericListAdapter'

export interface AuthContext {
  cookie?: string
  token?: string
  apiKey?: string
}

export interface LessonInfo {
  title: string
  url: string
  order?: number
  parentUrl?: string
  parentId?: string
}

export interface LessonContent {
  text: string
  raw?: string
  hash: string
}

export interface SourceAdapter {
  /**
   * Validates that a root URL is compatible with this adapter
   */
  validate(rootUrl: string): Promise<{ ok: boolean; reason?: string }>

  /**
   * Enumerates all lessons from a root URL
   */
  enumerateLessons(rootUrl: string, auth: AuthContext): Promise<LessonInfo[]>

  /**
   * Fetches content for a specific lesson
   */
  fetchLessonContent(url: string, auth: AuthContext): Promise<LessonContent>
}

export class ScraperService {
  private static adapters: Map<string, SourceAdapter> = new Map()

  static {
    // Register default adapters
    ScraperService.registerAdapter('yonote', new YonoteAdapter())
    ScraperService.registerAdapter('generic_list', new GenericListAdapter())
  }

  /**
   * Registers a new source adapter
   */
  static registerAdapter(type: string, adapter: SourceAdapter): void {
    ScraperService.adapters.set(type, adapter)
  }

  /**
   * Gets an adapter by type
   */
  static getAdapter(type: string): SourceAdapter | undefined {
    return ScraperService.adapters.get(type)
  }

  /**
   * Determines the appropriate adapter for a URL
   */
  static async determineAdapter(
    url: string,
  ): Promise<{ type: string; adapter: SourceAdapter } | null> {
    // Check Yonote first as it's the primary source
    if (url.includes('yonote.ru') || url.includes('practicum.yandex')) {
      const adapter = ScraperService.adapters.get('yonote')
      if (adapter) {
        const validation = await adapter.validate(url)
        if (validation.ok) {
          return { type: 'yonote', adapter }
        }
      }
    }

    // Check if it's a manifest/list file
    if (url.endsWith('.txt') || url.endsWith('.json') || url.includes('/manifest')) {
      const adapter = ScraperService.adapters.get('generic_list')
      if (adapter) {
        const validation = await adapter.validate(url)
        if (validation.ok) {
          return { type: 'generic_list', adapter }
        }
      }
    }

    return null
  }

  /**
   * Validates a URL against all registered adapters
   */
  static async validateUrl(url: string): Promise<{
    valid: boolean
    adapterType?: string
    reason?: string
  }> {
    const result = await ScraperService.determineAdapter(url)

    if (result) {
      return { valid: true, adapterType: result.type }
    }

    return {
      valid: false,
      reason: 'URL не поддерживается. Используйте ссылку на Yonote или файл со списком URL.',
    }
  }
}
