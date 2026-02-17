import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

const DEFAULT_CORS_HEADERS = 'Content-Type, Authorization, X-Session-Id'
const DEFAULT_CORS_METHODS = 'GET, POST, OPTIONS'

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/$/, '')
}

function getAllowedOrigins(): Set<string> {
  const origins = new Set<string>()
  const configuredOrigins = process.env.CORS_ALLOWED_ORIGINS

  if (configuredOrigins) {
    configuredOrigins
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
      .forEach((origin) => origins.add(normalizeOrigin(origin)))
  }

  if (process.env.NEXT_PUBLIC_APP_URL) {
    origins.add(normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL))
  }

  if (process.env.NODE_ENV !== 'production') {
    origins.add('http://localhost:3000')
    origins.add('http://127.0.0.1:3000')
  }

  return origins
}

function applyCorsHeaders(response: NextResponse, origin: string, requestHeaders?: string | null) {
  response.headers.set('Access-Control-Allow-Origin', origin)
  response.headers.set('Access-Control-Allow-Methods', DEFAULT_CORS_METHODS)
  response.headers.set('Access-Control-Allow-Headers', requestHeaders || DEFAULT_CORS_HEADERS)
  response.headers.set('Vary', 'Origin')
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const path = request.nextUrl.pathname

  // Handle API route CORS with explicit allow-list
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin')
    const allowedOrigins = getAllowedOrigins()
    const normalizedOrigin = origin ? normalizeOrigin(origin) : null
    const isAllowedOrigin = normalizedOrigin ? allowedOrigins.has(normalizedOrigin) : false

    if (request.method === 'OPTIONS') {
      if (!normalizedOrigin || !isAllowedOrigin) {
        return NextResponse.json({ error: 'CORS origin denied' }, { status: 403 })
      }

      const preflight = new NextResponse(null, { status: 204 })
      applyCorsHeaders(
        preflight,
        normalizedOrigin,
        request.headers.get('access-control-request-headers'),
      )
      return preflight
    }

    if (normalizedOrigin && !isAllowedOrigin) {
      return NextResponse.json({ error: 'CORS origin denied' }, { status: 403 })
    }

    if (normalizedOrigin && isAllowedOrigin) {
      applyCorsHeaders(response, normalizedOrigin)
    }

    // Get client IP for rate limiting
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown'

    // Add IP header for API routes to use
    response.headers.set('x-client-ip', ip)
  }

  // Create Supabase client for middleware
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    },
  )

  // Refresh session if expired
  await supabase.auth.getSession()

  // Protected routes that require authentication
  const protectedPaths = [
    '/dashboard',
    '/settings',
    '/history',
    '/programs',
    '/api/user',
    '/api/configuration',
    '/api/programs',
    '/api/program-runs',
  ]

  const isProtectedPath = protectedPaths.some((p) => path.startsWith(p))

  if (isProtectedPath) {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      // Redirect to login page for web routes
      if (!path.startsWith('/api/')) {
        // eslint-disable-next-line no-undef
        return NextResponse.redirect(new URL('/login', request.url))
      }
      // Return 401 for protected API routes
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
