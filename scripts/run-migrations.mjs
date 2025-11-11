#!/usr/bin/env node

/**
 * Run database migrations for batch upload feature
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌')
  console.error('SUPABASE_SERVICE_KEY:', supabaseServiceKey ? '✅' : '❌')
  process.exit(1)
}

// Create admin client
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

console.log('🔧 Running Database Migrations...\n')

async function runMigration(fileName, description) {
  console.log(`📄 ${description}`)
  console.log(`   File: ${fileName}`)
  
  try {
    const migrationPath = join(__dirname, '..', 'migrations', fileName)
    const sql = readFileSync(migrationPath, 'utf-8')
    
    // Execute migration SQL
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql })
    
    if (error) {
      // If exec_sql RPC doesn't exist, try direct query
      console.log('   Using direct SQL execution...')
      const { error: directError } = await supabase.from('_migrations').insert({
        name: fileName,
        executed_at: new Date().toISOString()
      })
      
      if (directError && !directError.message.includes('does not exist')) {
        throw directError
      }
      
      console.log('   ⚠️  Migration SQL needs to be run manually in Supabase Dashboard')
      console.log(`   📋 Copy SQL from: migrations/${fileName}`)
      console.log(`   🔗 Dashboard: ${supabaseUrl.replace('.supabase.co', '.supabase.co/project')}/sql`)
      return false
    }
    
    console.log('   ✅ Migration completed\n')
    return true
  } catch (err) {
    console.error('   ❌ Error:', err.message)
    console.log(`   📋 Run manually: migrations/${fileName}\n`)
    return false
  }
}

async function checkTables() {
  console.log('🔍 Checking existing tables...\n')
  
  const tables = ['programs', 'program_lessons', 'program_runs', 'analysis_jobs', 'external_credentials']
  
  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('id')
      .limit(1)
    
    if (error) {
      console.log(`   ❌ ${table}: NOT EXISTS`)
    } else {
      console.log(`   ✅ ${table}: EXISTS`)
    }
  }
  console.log('')
}

async function main() {
  // Check current state
  await checkTables()
  
  console.log('═══════════════════════════════════════\n')
  
  // Run migrations
  const migrations = [
    {
      file: '20250122_programs_batch_analyzer.sql',
      description: 'Batch Upload Schema (programs, lessons, runs, jobs)'
    },
    {
      file: '20250127_atomic_job_locking.sql', 
      description: 'Atomic Job Locking'
    },
    {
      file: '20250128_add_session_tracking.sql',
      description: 'Session Tracking'
    }
  ]
  
  let allSuccess = true
  for (const migration of migrations) {
    const success = await runMigration(migration.file, migration.description)
    if (!success) allSuccess = false
  }
  
  console.log('═══════════════════════════════════════\n')
  
  if (!allSuccess) {
    console.log('⚠️  MANUAL MIGRATION REQUIRED:\n')
    console.log('1. Open Supabase Dashboard SQL Editor:')
    console.log(`   ${supabaseUrl.replace('https://', 'https://app.supabase.com/project/')}`)
    console.log('')
    console.log('2. Copy and execute each migration file:')
    console.log('   - migrations/20250122_programs_batch_analyzer.sql')
    console.log('   - migrations/20250127_atomic_job_locking.sql')
    console.log('   - migrations/20250128_add_session_tracking.sql')
    console.log('')
    console.log('3. After running migrations, restart dev server')
    console.log('')
  } else {
    console.log('✅ All migrations completed successfully!')
    console.log('   Restart dev server to see changes')
  }
  
  // Check tables again
  console.log('═══════════════════════════════════════\n')
  await checkTables()
}

main().catch(console.error)
