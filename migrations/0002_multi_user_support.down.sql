-- Rollback Migration: Remove multi-user support
-- Description: Reverts changes made in 0002_multi_user_support.sql
-- Date: 2024-08-21
-- WARNING: This will DELETE all user data! Only use in development or with proper backups.

-- ========================================
-- 1. REMOVE TRIGGERS AND FUNCTIONS
-- ========================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS get_user_metrics(UUID);

-- ========================================
-- 2. REMOVE RLS POLICIES
-- ========================================
-- Profiles policies
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

-- Metric configurations policies
DROP POLICY IF EXISTS "Anyone can read default configurations" ON metric_configurations;
DROP POLICY IF EXISTS "Users can manage their own configurations" ON metric_configurations;

-- Analyses policies
DROP POLICY IF EXISTS "Users can view their own analyses" ON analyses;
DROP POLICY IF EXISTS "Users can create their own analyses" ON analyses;
DROP POLICY IF EXISTS "Guests can create analyses without user_id" ON analyses;
DROP POLICY IF EXISTS "Guests can view their session analyses" ON analyses;

-- ========================================
-- 3. DISABLE ROW LEVEL SECURITY
-- ========================================
ALTER TABLE IF EXISTS profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS metric_configurations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS analyses DISABLE ROW LEVEL SECURITY;

-- ========================================
-- 4. REMOVE COLUMNS FROM ANALYSES TABLE
-- ========================================
ALTER TABLE analyses DROP COLUMN IF EXISTS user_id;
ALTER TABLE analyses DROP COLUMN IF EXISTS configuration_snapshot;

-- Drop related indexes
DROP INDEX IF EXISTS idx_analyses_user_id;
DROP INDEX IF EXISTS idx_analyses_user_created;

-- ========================================
-- 5. DROP TABLES
-- ========================================
-- Drop metric_configurations table and its indexes
DROP INDEX IF EXISTS idx_metric_configs_user_id;
DROP INDEX IF EXISTS idx_metric_configs_user_active_order;
DROP TABLE IF EXISTS metric_configurations CASCADE;

-- Drop profiles table and its indexes
DROP INDEX IF EXISTS idx_profiles_email;
DROP TABLE IF EXISTS profiles CASCADE;

-- ========================================
-- VERIFICATION
-- ========================================
-- After running this rollback, the database should be in the same state
-- as before the multi-user migration was applied.
-- The analyses table will continue to work for guest users only.