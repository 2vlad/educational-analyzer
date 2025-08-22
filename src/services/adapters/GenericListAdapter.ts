/**
 * GenericListAdapter - Handles lists of URLs from text or JSON files
 * Fallback adapter for when content is provided as a simple list
 */

import { createHash } from 'crypto'
import type { SourceAdapter, AuthContext, LessonInfo, LessonContent } from '../ScraperService'

interface ManifestJson {
  lessons?: Array<{
    title: string
    url: string
    order?: number
  }>
  urls?: string[]
}

export class GenericListAdapter implements SourceAdapter {
  async validate(rootUrl: string): Promise<{ ok: boolean; reason?: string }> {
    try {
      const url = new URL(rootUrl)
      
      // Check if it's a file that could contain a list
      const validExtensions = ['.txt', '.json', '.csv']
      const validPaths = ['/manifest', '/urls', '/lessons']
      
      const hasValidExtension = validExtensions.some(ext => url.pathname.endsWith(ext))
      const hasValidPath = validPaths.some(path => url.pathname.includes(path))
      
      if (!hasValidExtension && !hasValidPath) {
        return { 
          ok: false, 
          reason: 'URL должен указывать на файл .txt, .json или .csv со списком уроков' 
        }
      }
      
      return { ok: true }
    } catch (error) {
      return { 
        ok: false, 
        reason: 'Неверный формат URL' 
      }
    }
  }
  
  async enumerateLessons(rootUrl: string, auth: AuthContext): Promise<LessonInfo[]> {
    try {
      const response = await fetch(rootUrl, {
        headers: auth.cookie ? {
          'Cookie': auth.cookie,
          'User-Agent': 'Mozilla/5.0'
        } : {
          'User-Agent': 'Mozilla/5.0'
        }
      })
      
      if (!response.ok) {
        throw new Error(`Ошибка загрузки файла: ${response.status}`)
      }
      
      const contentType = response.headers.get('content-type') || ''
      const text = await response.text()
      
      // Parse based on content type
      if (contentType.includes('json') || rootUrl.endsWith('.json')) {
        return this.parseJsonManifest(text)
      } else {
        return this.parseTextList(text)
      }
    } catch (error: any) {
      throw new Error(`Ошибка при получении списка уроков: ${error.message}`)
    }
  }
  
  async fetchLessonContent(url: string, auth: AuthContext): Promise<LessonContent> {
    try {
      const response = await fetch(url, {
        headers: auth.cookie ? {
          'Cookie': auth.cookie,
          'User-Agent': 'Mozilla/5.0'
        } : {
          'User-Agent': 'Mozilla/5.0'
        }
      })
      
      if (!response.ok) {
        throw new Error(`Ошибка загрузки урока: ${response.status}`)
      }
      
      const html = await response.text()
      const text = this.extractTextFromHtml(html)
      
      // Compute content hash
      const hash = createHash('sha256')
        .update(text)
        .digest('hex')
      
      return {
        text,
        raw: html,
        hash
      }
    } catch (error: any) {
      throw new Error(`Ошибка при получении содержимого урока: ${error.message}`)
    }
  }
  
  private parseJsonManifest(jsonText: string): LessonInfo[] {
    try {
      const data: ManifestJson = JSON.parse(jsonText)
      const lessons: LessonInfo[] = []
      
      // If there's a lessons array
      if (data.lessons && Array.isArray(data.lessons)) {
        data.lessons.forEach((lesson, index) => {
          if (lesson.url) {
            lessons.push({
              title: lesson.title || `Урок ${index + 1}`,
              url: lesson.url,
              order: lesson.order ?? index
            })
          }
        })
      }
      
      // If there's just a urls array
      else if (data.urls && Array.isArray(data.urls)) {
        data.urls.forEach((url, index) => {
          if (url) {
            lessons.push({
              title: `Урок ${index + 1}`,
              url: url,
              order: index
            })
          }
        })
      }
      
      return lessons
    } catch (error) {
      throw new Error('Неверный формат JSON файла')
    }
  }
  
  private parseTextList(text: string): LessonInfo[] {
    const lessons: LessonInfo[] = []
    const lines = text.split('\n').map(line => line.trim()).filter(line => line)
    
    lines.forEach((line, index) => {
      // Skip comments
      if (line.startsWith('#') || line.startsWith('//')) {
        return
      }
      
      // Check if line has title and URL separated by delimiter
      const delimiters = ['\t', '|', ',', ';']
      let title = `Урок ${index + 1}`
      let url = line
      
      for (const delimiter of delimiters) {
        if (line.includes(delimiter)) {
          const parts = line.split(delimiter).map(p => p.trim())
          if (parts.length >= 2) {
            // Could be "title,url" or "url,title"
            if (parts[0].startsWith('http')) {
              url = parts[0]
              title = parts[1] || title
            } else if (parts[1].startsWith('http')) {
              title = parts[0]
              url = parts[1]
            }
            break
          }
        }
      }
      
      // Validate URL
      try {
        new URL(url)
        lessons.push({
          title,
          url,
          order: index
        })
      } catch {
        // Skip invalid URLs
      }
    })
    
    return lessons
  }
  
  private extractTextFromHtml(html: string): string {
    // Simple HTML to text extraction without JSDOM
    // Remove script and style content
    let text = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    
    // Remove HTML tags
    text = text.replace(/<[^>]+>/g, ' ')
    
    // Decode HTML entities
    text = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
    
    // Normalize whitespace
    text = text
      .replace(/\s+/g, ' ')
      .trim()
    
    return text
  }
}