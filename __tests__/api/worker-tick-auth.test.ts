import { NextRequest } from 'next/server'
import { GET as workerTick } from '@/app/api/worker/tick/route'

const mockSupabaseJsCreateClient = jest.fn()
const MockJobRunner = jest.fn()
const mockCleanupStaleLocks = jest.fn()
const mockProcessTick = jest.fn()

jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockSupabaseJsCreateClient(...args),
}))

jest.mock('@/src/services/JobRunner', () => ({
  JobRunner: MockJobRunner,
}))

function createSupabaseClientMock(activeRuns: Array<{ id: string; max_concurrency: number }> = []) {
  return {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ data: activeRuns, error: null }),
    }),
  }
}

describe('Security - Worker tick auth', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    jest.clearAllMocks()

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
    process.env.APP_SECRET_KEY = 'test-app-secret'
    process.env.NODE_ENV = 'production'

    mockCleanupStaleLocks.mockResolvedValue(0)
    mockProcessTick.mockResolvedValue(0)
    MockJobRunner.mockImplementation(() => ({
      cleanupStaleLocks: mockCleanupStaleLocks,
      processTick: mockProcessTick,
    }))
    mockSupabaseJsCreateClient.mockReturnValue(createSupabaseClientMock())
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('returns 500 when CRON_SECRET is missing in production', async () => {
    delete process.env.CRON_SECRET

    const request = new NextRequest('http://localhost/api/worker/tick', {
      method: 'GET',
    })

    const response = await workerTick(request)
    expect(response.status).toBe(500)
  })

  it('returns 401 when bearer token does not match CRON_SECRET', async () => {
    process.env.CRON_SECRET = 'expected-secret'

    const request = new NextRequest('http://localhost/api/worker/tick', {
      method: 'GET',
      headers: {
        authorization: 'Bearer wrong-secret',
      },
    })

    const response = await workerTick(request)
    expect(response.status).toBe(401)
  })

  it('accepts request when bearer token matches CRON_SECRET', async () => {
    process.env.CRON_SECRET = 'expected-secret'

    const request = new NextRequest('http://localhost/api/worker/tick', {
      method: 'GET',
      headers: {
        authorization: 'Bearer expected-secret',
      },
    })

    const response = await workerTick(request)
    expect(response.status).toBe(200)
    expect(mockSupabaseJsCreateClient).toHaveBeenCalled()
  })
})
