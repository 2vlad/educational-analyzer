-- Add session tracking for guest users
-- This allows guests to view their analysis history without authentication

-- Add session_id column to analyses table
ALTER TABLE analyses 
ADD COLUMN IF NOT EXISTS session_id TEXT;

-- Add index for session_id for faster queries
CREATE INDEX IF NOT EXISTS idx_analyses_session_id 
ON analyses(session_id) 
WHERE session_id IS NOT NULL;

-- Update RLS policies to allow guests to view their own analyses by session_id
-- First, drop existing policy if it exists
DROP POLICY IF EXISTS "Users can view own analyses or guest analyses" ON analyses;

-- Create new policy that allows both authenticated users and guests
CREATE POLICY "Users can view own analyses or guest analyses" ON analyses
FOR SELECT
USING (
    -- Allow authenticated users to see their own analyses
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR
    -- Allow viewing analyses without user_id (guest analyses)
    -- Note: Frontend must filter by session_id for security
    (user_id IS NULL)
);

-- Add comment for documentation
COMMENT ON COLUMN analyses.session_id IS 'Session identifier for guest users to track their analyses';