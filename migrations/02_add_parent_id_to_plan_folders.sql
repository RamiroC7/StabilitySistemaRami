-- Migration: add parent_id to plan_folders for subfolder support
ALTER TABLE plan_folders
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES plan_folders(id) ON DELETE CASCADE;
