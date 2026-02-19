#!/usr/bin/env node

/**
 * Generate all secrets needed for Supabase self-hosted deployment.
 *
 * Usage: node generate-keys.mjs
 *
 * Outputs:
 * - JWT_SECRET
 * - POSTGRES_PASSWORD
 * - DASHBOARD_PASSWORD
 * - ANON_KEY (JWT signed with anon role)
 * - SERVICE_ROLE_KEY (JWT signed with service_role)
 */

import crypto from 'node:crypto'

// --- Helper: base64url encode ---
function base64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

// --- Helper: HMAC-SHA256 sign ---
function hmacSign(input, secret) {
  return base64url(
    crypto.createHmac('sha256', secret).update(input).digest()
  )
}

// --- Helper: Create JWT ---
function createJWT(payload, secret) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = base64url(JSON.stringify(payload))
  const signature = hmacSign(`${header}.${body}`, secret)
  return `${header}.${body}.${signature}`
}

// --- Generate secrets ---
const jwtSecret = crypto.randomBytes(64).toString('base64')
const postgresPassword = crypto.randomBytes(32).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 32)
const dashboardPassword = crypto.randomBytes(24).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)

// JWT expiry: 10 years from now
const exp = Math.floor(Date.now() / 1000) + (10 * 365 * 24 * 60 * 60)
const iat = Math.floor(Date.now() / 1000)

const anonKey = createJWT(
  { role: 'anon', iss: 'supabase', iat, exp },
  jwtSecret
)

const serviceRoleKey = createJWT(
  { role: 'service_role', iss: 'supabase', iat, exp },
  jwtSecret
)

// --- Output ---
console.log('=== Supabase Self-Hosted Secrets ===')
console.log('')
console.log('Copy these into your supabase/docker/.env file:')
console.log('')
console.log(`JWT_SECRET=${jwtSecret}`)
console.log(`POSTGRES_PASSWORD=${postgresPassword}`)
console.log(`DASHBOARD_USERNAME=admin`)
console.log(`DASHBOARD_PASSWORD=${dashboardPassword}`)
console.log('')
console.log(`ANON_KEY=${anonKey}`)
console.log(`SERVICE_ROLE_KEY=${serviceRoleKey}`)
console.log('')
console.log('=== For Vercel Environment Variables ===')
console.log('')
console.log(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey}`)
console.log(`SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}`)
console.log('')
console.log('IMPORTANT: Store these secrets securely. Do not commit them to git.')
