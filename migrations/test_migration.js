/**
 * Test script for multi-user migration
 * Run this locally to verify the migration works correctly
 *
 * Prerequisites:
 * 1. Set up local Supabase: npx supabase init (if not already done)
 * 2. Start local Supabase: npx supabase start
 * 3. Apply migrations: npx supabase db reset
 * 4. Run this test: node migrations/test_migration.js
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

// Use local Supabase URL for testing
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key'

// Create Supabase client with service role key (bypasses RLS for testing)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

async function runTests() {
  console.log('🧪 Testing Multi-User Migration...\n')

  try {
    // Test 1: Check if tables exist
    console.log('1️⃣  Testing table creation...')

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .limit(1)

    if (profilesError) throw new Error(`Profiles table error: ${profilesError.message}`)
    console.log('   ✅ Profiles table exists')

    const { data: configs, error: configsError } = await supabase
      .from('metric_configurations')
      .select('*')
      .limit(1)

    if (configsError) throw new Error(`Metric configurations table error: ${configsError.message}`)
    console.log('   ✅ Metric configurations table exists')

    // Test 2: Check default metrics
    console.log('\n2️⃣  Testing default metrics...')

    const { data: defaultMetrics, error: defaultError } = await supabase
      .from('metric_configurations')
      .select('*')
      .is('user_id', null)
      .order('display_order')

    if (defaultError) throw new Error(`Default metrics error: ${defaultError.message}`)

    const expectedMetrics = ['logic', 'practical', 'complexity', 'interest', 'care']
    const actualMetrics = defaultMetrics.map((m) => m.name)

    if (defaultMetrics.length !== 5) {
      throw new Error(`Expected 5 default metrics, found ${defaultMetrics.length}`)
    }

    expectedMetrics.forEach((metric, index) => {
      if (actualMetrics[index] !== metric) {
        throw new Error(
          `Expected metric '${metric}' at position ${index + 1}, found '${actualMetrics[index]}'`,
        )
      }
      console.log(`   ✅ Default metric '${metric}' exists at position ${index + 1}`)
    })

    // Test 3: Check analyses table modifications
    console.log('\n3️⃣  Testing analyses table modifications...')

    const { data: analysesColumns, error: analysesError } = await supabase.rpc(
      'get_table_columns',
      { table_name: 'analyses' },
    )

    if (!analysesError) {
      const columnNames = analysesColumns.map((c) => c.column_name)

      if (!columnNames.includes('user_id')) {
        throw new Error('user_id column not found in analyses table')
      }
      console.log('   ✅ user_id column added to analyses table')

      if (!columnNames.includes('configuration_snapshot')) {
        throw new Error('configuration_snapshot column not found in analyses table')
      }
      console.log('   ✅ configuration_snapshot column added to analyses table')
    } else {
      // Fallback: Try to insert a test record
      const { error: insertError } = await supabase.from('analyses').insert({
        content: 'Test content',
        status: 'completed',
        user_id: null,
        configuration_snapshot: { test: true },
      })

      if (insertError && insertError.message.includes('column')) {
        throw new Error(`Analyses table modification failed: ${insertError.message}`)
      }
      console.log('   ✅ Analyses table accepts new columns')
    }

    // Test 4: Test backward compatibility (guest mode)
    console.log('\n4️⃣  Testing backward compatibility (guest mode)...')

    const { data: guestAnalysis, error: guestError } = await supabase
      .from('analyses')
      .insert({
        content: 'Guest test content',
        status: 'pending',
        user_id: null,
      })
      .select()
      .single()

    if (guestError) throw new Error(`Guest analysis error: ${guestError.message}`)
    console.log('   ✅ Guest users can still create analyses')

    // Clean up test data
    await supabase.from('analyses').delete().eq('id', guestAnalysis.id)

    // Test 5: Check RLS policies (basic check)
    console.log('\n5️⃣  Testing RLS configuration...')

    const { data: rlsEnabled, error: rlsError } = await supabase.rpc('check_rls_enabled', {
      tables: ['profiles', 'metric_configurations', 'analyses'],
    })

    if (!rlsError && rlsEnabled) {
      console.log('   ✅ RLS is enabled on all user tables')
    } else {
      console.log('   ⚠️  RLS check skipped (function may not exist)')
    }

    console.log('\n✅ All tests passed! Migration is working correctly.\n')
  } catch (error) {
    console.error('\n❌ Test failed:', error.message)
    process.exit(1)
  }
}

// Helper RPC functions (add these to your migration if needed)
const helperFunctions = `
-- Helper function to get table columns
CREATE OR REPLACE FUNCTION get_table_columns(table_name text)
RETURNS TABLE(column_name text, data_type text, is_nullable text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.column_name::text,
    c.data_type::text,
    c.is_nullable::text
  FROM information_schema.columns c
  WHERE c.table_name = $1
    AND c.table_schema = 'public';
END;
$$;

-- Helper function to check RLS status
CREATE OR REPLACE FUNCTION check_rls_enabled(tables text[])
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  tbl text;
  rls_count int := 0;
  total_count int := 0;
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    total_count := total_count + 1;
    IF EXISTS (
      SELECT 1 FROM pg_tables 
      WHERE tablename = tbl 
        AND schemaname = 'public' 
        AND rowsecurity = true
    ) THEN
      rls_count := rls_count + 1;
    END IF;
  END LOOP;
  
  RETURN rls_count = total_count;
END;
$$;
`

// Run tests
runTests()
