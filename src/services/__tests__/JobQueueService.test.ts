/**
 * Unit tests for JobQueueService
 */

import { JobQueueService, AnalysisJob, ProgramRun } from '../JobQueueService'
import { SupabaseClient } from '@supabase/supabase-js'

// Mock Supabase client
const mockSupabase = {
  from: jest.fn(),
} as unknown as SupabaseClient

describe('JobQueueService', () => {
  let service: JobQueueService
  const workerId = 'test-worker-123'
  
  beforeEach(() => {
    jest.clearAllMocks()
    service = new JobQueueService(mockSupabase, workerId)
  })

  describe('pickJob', () => {
    it('should pick and lock an available job', async () => {
      const mockJob: AnalysisJob = {
        id: 'job-1',
        program_run_id: 'run-1',
        program_id: 'prog-1',
        lesson_id: 'lesson-1',
        status: 'queued',
        attempt_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const mockQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockJob, error: null }),
      }

      ;(mockSupabase.from as jest.Mock).mockReturnValue(mockQuery)

      const job = await service.pickJob()

      expect(job).toEqual(mockJob)
      expect(mockSupabase.from).toHaveBeenCalledWith('analysis_jobs')
      expect(mockQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'running',
          locked_by: workerId,
        })
      )
      expect(mockQuery.eq).toHaveBeenCalledWith('status', 'queued')
    })

    it('should filter by runId when specified', async () => {
      const mockQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      }

      ;(mockSupabase.from as jest.Mock).mockReturnValue(mockQuery)

      const job = await service.pickJob('specific-run-id')

      expect(job).toBeNull()
      expect(mockQuery.eq).toHaveBeenCalledWith('program_run_id', 'specific-run-id')
    })

    it('should return null when no jobs available', async () => {
      const mockQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      }

      ;(mockSupabase.from as jest.Mock).mockReturnValue(mockQuery)

      const job = await service.pickJob()
      expect(job).toBeNull()
    })

    it('should handle TTL expiry check', async () => {
      const mockQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      }

      ;(mockSupabase.from as jest.Mock).mockReturnValue(mockQuery)

      await service.pickJob()

      // Should include TTL check in the or clause
      expect(mockQuery.or).toHaveBeenCalledWith(
        expect.stringContaining('locked_at.is.null,locked_at.lt.')
      )
    })
  })

  describe('updateJobStatus', () => {
    it('should update job to succeeded status', async () => {
      const mockJob = {
        id: 'job-1',
        program_run_id: 'run-1',
        attempt_count: 0,
      }

      const selectQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockJob, error: null }),
      }

      const updateQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
      }

      ;(mockSupabase.from as jest.Mock)
        .mockReturnValueOnce(selectQuery)
        .mockReturnValueOnce(updateQuery)
        .mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ data: [], error: null }),
        })

      await service.updateJobStatus('job-1', 'succeeded')

      expect(updateQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'succeeded',
          locked_by: null,
          locked_at: null,
        })
      )
    })

    it('should handle retry logic for failed jobs', async () => {
      const mockJob = {
        id: 'job-1',
        program_run_id: 'run-1',
        attempt_count: 1, // First retry
      }

      const selectQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockJob, error: null }),
      }

      const updateQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
      }

      ;(mockSupabase.from as jest.Mock)
        .mockReturnValueOnce(selectQuery)
        .mockReturnValueOnce(updateQuery)
        .mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ data: [], error: null }),
        })

      await service.updateJobStatus('job-1', 'failed', 'Test error')

      expect(updateQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'queued', // Should requeue
          attempt_count: 2,
          last_error: 'Test error',
        })
      )
    })

    it('should mark as permanently failed after max retries', async () => {
      const mockJob = {
        id: 'job-1',
        program_run_id: 'run-1',
        attempt_count: 3, // Max retries reached
      }

      const selectQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockJob, error: null }),
      }

      const updateQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
      }

      ;(mockSupabase.from as jest.Mock)
        .mockReturnValueOnce(selectQuery)
        .mockReturnValueOnce(updateQuery)
        .mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ data: [], error: null }),
        })

      await service.updateJobStatus('job-1', 'failed', 'Final error')

      expect(updateQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed', // Should stay failed
          last_error: 'Final error',
        })
      )
    })

    it('should throw error for non-existent job', async () => {
      const selectQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: 'Not found' }),
      }

      ;(mockSupabase.from as jest.Mock).mockReturnValue(selectQuery)

      await expect(
        service.updateJobStatus('non-existent', 'succeeded')
      ).rejects.toThrow('Job non-existent not found')
    })
  })

  describe('createContentHash', () => {
    it('should create consistent hash for same content', () => {
      const text = 'This is test content with spaces   and\nnewlines'
      const hash1 = service.createContentHash(text)
      const hash2 = service.createContentHash(text)
      
      expect(hash1).toBe(hash2)
      expect(hash1).toMatch(/^[a-f0-9]{64}$/) // SHA-256 hex format
    })

    it('should normalize whitespace', () => {
      const text1 = 'Multiple   spaces    between'
      const text2 = 'Multiple spaces between'
      
      const hash1 = service.createContentHash(text1)
      const hash2 = service.createContentHash(text2)
      
      expect(hash1).toBe(hash2)
    })

    it('should be case-insensitive', () => {
      const text1 = 'UPPERCASE text'
      const text2 = 'uppercase text'
      
      const hash1 = service.createContentHash(text1)
      const hash2 = service.createContentHash(text2)
      
      expect(hash1).toBe(hash2)
    })

    it('should produce different hashes for different content', () => {
      const hash1 = service.createContentHash('Content A')
      const hash2 = service.createContentHash('Content B')
      
      expect(hash1).not.toBe(hash2)
    })
  })

  describe('checkContentHash', () => {
    it('should return true if matching analysis exists', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { id: 'analysis-1' }, error: null }),
      }

      ;(mockSupabase.from as jest.Mock).mockReturnValue(mockQuery)

      const result = await service.checkContentHash('lesson-1', 'hash123')
      
      expect(result).toBe(true)
      expect(mockQuery.eq).toHaveBeenCalledWith('lesson_id', 'lesson-1')
      expect(mockQuery.eq).toHaveBeenCalledWith('content_hash', 'hash123')
    })

    it('should return false if no matching analysis', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: 'Not found' }),
      }

      ;(mockSupabase.from as jest.Mock).mockReturnValue(mockQuery)

      const result = await service.checkContentHash('lesson-1', 'hash123')
      expect(result).toBe(false)
    })

    it('should check metric configuration for custom metrics', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: 'Not found' }),
      }

      ;(mockSupabase.from as jest.Mock).mockReturnValue(mockQuery)

      await service.checkContentHash('lesson-1', 'hash123', 'config-1')
      
      expect(mockQuery.eq).toHaveBeenCalledWith(
        'configuration_snapshot->id',
        'config-1'
      )
    })
  })

  describe('updateRunStatus', () => {
    it('should pause a running run', async () => {
      const updateQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
      }

      ;(mockSupabase.from as jest.Mock).mockReturnValue(updateQuery)

      await service.updateRunStatus('run-1', 'paused')

      expect(updateQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'paused',
          finished_at: null,
        })
      )
    })

    it('should stop a run and cancel queued jobs', async () => {
      const jobsQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      }
      jobsQuery.eq.mockReturnValueOnce(jobsQuery).mockResolvedValueOnce({ data: null, error: null })

      const runsQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
      }

      ;(mockSupabase.from as jest.Mock)
        .mockReturnValueOnce(jobsQuery)
        .mockReturnValueOnce(runsQuery)

      await service.updateRunStatus('run-1', 'stopped')

      expect(jobsQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          last_error: 'Run was stopped by user',
        })
      )
      expect(runsQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'stopped',
        })
      )
    })
  })

  describe('releaseStateLocks', () => {
    it('should release stale locks', async () => {
      const mockQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({ 
          data: [{ id: '1' }, { id: '2' }], 
          error: null 
        }),
      }

      ;(mockSupabase.from as jest.Mock).mockReturnValue(mockQuery)

      const count = await service.releaseStateLocks()

      expect(count).toBe(2)
      expect(mockQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'queued',
          locked_by: null,
          locked_at: null,
        })
      )
    })

    it('should handle errors gracefully', async () => {
      const mockQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({ data: null, error: 'DB error' }),
      }

      ;(mockSupabase.from as jest.Mock).mockReturnValue(mockQuery)

      const count = await service.releaseStateLocks()
      expect(count).toBe(0)
    })
  })
})