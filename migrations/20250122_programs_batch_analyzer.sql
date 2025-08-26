-- Migration: Programs Batch Analyzer
-- Description: Adds tables and functionality for batch analysis of educational programs
-- Date: 2025-01-22
-- Based on PRD sections 7.1-7.4

-- ========================================
-- 1. CREATE EXTERNAL_CREDENTIALS TABLE
-- ========================================
-- Stores encrypted external service credentials (e.g., Yonote session cookies)
-- Cookie values are encrypted using AES-256-GCM with APP_SECRET_KEY
CREATE TABLE IF NOT EXISTS external_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('yonote')),
  name TEXT NOT NULL,
  cookie_encrypted TEXT NOT NULL,    -- AES-256-GCM encrypted session cookie
  cookie_expires_at TIMESTAMPTZ,     -- Optional expiry tracking
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure unique provider per user (can have multiple credentials per provider)
  CONSTRAINT unique_credential_name_per_user UNIQUE(user_id, provider, name)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_external_credentials_user_id ON external_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_external_credentials_provider ON external_credentials(provider);

-- Add updated_at trigger
CREATE TRIGGER update_external_credentials_updated_at 
  BEFORE UPDATE ON external_credentials 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 2. CREATE PROGRAMS TABLE
-- ========================================
-- Stores educational programs (collections of lessons)
CREATE TABLE IF NOT EXISTS programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('yonote', 'generic_list')),
  root_url TEXT NOT NULL,
  credential_id UUID REFERENCES external_credentials(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure unique program names per user
  CONSTRAINT unique_program_name_per_user UNIQUE(user_id, name)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_programs_user_id ON programs(user_id);
CREATE INDEX IF NOT EXISTS idx_programs_credential_id ON programs(credential_id);
CREATE INDEX IF NOT EXISTS idx_programs_user_created ON programs(user_id, created_at DESC);

-- Add updated_at trigger
CREATE TRIGGER update_programs_updated_at 
  BEFORE UPDATE ON programs 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 3. CREATE PROGRAM_LESSONS TABLE
-- ========================================
-- Stores individual lessons within programs (supports hierarchical structure)
CREATE TABLE IF NOT EXISTS program_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES program_lessons(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  source_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  content_hash TEXT,                   -- SHA256 hash of normalized content for change detection
  last_fetched_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure unique URLs within a program
  CONSTRAINT unique_lesson_url_per_program UNIQUE(program_id, source_url)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_program_lessons_program_id ON program_lessons(program_id);
CREATE INDEX IF NOT EXISTS idx_program_lessons_program_order ON program_lessons(program_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_program_lessons_parent_id ON program_lessons(parent_id);
CREATE INDEX IF NOT EXISTS idx_program_lessons_content_hash ON program_lessons(content_hash);

-- ========================================
-- 4. CREATE PROGRAM_RUNS TABLE
-- ========================================
-- Tracks batch analysis execution runs
CREATE TABLE IF NOT EXISTS program_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'paused', 'stopped', 'completed', 'failed')),
  metrics_mode TEXT NOT NULL CHECK (metrics_mode IN ('lx', 'custom')),
  metric_configuration_id UUID REFERENCES metric_configurations(id) ON DELETE SET NULL,
  
  -- Progress tracking counters
  total_lessons INTEGER NOT NULL DEFAULT 0,
  queued INTEGER NOT NULL DEFAULT 0,
  processed INTEGER NOT NULL DEFAULT 0,
  succeeded INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  
  -- Execution configuration
  max_concurrency INTEGER NOT NULL DEFAULT 1 CHECK (max_concurrency > 0 AND max_concurrency <= 10),
  
  -- Timing information
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Computed progress field (can be generated in view or application)
  -- progress = processed / NULLIF(total_lessons, 0)
  
  CONSTRAINT valid_status_transitions CHECK (
    (status = 'queued' AND started_at IS NULL AND finished_at IS NULL) OR
    (status IN ('running', 'paused') AND started_at IS NOT NULL AND finished_at IS NULL) OR
    (status IN ('stopped', 'completed', 'failed') AND finished_at IS NOT NULL)
  )
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_program_runs_program_id ON program_runs(program_id);
CREATE INDEX IF NOT EXISTS idx_program_runs_user_id ON program_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_program_runs_status ON program_runs(status);
CREATE INDEX IF NOT EXISTS idx_program_runs_program_status ON program_runs(program_id, status);
CREATE INDEX IF NOT EXISTS idx_program_runs_user_created ON program_runs(user_id, created_at DESC);

-- ========================================
-- 5. CREATE ANALYSIS_JOBS TABLE
-- ========================================
-- Queue for individual lesson analysis tasks
CREATE TABLE IF NOT EXISTS analysis_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_run_id UUID NOT NULL REFERENCES program_runs(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES program_lessons(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'skipped')),
  
  -- Retry and error tracking
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error TEXT,
  
  -- Locking mechanism for concurrent workers
  locked_by TEXT,                      -- Worker identifier
  locked_at TIMESTAMPTZ,               -- Lock timestamp (used for TTL)
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure one job per lesson per run
  CONSTRAINT unique_job_per_lesson_run UNIQUE(program_run_id, lesson_id)
);

