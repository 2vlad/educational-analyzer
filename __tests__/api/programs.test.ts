/**
 * Integration tests for Programs API endpoints
 */

import { NextRequest } from 'next/server'
import { GET as getPrograms, POST as createProgram } from '@/app/api/programs/route'
import { POST as enumerateLessons } from '@/app/api/programs/[id]/enumerate/route'
import { POST as createRun, GET as getRuns } from '@/app/api/programs/[id]/runs/route'
import { GET as getRunStatus } from '@/app/api/program-runs/[id]/status/route'
import { POST as pauseRun } from '@/app/api/program-runs/[id]/pause/route'
import { POST as resumeRun } from '@/app/api/program-runs/[id]/resume/route'
import { POST as stopRun } from '@/app/api/program-runs/[id]/stop/route'

// Mock Supabase
jest.mock('@/src/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
  }),
}))

// Mock crypto functions
jest.mock('@/src/services/crypto/secretBox', () => ({
  encryptForStorage: jest.fn().mockReturnValue('encrypted-data'),
  decryptFromStorage: jest.fn().mockReturnValue('decrypted-cookie'),
  validatePassword: jest.fn().mockReturnValue(true),
}))

// Mock ScraperService
jest.mock('@/src/services/ScraperService', () => ({
  ScraperService: {
    getAdapter: jest.fn().mockReturnValue({
      validate: jest.fn().mockResolvedValue({ ok: true }),
      enumerateLessons: jest.fn().mockResolvedValue([
        {
          id: 'lesson-1',
          title: 'Test Lesson 1',
          url: 'https://yonote.ru/lesson/1',
          section: 'Section 1',
          displayOrder: 0,
        },
        {
          id: 'lesson-2',
          title: 'Test Lesson 2',
          url: 'https://yonote.ru/lesson/2',
          section: 'Section 1',
          displayOrder: 1,
        },
      ]),
      fetchLessonContent: jest.fn().mockResolvedValue({
        text: 'Lesson content',
        hash: 'content-hash-123',
      }),
    }),
  },
}))

