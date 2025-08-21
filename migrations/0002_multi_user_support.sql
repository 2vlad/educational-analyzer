-- Migration: Add multi-user support
-- Description: Creates profiles and metric_configurations tables, modifies analyses table for multi-tenancy
-- Date: 2024-08-21

-- ========================================
-- 1. CREATE PROFILES TABLE
-- ========================================
-- Stores user profile information linked to Supabase Auth
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Add updated_at trigger for profiles
CREATE TRIGGER update_profiles_updated_at 
  BEFORE UPDATE ON profiles 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 2. CREATE METRIC_CONFIGURATIONS TABLE
-- ========================================
-- Stores both default (user_id = NULL) and user-specific metric configurations
CREATE TABLE IF NOT EXISTS metric_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER NOT NULL CHECK (display_order > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure unique metric names per user (including defaults)
  CONSTRAINT unique_metric_name_per_user UNIQUE(user_id, name)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_metric_configs_user_id ON metric_configurations(user_id);
CREATE INDEX IF NOT EXISTS idx_metric_configs_user_active_order 
  ON metric_configurations(user_id, is_active, display_order) 
  WHERE is_active = TRUE;

-- Add updated_at trigger for metric_configurations
CREATE TRIGGER update_metric_configurations_updated_at 
  BEFORE UPDATE ON metric_configurations 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 3. MODIFY ANALYSES TABLE
-- ========================================
-- Add user_id and configuration_snapshot for multi-tenancy support
-- IMPORTANT: We use IF NOT EXISTS to prevent errors if columns already exist
DO $$ 
BEGIN
  -- Add user_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'analyses' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE analyses ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  -- Add configuration_snapshot column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'analyses' AND column_name = 'configuration_snapshot'
  ) THEN
    ALTER TABLE analyses ADD COLUMN configuration_snapshot JSONB;
  END IF;
END $$;

-- Add index for user_id to improve query performance
CREATE INDEX IF NOT EXISTS idx_analyses_user_id ON analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_user_created 
  ON analyses(user_id, created_at DESC) 
  WHERE user_id IS NOT NULL;

-- ========================================
-- 4. INSERT DEFAULT METRIC CONFIGURATIONS
-- ========================================
-- Insert the 5 default metrics with NULL user_id (available to all users)
INSERT INTO metric_configurations (user_id, name, prompt_text, display_order, is_active) VALUES
  (NULL, 'logic', 'Analyze the logical structure and argumentation of the following educational content. Evaluate the coherence, reasoning quality, and flow of ideas. Provide a score from -1 to +1.

{{content}}', 1, TRUE),
  
  (NULL, 'practical', 'Evaluate the practical applicability and real-world relevance of the following educational content. Consider how easily students can apply these concepts. Provide a score from -1 to +1.

{{content}}', 2, TRUE),
  
  (NULL, 'complexity', 'Assess the depth and complexity of the following educational content. Consider if the material is appropriately challenging and comprehensive. Provide a score from -1 to +1.

{{content}}', 3, TRUE),
  
  (NULL, 'interest', 'Evaluate how engaging and interesting the following educational content is. Consider factors that would maintain student attention and curiosity. Provide a score from -1 to +1.

{{content}}', 4, TRUE),
  
  (NULL, 'care', 'Assess the attention to detail and overall quality of the following educational content. Consider formatting, clarity, and professional presentation. Provide a score from -1 to +1.

{{content}}', 5, TRUE)
ON CONFLICT (user_id, name) DO NOTHING; -- Prevent duplicate inserts if migration runs multiple times

-- ========================================
-- 5. CREATE TRIGGER FOR NEW USER ONBOARDING
-- ========================================
-- Automatically create profile and copy default metrics when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create profile entry for the new user
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;

  -- Copy all default metric configurations to the new user
  INSERT INTO public.metric_configurations (
    user_id, 
    name, 
    prompt_text, 
    display_order, 
    is_active
  )
  SELECT 
    NEW.id,
    name,
    prompt_text,
    display_order,
    is_active
  FROM public.metric_configurations
  WHERE user_id IS NULL
  ON CONFLICT (user_id, name) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- ========================================
-- 6. ENABLE ROW LEVEL SECURITY (RLS)
-- ========================================
-- Enable RLS on all user-data tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE metric_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;

-- ========================================
-- 7. CREATE RLS POLICIES
-- ========================================

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Metric configurations policies
CREATE POLICY "Anyone can read default configurations"
  ON metric_configurations FOR SELECT
  TO anon, authenticated
  USING (user_id IS NULL);

CREATE POLICY "Users can manage their own configurations"
  ON metric_configurations FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Analyses policies
CREATE POLICY "Users can view their own analyses"
  ON analyses FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own analyses"
  ON analyses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Guests can create analyses without user_id"
  ON analyses FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);

CREATE POLICY "Guests can view their session analyses"
  ON analyses FOR SELECT
  TO anon
  USING (user_id IS NULL);

-- ========================================
-- 8. CREATE HELPER FUNCTIONS
-- ========================================

-- Function to get user's active metric configurations
CREATE OR REPLACE FUNCTION get_user_metrics(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  name TEXT,
  prompt_text TEXT,
  display_order INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mc.id,
    mc.name,
    mc.prompt_text,
    mc.display_order
  FROM metric_configurations mc
  WHERE 
    mc.is_active = TRUE
    AND (
      (p_user_id IS NOT NULL AND mc.user_id = p_user_id)
      OR 
      (p_user_id IS NULL AND mc.user_id IS NULL)
    )
  ORDER BY mc.display_order;
END;
$$;

-- Grant execute permission to authenticated and anon users
GRANT EXECUTE ON FUNCTION get_user_metrics TO authenticated, anon;

-- ========================================
-- ROLLBACK SCRIPT (Save as 0002_multi_user_support.down.sql)
-- ========================================
-- To rollback this migration, run:
/*
-- Remove triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS get_user_metrics(UUID);

-- Remove policies
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Anyone can read default configurations" ON metric_configurations;
DROP POLICY IF EXISTS "Users can manage their own configurations" ON metric_configurations;
DROP POLICY IF EXISTS "Users can view their own analyses" ON analyses;
DROP POLICY IF EXISTS "Users can create their own analyses" ON analyses;
DROP POLICY IF EXISTS "Guests can create analyses without user_id" ON analyses;
DROP POLICY IF EXISTS "Guests can view their session analyses" ON analyses;

-- Disable RLS
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE metric_configurations DISABLE ROW LEVEL SECURITY;
ALTER TABLE analyses DISABLE ROW LEVEL SECURITY;

-- Remove columns from analyses
ALTER TABLE analyses DROP COLUMN IF EXISTS user_id;
ALTER TABLE analyses DROP COLUMN IF EXISTS configuration_snapshot;

-- Drop tables
DROP TABLE IF EXISTS metric_configurations;
DROP TABLE IF EXISTS profiles;
*/