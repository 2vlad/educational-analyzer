import { NextRequest } from 'next/server'
import { GET as getAnalysis } from '@/app/api/analysis/[id]/route'
import { GET as getProgress } from '@/app/api/progress/[id]/route'

const mockCreateClient = jest.fn()
const mockFrom = jest.fn()
const mockGetProgressFromDb = jest.fn()

jest.mock('@/src/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

jest.mock('@/src/lib/supabaseServer', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

jest.mock('@/src/services/ProgressService', () => ({
  progressService: {
    getProgressFromDb: (...args: unknown[]) => mockGetProgressFromDb(...args),
  },
}))

function createAccessQuerySingleResult(result: { data: unknown; error: unknown }) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
  }
}

describe('Security - IDOR protection', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('blocks guest access to /api/analysis/[id] without session id', async () => {
    const analysisQuery = createAccessQuerySingleResult({
      data: null,
      error: { message: 'Not found' },
    })

    mockFrom.mockReturnValue(analysisQuery)
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
      },
    })

    const request = new NextRequest(
      'http://localhost/api/analysis/00000000-0000-0000-0000-000000000001',
    )
    const response = await getAnalysis(request, {
      params: Promise.resolve({ id: '00000000-0000-0000-0000-000000000001' }),
    })

    expect(response.status).toBe(401)
  })

  it('filters guest analysis access by session_id', async () => {
    const analysisQuery = createAccessQuerySingleResult({
      data: null,
      error: { message: 'Not found' },
    })

    mockFrom.mockReturnValue(analysisQuery)
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
      },
    })

    const request = new NextRequest(
      'http://localhost/api/analysis/00000000-0000-0000-0000-000000000002',
      {
        headers: {
          'x-session-id': 'guest-session-1',
        },
      },
    )

    const response = await getAnalysis(request, {
      params: Promise.resolve({ id: '00000000-0000-0000-0000-000000000002' }),
    })

    expect(response.status).toBe(404)
    expect(analysisQuery.is).toHaveBeenCalledWith('user_id', null)
    expect(analysisQuery.eq).toHaveBeenCalledWith('session_id', 'guest-session-1')
  })

  it('blocks guest access to /api/progress/[id] without session id', async () => {
    const accessQuery = createAccessQuerySingleResult({
      data: null,
      error: { message: 'Not found' },
    })

    mockFrom.mockReturnValue(accessQuery)
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
      },
    })

    const request = new NextRequest(
      'http://localhost/api/progress/00000000-0000-0000-0000-000000000003',
    )
    const response = await getProgress(request, {
      params: Promise.resolve({ id: '00000000-0000-0000-0000-000000000003' }),
    })

    expect(response.status).toBe(401)
    expect(mockGetProgressFromDb).not.toHaveBeenCalled()
  })

  it('filters guest progress access by session_id', async () => {
    const accessQuery = createAccessQuerySingleResult({
      data: null,
      error: { message: 'Not found' },
    })

    mockFrom.mockReturnValue(accessQuery)
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
      },
    })

    const request = new NextRequest(
      'http://localhost/api/progress/00000000-0000-0000-0000-000000000004',
      {
        headers: {
          'x-session-id': 'guest-session-2',
        },
      },
    )

    const response = await getProgress(request, {
      params: Promise.resolve({ id: '00000000-0000-0000-0000-000000000004' }),
    })

    expect(response.status).toBe(404)
    expect(accessQuery.is).toHaveBeenCalledWith('user_id', null)
    expect(accessQuery.eq).toHaveBeenCalledWith('session_id', 'guest-session-2')
  })
})
