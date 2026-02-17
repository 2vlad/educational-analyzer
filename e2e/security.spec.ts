import { test, expect } from '@playwright/test'

test('debug endpoints are not publicly exposed', async ({ request }) => {
  const debugEnvResponse = await request.get('/api/debug-env')
  expect(debugEnvResponse.status()).toBe(404)

  const testEndpointResponse = await request.get('/api/test')
  expect(testEndpointResponse.status()).toBe(404)
})

test('cors blocks untrusted preflight origin', async ({ request }) => {
  const response = await request.fetch('/api/health', {
    method: 'OPTIONS',
    headers: {
      origin: 'https://evil.example',
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type',
    },
  })

  expect(response.status()).toBe(403)
})

test('cors blocks untrusted non-preflight origin', async ({ request }) => {
  const response = await request.fetch('/api/health', {
    method: 'GET',
    headers: {
      origin: 'https://evil.example',
    },
  })

  expect(response.status()).toBe(403)
})

test('cors allows trusted preflight origin', async ({ request }) => {
  const trustedOrigin = 'http://localhost:3000'
  const response = await request.fetch('/api/health', {
    method: 'OPTIONS',
    headers: {
      origin: trustedOrigin,
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type',
    },
  })

  expect(response.status()).toBe(204)
  expect(response.headers()['access-control-allow-origin']).toBe(trustedOrigin)
})
