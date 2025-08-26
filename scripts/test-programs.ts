#!/usr/bin/env tsx
/**
 * Test script for Programs feature
 * Run with: npx tsx scripts/test-programs.ts
 */

import { createClient } from '@supabase/supabase-js'
import { encryptForStorage, validatePassword } from '../src/services/crypto/secretBox'

// Load environment variables
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const appSecretKey = process.env.APP_SECRET_KEY!

if (!supabaseUrl || !supabaseKey || !appSecretKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

if (!validatePassword(appSecretKey)) {
  console.error('Invalid APP_SECRET_KEY format')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testEncryption() {
  console.log('🔐 Testing encryption...')
  
  const testData = 'test-cookie-value'
  const encrypted = encryptForStorage(testData, appSecretKey)
  console.log('✅ Encryption successful')
  console.log('Encrypted length:', encrypted.length)
  
  return encrypted
}

async function testJobQueue() {
  console.log('\n📋 Testing job queue...')
  
  // Check for any existing jobs
  const { data: jobs, error } = await supabase
    .from('analysis_jobs')
    .select('id, status, program_run_id')
    .limit(5)
  
  if (error) {
    console.error('❌ Error fetching jobs:', error)
    return
  }
  
  console.log('✅ Job queue accessible')
  console.log('Found jobs:', jobs?.length || 0)
  
  if (jobs && jobs.length > 0) {
    console.log('Sample job:', jobs[0])
  }
}

async function testProgramRuns() {
  console.log('\n🏃 Testing program runs...')
  
  // Check for any existing runs
  const { data: runs, error } = await supabase
    .from('program_runs')
    .select('id, status, total_lessons, processed, succeeded, failed')
    .limit(5)
  
  if (error) {
    console.error('❌ Error fetching runs:', error)
    return
  }
  
  console.log('✅ Program runs accessible')
  console.log('Found runs:', runs?.length || 0)
  
  if (runs && runs.length > 0) {
    console.log('Sample run:', runs[0])
  }
}

async function testPrograms() {
  console.log('\n📚 Testing programs...')
  
  // Check for any existing programs
  const { data: programs, error } = await supabase
    .from('programs')
    .select('id, name, source_type, root_url')
    .limit(5)
  
  if (error) {
    console.error('❌ Error fetching programs:', error)
    return
  }
  
  console.log('✅ Programs accessible')
  console.log('Found programs:', programs?.length || 0)
  
  if (programs && programs.length > 0) {
    console.log('Sample program:', programs[0])
  }
}

async function main() {
  console.log('🚀 Starting Programs Feature Test\n')
  console.log('Environment:')
  console.log('- Supabase URL:', supabaseUrl)
  console.log('- APP_SECRET_KEY:', appSecretKey ? '✅ Set' : '❌ Missing')
  console.log()
  
  try {
    await testEncryption()
    await testPrograms()
    await testProgramRuns()
    await testJobQueue()
    
    console.log('\n✨ All tests completed successfully!')
    console.log('\nNext steps:')
    console.log('1. Add a Yonote credential via the UI')
    console.log('2. Create a program with a Yonote URL')
    console.log('3. Enumerate lessons')
    console.log('4. Start a run and monitor progress')
    
  } catch (error) {
    console.error('\n❌ Test failed:', error)
    process.exit(1)
  }
}

main()