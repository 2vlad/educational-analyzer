-- Migration: Fix Programs Manual Support
-- Description: Add support for 'manual' source_type and make root_url nullable
-- Date: 2025-11-11
-- Fixes: Programs API mismatch with database schema

-- ========================================
-- 1. DROP EXISTING CONSTRAINT ON source_type
-- ========================================
ALTER TABLE programs 
  DROP CONSTRAINT IF EXISTS programs_source_type_check;

-- ========================================
-- 2. ADD NEW CONSTRAINT WITH 'manual' SUPPORT
-- ========================================
ALTER TABLE programs 
  ADD CONSTRAINT programs_source_type_check 
  CHECK (source_type IN ('yonote', 'generic_list', 'manual'));

-- ========================================
-- 3. MAKE root_url NULLABLE
-- ========================================
-- This allows 'manual' programs to have NULL root_url
ALTER TABLE programs 
  ALTER COLUMN root_url DROP NOT NULL;

-- ========================================
-- 4. ADD VALIDATION CONSTRAINT
-- ========================================
-- Ensure root_url is provided for 'yonote' and 'generic_list'
-- but can be NULL for 'manual'
ALTER TABLE programs 
  ADD CONSTRAINT programs_root_url_required_for_source_type 
  CHECK (
    (source_type = 'manual') OR 
    (source_type IN ('yonote', 'generic_list') AND root_url IS NOT NULL)
  );

-- ========================================
-- COMMENTS
-- ========================================
COMMENT ON CONSTRAINT programs_source_type_check ON programs IS 
  'Source type: yonote for Yonote platform, generic_list for URL lists, manual for manually uploaded lessons';

COMMENT ON CONSTRAINT programs_root_url_required_for_source_type ON programs IS 
  'Root URL is required for yonote and generic_list, but optional for manual programs';

-- ========================================
-- END OF MIGRATION
-- ========================================
