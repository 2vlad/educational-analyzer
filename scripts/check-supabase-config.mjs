#!/usr/bin/env node

/**
 * Check Supabase configuration and suggest fixes
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('🔍 Checking Supabase Configuration...\n')

// Check environment variables
console.log('📋 Environment Variables:')
console.log('  NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌')
console.log('  NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅ (length: ' + supabaseAnonKey.length + ')' : '❌')
console.log('')

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase configuration in .env.local')
  process.exit(1)
}

console.log('🌐 Supabase Project URL:')
console.log('  ', supabaseUrl)
console.log('')

// Test connection
console.log('🔌 Testing Supabase Connection...')
const supabase = createClient(supabaseUrl, supabaseAnonKey)

try {
  const { data, error } = await supabase.auth.getSession()
  
  if (error && error.message.includes('Invalid')) {
    console.log('❌ Invalid API key')
    process.exit(1)
  }
  
  console.log('✅ Connection successful')
  console.log('  Session:', data.session ? 'Active' : 'None (expected)')
  console.log('')
} catch (error) {
  console.error('❌ Connection failed:', error.message)
  process.exit(1)
}

// Check common issues
console.log('⚠️  Common Login Issues & Solutions:\n')

console.log('1️⃣ Redirect URLs not configured')
console.log('   Go to Supabase Dashboard → Authentication → URL Configuration')
console.log('   Add these URLs to "Redirect URLs":')
console.log('   ✓ http://localhost:3000/**')
console.log('   ✓ http://localhost:3001/**')
console.log('   ✓ https://educational-analyzer.vercel.app/**')
console.log('   ✓ https://*.vercel.app/**')
console.log('')

console.log('2️⃣ Email confirmation required')
console.log('   Go to Supabase Dashboard → Authentication → Settings')
console.log('   Check "Enable email confirmations" setting')
console.log('   For testing: Use scripts/create-test-user.mjs (auto-confirms)')
console.log('')

console.log('3️⃣ Site URL not set')
console.log('   Go to Supabase Dashboard → Authentication → URL Configuration')
console.log('   Set "Site URL" to: http://localhost:3001')
console.log('   (or your primary domain)')
console.log('')

console.log('4️⃣ Rate limiting')
console.log('   Too many failed login attempts can trigger rate limiting')
console.log('   Wait 60 seconds or check Supabase Dashboard → Logs')
console.log('')

console.log('📖 Dashboard URL:')
console.log('   https://app.supabase.com/project/' + supabaseUrl.split('//')[1].split('.')[0])
console.log('')

console.log('✅ Configuration check complete!')
console.log('   If login still fails, check browser console for errors')
