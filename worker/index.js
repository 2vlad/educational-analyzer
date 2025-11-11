#!/usr/bin/env node

/**
 * Educational Analyzer Worker
 * Continuously processes jobs from the analysis queue
 */

import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

// Make fetch available globally for compatibility
if (!globalThis.fetch) {
  globalThis.fetch = fetch
}

const WORKER_INTERVAL = 5000 // 5 seconds
const WORKER_ID = `railway-worker-${process.pid}`

// Configuration
const config = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  appSecretKey: process.env.APP_SECRET_KEY,
  apiUrl: process.env.API_URL || 'http://localhost:3000',
}

// Validate configuration
function validateConfig() {
  const missing = []
  if (!config.supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!config.supabaseKey) missing.push('SUPABASE_SERVICE_ROLE_KEY')
  if (!config.appSecretKey) missing.push('APP_SECRET_KEY')
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '))
    process.exit(1)
  }
}

// Create Supabase client
function createServiceClient() {
  return createClient(config.supabaseUrl, config.supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// Process jobs by calling the API endpoint
async function processJobs() {
  try {
    const endpoint = `${config.apiUrl}/api/worker/tick`
    
    console.log(`[${new Date().toISOString()}] Calling worker endpoint: ${endpoint}`)
    
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.appSecretKey}`,
        'Content-Type': 'application/json',
        'User-Agent': `Railway-Worker/${WORKER_ID}`
      }
    })
    
    const data = await response.json()
    
    if (!response.ok) {
      console.error(`❌ Worker API error (${response.status}):`, data)
      return
    }
    
    // Log result
    if (data.processed) {
      console.log(`✅ Processed job:`, {
        jobId: data.jobId,
        lessonTitle: data.lessonTitle,
        status: data.status,
        duration: data.processingTime
      })
    } else if (data.message === 'No jobs available') {
      // Silently skip - no jobs in queue
      process.stdout.write('.')
    } else {
      console.log(`ℹ️  ${data.message || 'No action taken'}`)
    }
    
  } catch (error) {
    console.error('❌ Worker error:', error.message)
    // Don't crash, continue processing
  }
}

// Main worker loop
async function startWorker() {
  console.log('🚀 Educational Analyzer Worker Starting...')
  console.log(`Worker ID: ${WORKER_ID}`)
  console.log(`API URL: ${config.apiUrl}`)
  console.log(`Interval: ${WORKER_INTERVAL}ms`)
  console.log('---')
  
  validateConfig()
  
  console.log('✅ Configuration validated')
  console.log('✅ Worker started successfully')
  console.log('📊 Polling for jobs...\n')
  
  // Process jobs continuously
  setInterval(async () => {
    await processJobs()
  }, WORKER_INTERVAL)
  
  // Process first job immediately
  await processJobs()
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...')
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...')
  process.exit(0)
})

// Start the worker
startWorker().catch(error => {
  console.error('💥 Fatal error:', error)
  process.exit(1)
})
