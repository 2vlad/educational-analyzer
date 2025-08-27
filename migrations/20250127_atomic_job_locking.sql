-- Migration: Atomic Job Locking with FOR UPDATE SKIP LOCKED
-- This fixes the critical race condition where multiple workers could pick the same job

-- Create atomic job picking function for analysis_jobs table
CREATE OR REPLACE FUNCTION pick_next_analysis_job(
  worker_id_param TEXT,
  run_id_param UUID DEFAULT NULL
)
RETURNS TABLE (
  job_id UUID,
  job_type TEXT,
  job_payload JSONB,
  job_priority INTEGER,
  job_retry_count INTEGER,
  job_program_run_id UUID,
  job_lesson_id UUID
) 
LANGUAGE plpgsql
AS $$
BEGIN
  -- Atomically select and lock one job
  -- FOR UPDATE SKIP LOCKED ensures only one worker can grab each job
  RETURN QUERY
  UPDATE analysis_jobs
  SET 
    status = 'running',
    locked_at = NOW(),
    locked_by = worker_id_param,
    started_at = COALESCE(started_at, NOW()),
    updated_at = NOW()
  FROM (
    SELECT id
    FROM analysis_jobs
    WHERE 
      status = 'queued'
      AND (run_id_param IS NULL OR program_run_id = run_id_param)
      AND (available_at IS NULL OR available_at <= NOW())
      AND (locked_at IS NULL OR locked_at < NOW() - INTERVAL '90 seconds') -- TTL check
    ORDER BY 
      priority DESC,
      created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED  -- This is the critical part - prevents race conditions
  ) AS next_job
  WHERE analysis_jobs.id = next_job.id
  RETURNING 
    analysis_jobs.id AS job_id,
    analysis_jobs.type AS job_type,
    analysis_jobs.payload AS job_payload,
    analysis_jobs.priority AS job_priority,
    analysis_jobs.retry_count AS job_retry_count,
    analysis_jobs.program_run_id AS job_program_run_id,
    analysis_jobs.lesson_id AS job_lesson_id;
END;
$$;

-- Add available_at column for proper retry scheduling (separate from locked_at)
ALTER TABLE analysis_jobs 
ADD COLUMN IF NOT EXISTS available_at TIMESTAMPTZ;

-- Add index for efficient job picking
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_pick 
ON analysis_jobs(status, available_at, priority DESC, created_at ASC)
WHERE status = 'queued';

-- Add index for stale job detection with available_at
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_available 
ON analysis_jobs(status, available_at)
WHERE status = 'queued' AND available_at IS NOT NULL;

-- Create function to release stale locks (jobs stuck in running for too long)
CREATE OR REPLACE FUNCTION release_stale_analysis_locks(
  stale_threshold_minutes INTEGER DEFAULT 10
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  released_count INTEGER;
BEGIN
  UPDATE analysis_jobs
  SET 
    status = 'queued',
    locked_at = NULL,
    locked_by = NULL,
    available_at = NOW() + INTERVAL '30 seconds' -- Brief delay before retry
  WHERE 
    status = 'running'
    AND locked_at < NOW() - (stale_threshold_minutes || ' minutes')::INTERVAL;
  
  GET DIAGNOSTICS released_count = ROW_COUNT;
  RETURN released_count;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION pick_next_analysis_job TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION release_stale_analysis_locks TO authenticated, service_role;

COMMENT ON FUNCTION pick_next_analysis_job IS 'Atomically picks and locks the next available analysis job for processing';
COMMENT ON FUNCTION release_stale_analysis_locks IS 'Releases locks on analysis jobs that have been running too long';
COMMENT ON COLUMN analysis_jobs.available_at IS 'Timestamp when job becomes available for processing (used for retry backoff)';