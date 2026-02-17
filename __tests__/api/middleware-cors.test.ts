import { NextRequest } from 'next/server'
import { middleware } from '@/middleware'

const mockCreateServerClient = jest.fn()
const mockGetSession = jest.fn()
const mockGetUser = jest.fn()

jest.mock('@supabase/ssr', () => ({
  createServerClient: (...args: unknown[]) => mockCreateServerClient(...args),
}))

describe('Security - CORS middleware', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    jest.clearAllMocks()

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com'
    process.env.NODE_ENV = 'production'

    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    mockCreateServerClient.mockReturnValue({
      auth: {
        getSession: mockGetSession,
        getUser: mockGetUser,
      },
    })
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('rejects preflight from untrusted origin', async () => {
    const request = new NextRequest('http://localhost:3000/api/health', {
      method: 'OPTIONS',
      headers: {
        origin: 'https://evil.example',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    })

    const response = await middleware(request)
    expect(response.status).toBe(403)
  })

  it('allows preflight from trusted origin', async () => {
    const request = new NextRequest('http://localhost:3000/api/health', {
      method: 'OPTIONS',
      headers: {
        origin: 'https://app.example.com',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    })

    const response = await middleware(request)
    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.com')
  })

  it('rejects non-preflight request from untrusted origin', async () => {
    const request = new NextRequest('http://localhost:3000/api/health', {
      method: 'GET',
      headers: {
        origin: 'https://evil.example',
      },
    })

    const response = await middleware(request)
    expect(response.status).toBe(403)
  })
})