-- Indexes for efficient job picking and status queries
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_run_status ON analysis_jobs(program_run_id, status);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status_locked ON analysis_jobs(status, locked_at) 
  WHERE status IN ('queued', 'running');
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_queued ON analysis_jobs(created_at) 
  WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_lesson_id ON analysis_jobs(lesson_id);

-- Add updated_at trigger
CREATE TRIGGER update_analysis_jobs_updated_at 
  BEFORE UPDATE ON analysis_jobs 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 6. EXTEND ANALYSES TABLE
-- ========================================
-- Add columns to link analyses to programs, runs, and lessons
DO $$ 
BEGIN
  -- Add program_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'analyses' AND column_name = 'program_id'
  ) THEN
    ALTER TABLE analyses ADD COLUMN program_id UUID REFERENCES programs(id) ON DELETE SET NULL;
  END IF;

  -- Add program_run_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'analyses' AND column_name = 'program_run_id'
  ) THEN
    ALTER TABLE analyses ADD COLUMN program_run_id UUID REFERENCES program_runs(id) ON DELETE SET NULL;
  END IF;

  -- Add lesson_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'analyses' AND column_name = 'lesson_id'
  ) THEN
    ALTER TABLE analyses ADD COLUMN lesson_id UUID REFERENCES program_lessons(id) ON DELETE SET NULL;
  END IF;

  -- Add content_hash column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'analyses' AND column_name = 'content_hash'
  ) THEN
    ALTER TABLE analyses ADD COLUMN content_hash TEXT;
  END IF;
END $$;

-- Add indexes for program-related queries
CREATE INDEX IF NOT EXISTS idx_analyses_program_id ON analyses(program_id);
CREATE INDEX IF NOT EXISTS idx_analyses_program_run_id ON analyses(program_run_id);
CREATE INDEX IF NOT EXISTS idx_analyses_lesson_id ON analyses(lesson_id);
CREATE INDEX IF NOT EXISTS idx_analyses_program_run_lesson ON analyses(program_id, program_run_id, lesson_id);
CREATE INDEX IF NOT EXISTS idx_analyses_content_hash ON analyses(content_hash);

-- Composite index for idempotency checks
CREATE INDEX IF NOT EXISTS idx_analyses_lesson_config_hash 
  ON analyses(lesson_id, content_hash) 
  WHERE lesson_id IS NOT NULL;

-- ========================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ========================================

-- Enable RLS on all new tables
ALTER TABLE external_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_jobs ENABLE ROW LEVEL SECURITY;

-- ========================================
-- 7.1 EXTERNAL_CREDENTIALS RLS POLICIES
-- ========================================
-- Users can only manage their own credentials
CREATE POLICY "Users can view own credentials" 
  ON external_credentials FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own credentials" 
  ON external_credentials FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own credentials" 
  ON external_credentials FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own credentials" 
  ON external_credentials FOR DELETE 
  USING (auth.uid() = user_id);

-- ========================================
-- 7.2 PROGRAMS RLS POLICIES
-- ========================================
-- Users can only manage their own programs
CREATE POLICY "Users can view own programs" 
  ON programs FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own programs" 
  ON programs FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own programs" 
  ON programs FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own programs" 
  ON programs FOR DELETE 
  USING (auth.uid() = user_id);

-- ========================================
-- 7.3 PROGRAM_LESSONS RLS POLICIES
-- ========================================
-- Users can manage lessons of their own programs
CREATE POLICY "Users can view lessons of own programs" 
  ON program_lessons FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM programs 
      WHERE programs.id = program_lessons.program_id 
      AND programs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert lessons to own programs" 
  ON program_lessons FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM programs 
      WHERE programs.id = program_lessons.program_id 
      AND programs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update lessons of own programs" 
  ON program_lessons FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM programs 
      WHERE programs.id = program_lessons.program_id 
      AND programs.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM programs 
      WHERE programs.id = program_lessons.program_id 
      AND programs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete lessons from own programs" 
  ON program_lessons FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM programs 
      WHERE programs.id = program_lessons.program_id 
      AND programs.user_id = auth.uid()
    )
  );

-- ========================================
-- 7.4 PROGRAM_RUNS RLS POLICIES
-- ========================================
-- Users can only manage their own runs
CREATE POLICY "Users can view own runs" 
  ON program_runs FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own runs" 
  ON program_runs FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own runs" 
  ON program_runs FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own runs" 
  ON program_runs FOR DELETE 
  USING (auth.uid() = user_id);

-- ========================================
-- 7.5 ANALYSIS_JOBS RLS POLICIES
-- ========================================
-- Users can view/manage jobs for their own runs
CREATE POLICY "Users can view jobs of own runs" 
  ON analysis_jobs FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM program_runs 
      WHERE program_runs.id = analysis_jobs.program_run_id 
      AND program_runs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert jobs for own runs" 
  ON analysis_jobs FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM program_runs 
      WHERE program_runs.id = analysis_jobs.program_run_id 
      AND program_runs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update jobs of own runs" 
  ON analysis_jobs FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM program_runs 
      WHERE program_runs.id = analysis_jobs.program_run_id 
      AND program_runs.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM program_runs 
      WHERE program_runs.id = analysis_jobs.program_run_id 
      AND program_runs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete jobs from own runs" 
  ON analysis_jobs FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM program_runs 
      WHERE program_runs.id = analysis_jobs.program_run_id 
      AND program_runs.user_id = auth.uid()
    )
  );

