-- Add mosque onboarding status tracking for user trust and transparency
-- Distinguishes between directory listings and actively-managed mosques

-- Create onboarding status enum
CREATE TYPE "public"."mosque_onboarding_status" AS ENUM (
    'directory_only',    -- Listed in directory, no local admin assigned
    'in_progress',       -- Local admin assigned, but incomplete setup
    'claimed'            -- Local admin assigned, operational setup complete
);

ALTER TYPE "public"."mosque_onboarding_status" OWNER TO "postgres";

-- Add onboarding_status column to mosques table
ALTER TABLE "public"."mosques"
ADD COLUMN "onboarding_status" "public"."mosque_onboarding_status" DEFAULT 'directory_only'::"public"."mosque_onboarding_status" NOT NULL;

-- Add comment for clarity
COMMENT ON COLUMN "public"."mosques"."onboarding_status" IS 'Onboarding status: directory_only (unverified), in_progress (admin setup), or claimed (operational).';

-- Create index for efficient filtering
CREATE INDEX "idx_mosques_onboarding_status" ON "public"."mosques" USING "btree" ("onboarding_status");

-- Grant select access to public (needed for UI display)
GRANT SELECT("onboarding_status") ON TABLE "public"."mosques" TO "anon";
GRANT SELECT("onboarding_status") ON TABLE "public"."mosques" TO "authenticated";
