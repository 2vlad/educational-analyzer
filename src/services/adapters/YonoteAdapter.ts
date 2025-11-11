/**
 * YonoteAdapter - Handles content scraping from Yonote platform
 * Uses session cookies for authenticated access
 */

import { createHash } from 'crypto'
import { JSDOM } from 'jsdom'
import type { SourceAdapter, AuthContext, LessonInfo, LessonContent } from '../ScraperService'

export class YonoteAdapter implements SourceAdapter {
  private readonly ALLOWED_HOSTS = ['yonote.ru', 'practicum.yandex.ru', 'praktikum.yandex.ru']

  async validate(rootUrl: string): Promise<{ ok: boolean; reason?: string }> {
    try {
      const url = new URL(rootUrl)

      // Check if host is allowed
      const isAllowed = this.ALLOWED_HOSTS.some((host) => url.hostname.includes(host))

      if (!isAllowed) {
        return {
          ok: false,
          reason: `Хост ${url.hostname} не поддерживается. Используйте ссылки на Yonote.`,
        }
      }

      // Check protocol
      if (!['http:', 'https:'].includes(url.protocol)) {
        return {
          ok: false,
          reason: 'Поддерживаются только HTTP/HTTPS протоколы',
        }
      }

      return { ok: true }
    } catch (error) {
      return {
        ok: false,
        reason: 'Неверный формат URL',
      }
    }
  }

  async enumerateLessons(rootUrl: string, auth: AuthContext): Promise<LessonInfo[]> {
    if (!auth.cookie) {
      throw new Error('Требуется cookie для доступа к Yonote')
    }

    try {
      // Fetch the root page
      const response = await fetch(rootUrl, {
        headers: {
          Cookie: auth.cookie,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      })

      if (response.status === 401 || response.status === 403) {
        throw new Error('SESSION_EXPIRED')
      }

      if (!response.ok) {
        throw new Error(`Ошибка загрузки страницы: ${response.status}`)
      }

      const html = await response.text()
      const lessons = this.parseLessonsFromHtml(html, rootUrl)

      return lessons
    } catch (error: any) {
      if (error.message === 'SESSION_EXPIRED') {
        throw error
      }
      throw new Error(`Ошибка при получении списка уроков: ${error.message}`)
    }
  }

  async fetchLessonContent(url: string, auth: AuthContext): Promise<LessonContent> {
    if (!auth.cookie) {
      throw new Error('Требуется cookie для доступа к Yonote')
    }

    try {
      const response = await fetch(url, {
        headers: {
          Cookie: auth.cookie,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      })

      if (response.status === 401 || response.status === 403) {
        throw new Error('SESSION_EXPIRED')
      }

      if (!response.ok) {
        throw new Error(`Ошибка загрузки урока: ${response.status}`)
      }

      const html = await response.text()
      const content = this.extractContentFromHtml(html)

      // Compute content hash
      const hash = createHash('sha256').update(content.text).digest('hex')

      return {
        text: content.text,
        raw: html,
        hash,
      }
    } catch (error: any) {
      if (error.message === 'SESSION_EXPIRED') {
        throw error
      }
      throw new Error(`Ошибка при получении содержимого урока: ${error.message}`)
    }
  }

  private parseLessonsFromHtml(html: string, baseUrl: string): LessonInfo[] {
    const lessons: LessonInfo[] = []
    const dom = new JSDOM(html)
    const document = dom.window.document

    // Try multiple selectors for lesson links
    const selectors = [
      // Common Yonote selectors
      'a[href*="/urok/"], a[href*="/lesson/"]',
      '.lesson-link, .topic-link',
      '[data-lesson-id] a',
      '.content-tree a',
      '.syllabus-item a',
      // Practicum specific
      '.curriculum-module__lesson a',
      '.lesson-card__link',
    ]

    let lessonElements: NodeListOf<HTMLAnchorElement> | null = null

    for (const selector of selectors) {
      lessonElements = document.querySelectorAll<HTMLAnchorElement>(selector)
      if (lessonElements && lessonElements.length > 0) {
        break
      }
    }

    // If no specific lesson links found, try to find all internal links
    if (!lessonElements || lessonElements.length === 0) {
      lessonElements = document.querySelectorAll<HTMLAnchorElement>('a[href]')
    }

    const baseUrlObj = new URL(baseUrl)
    const seenUrls = new Set<string>()

    lessonElements?.forEach((element, index) => {
      const href = element.getAttribute('href')
      if (!href) return

      // Resolve relative URLs
      let fullUrl: string
      try {
        if (href.startsWith('http')) {
          fullUrl = href
        } else if (href.startsWith('/')) {
          fullUrl = `${baseUrlObj.protocol}//${baseUrlObj.host}${href}`
        } else {
          fullUrl = new URL(href, baseUrl).toString()
        }

        // Check if it's on the same domain
        const urlObj = new URL(fullUrl)
        if (urlObj.host !== baseUrlObj.host) {
          return
        }

        // Skip if already seen
        if (seenUrls.has(fullUrl)) {
          return
        }
        seenUrls.add(fullUrl)

        // Skip non-lesson URLs
        const skipPatterns = [
          '/profile',
          '/settings',
          '/logout',
          '/login',
          '.pdf',
          '.zip',
          '.png',
          '.jpg',
          '.css',
          '.js',
          '#',
          'mailto:',
          'javascript:',
        ]

        if (skipPatterns.some((pattern) => fullUrl.includes(pattern))) {
          return
        }

        // Extract title
        let title = element.textContent?.trim() || ''

        // Try to get better title from parent elements
        if (!title || title.length < 3) {
          const parent = element.closest('[data-lesson-title], .lesson-item, .topic-item')
          title = parent?.textContent?.trim() || `Урок ${index + 1}`
        }

        // Clean up title
        title = title.replace(/\s+/g, ' ').substring(0, 200)

        lessons.push({
          title,
          url: fullUrl,
          order: index,
        })
      } catch (error) {
        // Skip invalid URLs
      }
    })

    return lessons
  }

  private extractContentFromHtml(html: string): { text: string } {
    const dom = new JSDOM(html)
    const document = dom.window.document

    // Remove scripts, styles, and other non-content elements
    const elementsToRemove = document.querySelectorAll(
      'script, style, nav, header, footer, .navigation, .sidebar, .menu, .breadcrumb',
    )
    elementsToRemove.forEach((el) => el.remove())

    // Try to find main content area
    const contentSelectors = [
      'main',
      'article',
      '.content',
      '.lesson-content',
      '.main-content',
      '[role="main"]',
      '#content',
      '.page-content',
    ]

    let contentElement: Element | null = null

    for (const selector of contentSelectors) {
      contentElement = document.querySelector(selector)
      if (contentElement) {
        break
      }
    }

    // If no main content found, use body
    if (!contentElement) {
      contentElement = document.body
    }

    // Extract text content
    let text = contentElement?.textContent || ''

    // Normalize whitespace
    text = text
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\t+/g, ' ')
      .replace(/ {2,}/g, ' ')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join('\n')

    // Ensure minimum content
    if (text.length < 100) {
      // Try to get more content from the entire body
      text = document.body.textContent || ''
      text = text.replace(/\s+/g, ' ').trim()
    }

    return { text }
  }
}
