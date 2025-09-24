-- Migration: Add student_character column to profiles
-- Description: Stores customizable persona description for Лёха
-- Date: 2025-02-10

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS student_character TEXT;

ALTER TABLE profiles
  ALTER COLUMN student_character SET DEFAULT 'Ты — Лёха, студент без опыта в программировании, который изучает материал.';

UPDATE profiles
SET student_character = 'Ты — Лёха, студент без опыта в программировании, который изучает материал.'
WHERE student_character IS NULL;