-- ========================================
-- 8. HELPER VIEWS (Optional but useful)
-- ========================================

-- View for program run progress with computed fields
CREATE OR REPLACE VIEW program_run_progress AS
SELECT 
  pr.*,
  CASE 
    WHEN pr.total_lessons = 0 THEN 0
    ELSE ROUND((pr.processed::DECIMAL / pr.total_lessons) * 100, 2)
  END AS progress_percentage,
  CASE 
    WHEN pr.status = 'completed' THEN pr.finished_at - pr.started_at
    WHEN pr.status = 'running' AND pr.started_at IS NOT NULL THEN NOW() - pr.started_at
    ELSE NULL
  END AS duration,
  p.name AS program_name,
  p.source_type AS program_source_type
FROM program_runs pr
JOIN programs p ON p.id = pr.program_id;

-- View for job queue status
CREATE OR REPLACE VIEW job_queue_status AS
SELECT 
  pr.id AS run_id,
  pr.status AS run_status,
  COUNT(aj.id) AS total_jobs,
  COUNT(CASE WHEN aj.status = 'queued' THEN 1 END) AS queued_jobs,
  COUNT(CASE WHEN aj.status = 'running' THEN 1 END) AS running_jobs,
  COUNT(CASE WHEN aj.status = 'succeeded' THEN 1 END) AS succeeded_jobs,
  COUNT(CASE WHEN aj.status = 'failed' THEN 1 END) AS failed_jobs,
  COUNT(CASE WHEN aj.status = 'skipped' THEN 1 END) AS skipped_jobs
FROM program_runs pr
LEFT JOIN analysis_jobs aj ON aj.program_run_id = pr.id
GROUP BY pr.id, pr.status;

-- ========================================
-- 9. COMMENTS FOR DOCUMENTATION
-- ========================================

COMMENT ON TABLE external_credentials IS 'Stores encrypted external service credentials for accessing protected content sources';
COMMENT ON COLUMN external_credentials.cookie_encrypted IS 'AES-256-GCM encrypted session cookie, never stored in plain text';
COMMENT ON COLUMN external_credentials.cookie_expires_at IS 'Optional tracking of credential expiry for proactive renewal';

COMMENT ON TABLE programs IS 'Educational programs consisting of multiple lessons for batch analysis';
COMMENT ON COLUMN programs.source_type IS 'Type of content source: yonote for Yonote platform, generic_list for URL lists';
COMMENT ON COLUMN programs.root_url IS 'Root URL for the program, used to enumerate lessons';

COMMENT ON TABLE program_lessons IS 'Individual lessons within a program, supports hierarchical structure';
COMMENT ON COLUMN program_lessons.content_hash IS 'SHA256 hash of normalized content for change detection and idempotency';
COMMENT ON COLUMN program_lessons.sort_order IS 'Order of lesson within the program or parent section';

COMMENT ON TABLE program_runs IS 'Tracks batch analysis execution runs with progress and status';
COMMENT ON COLUMN program_runs.metrics_mode IS 'lx for default metrics, custom for user-defined metric configurations';
COMMENT ON COLUMN program_runs.max_concurrency IS 'Maximum number of parallel analysis jobs (1-10)';

COMMENT ON TABLE analysis_jobs IS 'Queue for individual lesson analysis tasks with retry and locking support';
COMMENT ON COLUMN analysis_jobs.locked_by IS 'Identifier of the worker processing this job';
COMMENT ON COLUMN analysis_jobs.locked_at IS 'Lock timestamp used for TTL-based lock expiry (90 seconds default)';

COMMENT ON VIEW program_run_progress IS 'Enhanced view of program runs with computed progress and duration fields';
COMMENT ON VIEW job_queue_status IS 'Summary view of job queue status per run for monitoring';

-- ========================================
-- 10. GRANT PERMISSIONS (if needed)
-- ========================================
-- Note: Supabase handles most permissions through RLS and auth roles
-- These grants ensure the service role can bypass RLS for worker operations

-- Grant usage on schema to authenticated users (if not already granted)
GRANT USAGE ON SCHEMA public TO authenticated;

-- Grant all privileges on new tables to authenticated users
GRANT ALL ON external_credentials TO authenticated;
GRANT ALL ON programs TO authenticated;
GRANT ALL ON program_lessons TO authenticated;
GRANT ALL ON program_runs TO authenticated;
GRANT ALL ON analysis_jobs TO authenticated;

-- Grant select on views to authenticated users
GRANT SELECT ON program_run_progress TO authenticated;
GRANT SELECT ON job_queue_status TO authenticated;

-- ========================================
-- END OF MIGRATION
-- ========================================