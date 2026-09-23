-- Add username, location, and reciter preferences for Week 1 features
-- Migration: 2026-08-29 (Week 1: Simplified Auth + Traveler Mode + Quran Integration)

-- Add username column (unique, required after migration)
ALTER TABLE "public"."users" ADD COLUMN "username" "text";
CREATE UNIQUE INDEX "users_username_key" ON "public"."users" ("username") WHERE "username" IS NOT NULL;

-- Add user_location for traveler mode (auto-detect, manual search, temporary switching)
ALTER TABLE "public"."users" ADD COLUMN "user_location" jsonb DEFAULT '{"type":"home","city":null,"latitude":null,"longitude":null,"auto_detected":false,"switched_at":null}'::jsonb;

-- Add preferred_reciters for remembering user's Quran.com reciter choice
ALTER TABLE "public"."users" ADD COLUMN "preferred_reciters" jsonb DEFAULT '{"primary":null,"reciter_id":null,"style":null}'::jsonb;

-- Add column for tracking which step of signup user completed
ALTER TABLE "public"."users" ADD COLUMN "signup_completed_steps" jsonb DEFAULT '{"step1":false,"step2":false,"profile_complete":false}'::jsonb;

-- Update existing users to have complete signup status
UPDATE "public"."users"
SET "signup_completed_steps" = '{"step1":true,"step2":true,"profile_complete":true}'::jsonb
WHERE "display_name" IS NOT NULL;

-- Create index for traveler mode queries (city-based mosque discovery)
CREATE INDEX "users_user_location_city_idx" ON "public"."users" USING gin ("user_location" jsonb_path_ops);
