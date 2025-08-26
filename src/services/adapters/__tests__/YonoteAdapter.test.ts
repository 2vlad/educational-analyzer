/**
 * Unit tests for YonoteAdapter
 */

import { YonoteAdapter } from '../YonoteAdapter'

// Mock fetch globally
global.fetch = jest.fn()

describe('YonoteAdapter', () => {
  let adapter: YonoteAdapter
  
  beforeEach(() => {
    jest.clearAllMocks()
    adapter = new YonoteAdapter()
  })

  describe('validate', () => {
    it('should validate correct Yonote URLs', async () => {
      const validUrls = [
        'https://yonote.ru/course/123',
        'https://www.yonote.ru/course/456',
        'https://yonote.ru/program/789',
        'https://subdomain.yonote.ru/course/abc',
      ]

      for (const url of validUrls) {
        const result = await adapter.validate(url)
        expect(result.ok).toBe(true)
      }
    })

    it('should reject invalid URLs', async () => {
      const invalidUrls = [
        'https://example.com/course/123',
        'https://yonote.com/course/456',
        'http://yonote.ru/course/789', // Not HTTPS
        'not-a-url',
        '',
      ]

      for (const url of invalidUrls) {
        const result = await adapter.validate(url)
        expect(result.ok).toBe(false)
        expect(result.reason).toBeDefined()
      }
    })
  })

  describe('enumerateLessons', () => {
    const mockHtml = `
      <!DOCTYPE html>
      <html>
        <body>
          <div class="lesson-tree">
            <div class="section">
              <h2>Section 1: Introduction</h2>
              <ul class="lessons">
                <li class="lesson-item">
                  <a href="/lesson/1" class="lesson-link">
                    <span class="lesson-title">Lesson 1: Getting Started</span>
                  </a>
                </li>
                <li class="lesson-item">
                  <a href="/lesson/2" class="lesson-link">
                    <span class="lesson-title">Lesson 2: Basic Concepts</span>
                  </a>
                </li>
              </ul>
            </div>
            <div class="section">
              <h2>Section 2: Advanced Topics</h2>
              <ul class="lessons">
                <li class="lesson-item">
                  <a href="/lesson/3" class="lesson-link">
                    <span class="lesson-title">Lesson 3: Deep Dive</span>
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </body>
      </html>
    `

    it('should enumerate lessons from HTML', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(mockHtml),
      })

      const lessons = await adapter.enumerateLessons(
        'https://yonote.ru/course/123',
        { cookie: 'session=abc123' }
      )

      expect(lessons).toHaveLength(3)
      expect(lessons[0]).toEqual({
        id: expect.any(String),
        title: 'Lesson 1: Getting Started',
        url: 'https://yonote.ru/lesson/1',
        section: 'Section 1: Introduction',
        displayOrder: 0,
      })
      expect(lessons[2].section).toBe('Section 2: Advanced Topics')
    })

    it('should handle authentication errors', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        text: jest.fn().mockResolvedValue('Unauthorized'),
      })

      await expect(
        adapter.enumerateLessons('https://yonote.ru/course/123', { cookie: '' })
      ).rejects.toThrow('401')
    })

    it('should handle network errors', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

      await expect(
        adapter.enumerateLessons('https://yonote.ru/course/123', { cookie: 'session=abc' })
      ).rejects.toThrow('Network error')
    })

    it('should handle empty lesson list', async () => {
      const emptyHtml = `
        <!DOCTYPE html>
        <html>
          <body>
            <div class="lesson-tree">
              <p>No lessons available</p>
            </div>
          </body>
        </html>
      `

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(emptyHtml),
      })

      const lessons = await adapter.enumerateLessons(
        'https://yonote.ru/course/123',
        { cookie: 'session=abc123' }
      )

      expect(lessons).toHaveLength(0)
    })
  })

  describe('fetchLessonContent', () => {
    const mockLessonHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Lesson 1: Getting Started</title>
        </head>
        <body>
          <article class="lesson-content">
            <h1>Getting Started with Programming</h1>
            <p>Welcome to the first lesson of our programming course.</p>
            <h2>What is Programming?</h2>
            <p>Programming is the process of creating instructions for computers.</p>
            <ul>
              <li>It involves writing code</li>
              <li>It requires logical thinking</li>
              <li>It's creative and fun!</li>
            </ul>
            <h2>Your First Program</h2>
            <pre><code>print("Hello, World!")</code></pre>
            <p>This simple program displays a greeting message.</p>
          </article>
        </body>
      </html>
    `

    it('should extract lesson content from HTML', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(mockLessonHtml),
      })

      const content = await adapter.fetchLessonContent(
        'https://yonote.ru/lesson/1',
        { cookie: 'session=abc123' }
      )

      expect(content.text).toContain('Getting Started with Programming')
      expect(content.text).toContain('Welcome to the first lesson')
      expect(content.text).toContain('Programming is the process')
      expect(content.text).toContain('Hello, World!')
      expect(content.hash).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should normalize whitespace in extracted text', async () => {
      const htmlWithWhitespace = `
        <html>
          <body>
            <article class="lesson-content">
              <p>Text   with    multiple     spaces</p>
              <p>And
              newlines
              everywhere</p>
            </article>
          </body>
        </html>
      `

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(htmlWithWhitespace),
      })

      const content = await adapter.fetchLessonContent(
        'https://yonote.ru/lesson/1',
        { cookie: 'session=abc123' }
      )

      expect(content.text).not.toContain('   ')
      expect(content.text).toContain('Text with multiple spaces')
      expect(content.text).toContain('And newlines everywhere')
    })

    it('should handle authentication errors', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 403,
        text: jest.fn().mockResolvedValue('Forbidden'),
      })

      await expect(
        adapter.fetchLessonContent('https://yonote.ru/lesson/1', { cookie: 'expired' })
      ).rejects.toThrow('403')
    })

    it('should handle empty content', async () => {
      const emptyHtml = `
        <html>
          <body>
            <article class="lesson-content"></article>
          </body>
        </html>
      `

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(emptyHtml),
      })

      const content = await adapter.fetchLessonContent(
        'https://yonote.ru/lesson/1',
        { cookie: 'session=abc123' }
      )

      expect(content.text).toBe('')
      expect(content.hash).toBeDefined()
    })

    it('should strip HTML tags but preserve content', async () => {
      const htmlWithTags = `
        <html>
          <body>
            <article class="lesson-content">
              <p>This is <strong>bold</strong> and <em>italic</em> text.</p>
              <div class="note">
                <span>Important:</span> Remember this!
              </div>
              <script>console.log('should be removed')</script>
              <style>.hidden { display: none; }</style>
            </article>
          </body>
        </html>
      `

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(htmlWithTags),
      })

      const content = await adapter.fetchLessonContent(
        'https://yonote.ru/lesson/1',
        { cookie: 'session=abc123' }
      )

      expect(content.text).toContain('This is bold and italic text')
      expect(content.text).toContain('Important: Remember this!')
      expect(content.text).not.toContain('console.log')
      expect(content.text).not.toContain('display: none')
      expect(content.text).not.toContain('<strong>')
    })
  })

  describe('Error handling', () => {
    it('should provide clear error messages for auth failures', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      })

      try {
        await adapter.fetchLessonContent('https://yonote.ru/lesson/1', { cookie: '' })
        fail('Should have thrown an error')
      } catch (error: any) {
        expect(error.message).toContain('401')
        expect(error.message).toContain('Authentication')
      }
    })

    it('should handle malformed HTML gracefully', async () => {
      const malformedHtml = `
        <html>
        <body>
          <article class="lesson-content"
            <p>Unclosed tag
            <p>Missing closing bracket
          article>
        </body>
      `

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(malformedHtml),
      })

      // Should not throw, but handle gracefully
      const content = await adapter.fetchLessonContent(
        'https://yonote.ru/lesson/1',
        { cookie: 'session=abc123' }
      )

      expect(content.text).toBeDefined()
      expect(content.hash).toBeDefined()
    })
  })
})