describe('Programs API', () => {
  let mockSupabase: any
  const mockUser = { id: 'user-123', email: 'test@example.com' }

  beforeEach(() => {
    jest.clearAllMocks()
    
    const { createClient } = require('@/src/lib/supabase/server')
    mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
      from: jest.fn(),
    }
    createClient.mockResolvedValue(mockSupabase)
  })

  describe('POST /api/programs', () => {
    it('should create a new program', async () => {
      const mockProgram = {
        id: 'prog-123',
        name: 'Test Program',
        source_type: 'yonote',
        root_url: 'https://yonote.ru/course/123',
        user_id: mockUser.id,
      }

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockProgram, error: null }),
      })

      const request = new NextRequest('http://localhost/api/programs', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Program',
          sourceType: 'yonote',
          rootUrl: 'https://yonote.ru/course/123',
        }),
      })

      const response = await createProgram(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.program).toEqual(mockProgram)
      expect(mockSupabase.from).toHaveBeenCalledWith('programs')
    })

    it('should validate required fields', async () => {
      const request = new NextRequest('http://localhost/api/programs', {
        method: 'POST',
        body: JSON.stringify({
          name: '', // Invalid: empty name
          sourceType: 'yonote',
        }),
      })

      const response = await createProgram(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid')
    })

    it('should require authentication', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: 'No user' })

      const request = new NextRequest('http://localhost/api/programs', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Program',
          sourceType: 'yonote',
          rootUrl: 'https://yonote.ru/course/123',
        }),
      })

      const response = await createProgram(request)
      expect(response.status).toBe(401)
    })
  })

  describe('GET /api/programs', () => {
    it('should list user programs', async () => {
      const mockPrograms = [
        {
          id: 'prog-1',
          name: 'Program 1',
          source_type: 'yonote',
          last_run: { status: 'completed', processed: 10, succeeded: 9, failed: 1 },
        },
        {
          id: 'prog-2',
          name: 'Program 2',
          source_type: 'yonote',
          last_run: null,
        },
      ]

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockPrograms, error: null }),
      })

      const request = new NextRequest('http://localhost/api/programs')
      const response = await getPrograms(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.programs).toHaveLength(2)
      expect(mockSupabase.from).toHaveBeenCalledWith('programs')
    })
  })

  describe('POST /api/programs/[id]/enumerate', () => {
    it('should enumerate lessons from source', async () => {
      // Mock program fetch
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'programs') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'prog-123',
                source_type: 'yonote',
                root_url: 'https://yonote.ru/course/123',
                credential_id: 'cred-123',
              },
              error: null,
            }),
          }
        }
        if (table === 'external_credentials') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'cred-123',
                cookie_encrypted: 'encrypted-cookie',
              },
              error: null,
            }),
          }
        }
        if (table === 'program_lessons') {
          return {
            upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
          }
        }
        return null
      })

      const request = new NextRequest('http://localhost/api/programs/prog-123/enumerate', {
        method: 'POST',
      })

      const response = await enumerateLessons(request, { params: Promise.resolve({ id: 'prog-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.lessons).toHaveLength(2)
      expect(data.lessons[0].title).toBe('Test Lesson 1')
    })

    it('should handle authentication errors', async () => {
      const { ScraperService } = require('@/src/services/ScraperService')
      ScraperService.getAdapter.mockReturnValue({
        validate: jest.fn().mockResolvedValue({ ok: true }),
        enumerateLessons: jest.fn().mockRejectedValue(new Error('401: Authentication failed')),
      })

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'programs') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'prog-123',
                source_type: 'yonote',
                root_url: 'https://yonote.ru/course/123',
                credential_id: 'cred-123',
              },
              error: null,
            }),
          }
        }
        if (table === 'external_credentials') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'cred-123',
                cookie_encrypted: 'encrypted-cookie',
              },
              error: null,
            }),
          }
        }
        return null
      })

      const request = new NextRequest('http://localhost/api/programs/prog-123/enumerate', {
        method: 'POST',
      })

      const response = await enumerateLessons(request, { params: Promise.resolve({ id: 'prog-123' }) })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toContain('Authentication')
    })
  })

  describe('POST /api/programs/[id]/runs', () => {
    it('should create a new run with jobs', async () => {
      // Mock queries
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'programs') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { id: 'prog-123', user_id: mockUser.id },
              error: null,
            }),
          }
        }
        if (table === 'program_lessons') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({
              data: [
                { id: 'lesson-1', title: 'Lesson 1', content_hash: null },
                { id: 'lesson-2', title: 'Lesson 2', content_hash: 'existing-hash' },
              ],
              error: null,
            }),
          }
        }
        if (table === 'program_runs') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            in: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue({ data: [], error: null }),
            insert: jest.fn().mockResolvedValue({ data: null, error: null }),
            update: jest.fn().mockReturnThis(),
          }
        }
        if (table === 'analyses') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue({ data: [], error: null }),
          }
        }
        if (table === 'analysis_jobs') {
          return {
            insert: jest.fn().mockResolvedValue({ data: null, error: null }),
          }
        }
        return null
      })

      const request = new NextRequest('http://localhost/api/programs/prog-123/runs', {
        method: 'POST',
        body: JSON.stringify({
          metricsMode: 'lx',
          maxConcurrency: 3,
        }),
      })

      const response = await createRun(request, { params: Promise.resolve({ id: 'prog-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.run).toBeDefined()
      expect(data.run.programId).toBe('prog-123')
      expect(data.run.metricsMode).toBe('lx')
    })

    it('should prevent duplicate active runs', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'programs') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { id: 'prog-123', user_id: mockUser.id },
              error: null,
            }),
          }
        }
        if (table === 'program_lessons') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({
              data: [{ id: 'lesson-1', title: 'Lesson 1' }],
              error: null,
            }),
          }
        }
        if (table === 'program_runs') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            in: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue({
              data: [{ id: 'existing-run', status: 'running' }],
              error: null,
            }),
          }
        }
        return null
      })

      const request = new NextRequest('http://localhost/api/programs/prog-123/runs', {
        method: 'POST',
        body: JSON.stringify({
          metricsMode: 'lx',
        }),
      })

      const response = await createRun(request, { params: Promise.resolve({ id: 'prog-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('active run already exists')
    })
  })

  describe('Run Control Endpoints', () => {
    const mockRun = {
      id: 'run-123',
      program_run_id: 'run-123',
      status: 'running',
      program: { user_id: mockUser.id },
    }

    beforeEach(() => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'program_runs') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockRun, error: null }),
            update: jest.fn().mockReturnThis(),
          }
        }
        if (table === 'analysis_jobs') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            update: jest.fn().mockReturnThis(),
          }
        }
        return null
      })
    })

    it('should pause a running run', async () => {
      const request = new NextRequest('http://localhost/api/program-runs/run-123/pause', {
        method: 'POST',
      })

      const response = await pauseRun(request, { params: Promise.resolve({ id: 'run-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBe('paused')
    })

    it('should resume a paused run', async () => {
      mockRun.status = 'paused'

      const request = new NextRequest('http://localhost/api/program-runs/run-123/resume', {
        method: 'POST',
      })

      const response = await resumeRun(request, { params: Promise.resolve({ id: 'run-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBe('running')
    })

    it('should stop a run and cancel jobs', async () => {
      const request = new NextRequest('http://localhost/api/program-runs/run-123/stop', {
        method: 'POST',
      })

      const response = await stopRun(request, { params: Promise.resolve({ id: 'run-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBe('stopped')
    })

    it('should get run status with progress', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'program_runs') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                ...mockRun,
                total_lessons: 10,
                program: { id: 'prog-123', name: 'Test Program', user_id: mockUser.id },
              },
              error: null,
            }),
          }
        }
        if (table === 'analysis_jobs') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({
              data: [
                { status: 'succeeded', lesson_id: 'l1' },
                { status: 'succeeded', lesson_id: 'l2' },
                { status: 'failed', lesson_id: 'l3' },
                { status: 'queued', lesson_id: 'l4' },
              ],
              error: null,
            }),
            limit: jest.fn().mockResolvedValue({ data: [], error: null }),
          }
        }
        return null
      })

      const request = new NextRequest('http://localhost/api/program-runs/run-123/status')
      const response = await getRunStatus(request, { params: Promise.resolve({ id: 'run-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.progress.succeeded).toBe(2)
      expect(data.progress.failed).toBe(1)
      expect(data.progress.queued).toBe(1)
      expect(data.progress.percentage).toBe(30) // 3 completed out of 10
    })
  })
})