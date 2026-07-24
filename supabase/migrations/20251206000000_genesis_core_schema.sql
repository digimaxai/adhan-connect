-- Genesis: core schema predating migration tracking (2026-07-24 reconstruction)
--
-- These 14 tables and their supporting enum types were created directly
-- (dashboard/SQL editor) before this repo started tracking Supabase
-- migrations on 2025-12-06. Every migration since has assumed they already
-- exist. This file closes that gap by reconstructing them from a real
-- `pg_dump` of the live production schema on 2026-07-24, so a brand-new
-- Supabase project can be bootstrapped from `supabase/migrations/` alone.
--
-- Scope: tables + enum types only. ~20 functions in production (some
-- superseded/legacy broadcast RPCs, some still-used trigger helpers) are
-- NOT captured here yet -- deliberately deferred as follow-up work.
-- Consequently, any policy/constraint/index/trigger on these tables that
-- (a) is already created by a later tracked migration, (b) depends on one
-- of those deferred functions, or (c) references a table created by a
-- later migration (e.g. mosque_admins), was excluded here too -- genesis
-- cannot forward-reference an object defined by a later migration. See
-- this repo's commit history / docs for the exact excluded list. Follow-up
-- work should add the deferred functions and these excluded policies
-- together in one pass, verified the same way this file was.
--
-- Verified before writing: every foreign key among these 14 tables points
-- only to another one of these 14 tables (checked directly against
-- production) -- no forward-reference to a table created by a later,
-- already-tracked migration. Applied successfully end-to-end against a
-- disposable Supabase-flavoured Postgres container before being committed.

-- Custom enum types
CREATE TYPE "public"."adhan_status" AS ENUM (
    'scheduled',
    'live',
    'completed',
    'cancelled'
);;

ALTER TYPE "public"."adhan_status" OWNER TO "postgres";;

CREATE TYPE "public"."campaign_status" AS ENUM (
    'draft',
    'active',
    'paused',
    'ended',
    'archived'
);;

ALTER TYPE "public"."campaign_status" OWNER TO "postgres";;

CREATE TYPE "public"."donation_provider" AS ENUM (
    'stripe',
    'apple',
    'google',
    'paypal',
    'other'
);;

ALTER TYPE "public"."donation_provider" OWNER TO "postgres";;

CREATE TYPE "public"."donation_status" AS ENUM (
    'succeeded',
    'pending',
    'failed',
    'refunded'
);;

ALTER TYPE "public"."donation_status" OWNER TO "postgres";;

CREATE TYPE "public"."event_type_t" AS ENUM (
    'jumuah',
    'talk',
    'class',
    'fundraiser',
    'other'
);;

ALTER TYPE "public"."event_type_t" OWNER TO "postgres";;

CREATE TYPE "public"."mosque_status" AS ENUM (
    'pending',
    'active',
    'inactive'
);;

ALTER TYPE "public"."mosque_status" OWNER TO "postgres";;

CREATE TYPE "public"."prayer_t" AS ENUM (
    'fajr',
    'dhuhr',
    'asr',
    'maghrib',
    'isha',
    'other'
);;

ALTER TYPE "public"."prayer_t" OWNER TO "postgres";;

CREATE TYPE "public"."stream_status" AS ENUM (
    'active',
    'paused',
    'disabled'
);;

ALTER TYPE "public"."stream_status" OWNER TO "postgres";;

CREATE TYPE "public"."stream_type" AS ENUM (
    'hls',
    'webrtc'
);;

ALTER TYPE "public"."stream_type" OWNER TO "postgres";;

CREATE TYPE "public"."subscription_provider" AS ENUM (
    'stripe',
    'apple',
    'google'
);;

ALTER TYPE "public"."subscription_provider" OWNER TO "postgres";;

CREATE TYPE "public"."subscription_status" AS ENUM (
    'active',
    'past_due',
    'canceled',
    'incomplete'
);;

ALTER TYPE "public"."subscription_status" OWNER TO "postgres";;

CREATE TYPE "public"."user_role" AS ENUM (
    'user',
    'local_admin',
    'main_admin'
);;

ALTER TYPE "public"."user_role" OWNER TO "postgres";;

CREATE TYPE "public"."visibility_t" AS ENUM (
    'public',
    'unlisted',
    'private'
);;

ALTER TYPE "public"."visibility_t" OWNER TO "postgres";;

-- Table: users
CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "display_name" "text",
    "role" "public"."user_role" DEFAULT 'user'::"public"."user_role" NOT NULL,
    "phone" "text",
    "home_city" "text",
    "country_code" "text",
    "last_login_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);;

ALTER TABLE "public"."users" OWNER TO "postgres";;

ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");;

ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");;

ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;;

CREATE POLICY "users service_role all" ON "public"."users" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));;

CREATE POLICY "users_self_or_main_admin_insert" ON "public"."users" FOR INSERT WITH CHECK ((("id" = "auth"."uid"()) OR ("role" = 'main_admin'::"public"."user_role")));;

CREATE POLICY "users_self_or_main_admin_update" ON "public"."users" FOR UPDATE USING ((("id" = "auth"."uid"()) OR ("role" = 'main_admin'::"public"."user_role"))) WITH CHECK ((("id" = "auth"."uid"()) OR ("role" = 'main_admin'::"public"."user_role")));;

GRANT ALL ON TABLE "public"."users" TO "anon";;

GRANT ALL ON TABLE "public"."users" TO "authenticated";;

GRANT ALL ON TABLE "public"."users" TO "service_role";;

-- Table: mosques
CREATE TABLE IF NOT EXISTS "public"."mosques" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text",
    "description" "text",
    "address_line1" "text",
    "address_line2" "text",
    "city" "text",
    "postcode" "text",
    "country_code" "text",
    "lat" double precision,
    "lng" double precision,
    "timezone" "text",
    "status" "public"."mosque_status" DEFAULT 'pending'::"public"."mosque_status" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_active" boolean DEFAULT true,
    "country" "text",
    "reliability_score" numeric,
    "active" boolean DEFAULT true NOT NULL,
    "location" "text",
    "location_geog" "public"."geography"(Point,4326),
    "time_zone" "text" DEFAULT 'UTC'::"text" NOT NULL,
    "allow_multi_mosque_local_admins" boolean DEFAULT false NOT NULL,
    "live_stream_enabled" boolean DEFAULT false NOT NULL,
    "live_stream_provider" "text",
    "live_stream_playback_url" "text",
    "live_stream_ingest_url" "text",
    "live_stream_stream_key" "text",
    "live_stream_username" "text",
    "live_stream_status_secret" "text",
    "live_stream_mount_path" "text",
    "live_stream_listener_secret" "text",
    "prayer_calculation_method" integer DEFAULT 3 NOT NULL,
    "prayer_school" integer DEFAULT 0 NOT NULL,
    "default_muezzin_user_id" "uuid",
    "prayer_source" "text" DEFAULT 'aladhan'::"text" NOT NULL,
    CONSTRAINT "mosques_prayer_source_check" CHECK (("prayer_source" = ANY (ARRAY['aladhan'::"text", 'elm'::"text"])))
);;

ALTER TABLE "public"."mosques" OWNER TO "postgres";;

COMMENT ON COLUMN "public"."mosques"."lat" IS 'Mosque latitude (WGS-84). Required for Aladhan calculated prayer-time fallback.';;

COMMENT ON COLUMN "public"."mosques"."lng" IS 'Mosque longitude (WGS-84). Required for Aladhan calculated prayer-time fallback.';;

COMMENT ON COLUMN "public"."mosques"."is_active" IS 'Determines whether the mosque is active and visible to public users.';;

COMMENT ON COLUMN "public"."mosques"."allow_multi_mosque_local_admins" IS 'When true, local admins assigned to this mosque may also hold mosque_admins assignments for other mosques that allow the same.';;

COMMENT ON COLUMN "public"."mosques"."live_stream_enabled" IS 'When true, this mosque is configured to publish a live audio stream to followers.';;

COMMENT ON COLUMN "public"."mosques"."live_stream_provider" IS 'Provider label for the mosque live stream setup, for example external, icecast, hls, or test.';;

COMMENT ON COLUMN "public"."mosques"."live_stream_playback_url" IS 'Playback URL followers should consume while this mosque is live.';;

COMMENT ON COLUMN "public"."mosques"."live_stream_ingest_url" IS 'Optional ingest endpoint for the mosque live stream provider, such as RTMP or Icecast.';;

COMMENT ON COLUMN "public"."mosques"."live_stream_stream_key" IS 'Optional stream key or credential used by the mosque live stream provider.';;

COMMENT ON COLUMN "public"."mosques"."live_stream_username" IS 'Optional provider username for mosque live streaming. Used by providers such as Icecast that require source username plus password.';;

COMMENT ON COLUMN "public"."mosques"."live_stream_status_secret" IS 'Shared secret used by upstream live-stream provider callbacks to report encoder connection state for this mosque.';;

COMMENT ON COLUMN "public"."mosques"."live_stream_mount_path" IS 'Optional mountpoint path for Icecast-style listener playback, for example /live/harrow-mosque.aac.';;

COMMENT ON COLUMN "public"."mosques"."live_stream_listener_secret" IS 'Per-mosque secret used to mint short-lived signed listener playback access URLs.';;

COMMENT ON COLUMN "public"."mosques"."prayer_calculation_method" IS 'Aladhan calculation method ID used as fallback when no manual prayer times are stored. Default 3 = Muslim World League. See https://aladhan.com/calculation-methods';;

COMMENT ON COLUMN "public"."mosques"."prayer_school" IS 'Aladhan school parameter for Asr calculation. 0 = Shafi (shadow 1x, default), 1 = Hanafi (shadow 2x). Most UK South Asian mosques use 1.';;

COMMENT ON COLUMN "public"."mosques"."default_muezzin_user_id" IS 'Active muezzin used as the fallback assignee when no explicit staff_rota row exists for a prayer/date.';;

COMMENT ON COLUMN "public"."mosques"."prayer_source" IS 'Source for auto-calculated prayer times when no manual schedule is uploaded. ''aladhan'' (default) uses the Aladhan API. ''elm'' uses the East London Mosque official timetable (London mosques only).';;

ALTER TABLE ONLY "public"."mosques"
    ADD CONSTRAINT "mosques_pkey" PRIMARY KEY ("id");;

ALTER TABLE ONLY "public"."mosques"
    ADD CONSTRAINT "mosques_slug_key" UNIQUE ("slug");;

CREATE INDEX "idx_mosques_city" ON "public"."mosques" USING "btree" ("city");;

CREATE INDEX "idx_mosques_country" ON "public"."mosques" USING "btree" ("country_code");;

CREATE INDEX "idx_mosques_default_muezzin" ON "public"."mosques" USING "btree" ("default_muezzin_user_id") WHERE ("default_muezzin_user_id" IS NOT NULL);;

CREATE INDEX "idx_mosques_geo" ON "public"."mosques" USING "btree" ("lat", "lng");;

CREATE INDEX "idx_mosques_status" ON "public"."mosques" USING "btree" ("status");;

CREATE INDEX "mosques_loc_idx" ON "public"."mosques" USING "gist" ("location_geog");;

CREATE INDEX "mosques_trgm_idx" ON "public"."mosques" USING "gin" (((((("name" || ' '::"text") || COALESCE("city", ''::"text")) || ' '::"text") || COALESCE("country", ''::"text"))) "public"."gin_trgm_ops");;

ALTER TABLE ONLY "public"."mosques"
    ADD CONSTRAINT "mosques_default_muezzin_user_id_fkey" FOREIGN KEY ("default_muezzin_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;;

CREATE POLICY "deny all" ON "public"."mosques" USING (false) WITH CHECK (false);;

ALTER TABLE "public"."mosques" ENABLE ROW LEVEL SECURITY;;

CREATE POLICY "mosques read public" ON "public"."mosques" FOR SELECT USING (("auth"."role"() = ANY (ARRAY['anon'::"text", 'authenticated'::"text", 'service_role'::"text"])));;

CREATE POLICY "mosques service_role all" ON "public"."mosques" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));;

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."mosques" TO "anon";;

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."mosques" TO "authenticated";;

GRANT ALL ON TABLE "public"."mosques" TO "service_role";;

GRANT SELECT("id") ON TABLE "public"."mosques" TO "anon";;

GRANT SELECT("id") ON TABLE "public"."mosques" TO "authenticated";;

GRANT SELECT("name") ON TABLE "public"."mosques" TO "anon";;

GRANT SELECT("name") ON TABLE "public"."mosques" TO "authenticated";;

GRANT SELECT("slug") ON TABLE "public"."mosques" TO "anon";;

GRANT SELECT("slug") ON TABLE "public"."mosques" TO "authenticated";;

GRANT SELECT("description") ON TABLE "public"."mosques" TO "anon";;

GRANT SELECT("description") ON TABLE "public"."mosques" TO "authenticated";;

GRANT SELECT("address_line1") ON TABLE "public"."mosques" TO "anon";;

GRANT SELECT("address_line1") ON TABLE "public"."mosques" TO "authenticated";;

GRANT SELECT("address_line2") ON TABLE "public"."mosques" TO "anon";;

GRANT SELECT("address_line2") ON TABLE "public"."mosques" TO "authenticated";;

GRANT SELECT("city") ON TABLE "public"."mosques" TO "anon";;

GRANT SELECT("city") ON TABLE "public"."mosques" TO "authenticated";;

GRANT SELECT("postcode") ON TABLE "public"."mosques" TO "anon";;

GRANT SELECT("postcode") ON TABLE "public"."mosques" TO "authenticated";;

GRANT SELECT("country_code") ON TABLE "public"."mosques" TO "anon";;

GRANT SELECT("country_code") ON TABLE "public"."mosques" TO "authenticated";;

GRANT SELECT("lat") ON TABLE "public"."mosques" TO "anon";;

GRANT SELECT("lat") ON TABLE "public"."mosques" TO "authenticated";;

GRANT SELECT("lng") ON TABLE "public"."mosques" TO "anon";;

GRANT SELECT("lng") ON TABLE "public"."mosques" TO "authenticated";;

GRANT SELECT("timezone") ON TABLE "public"."mosques" TO "anon";;

GRANT SELECT("timezone") ON TABLE "public"."mosques" TO "authenticated";;

GRANT SELECT("status") ON TABLE "public"."mosques" TO "anon";;

GRANT SELECT("status") ON TABLE "public"."mosques" TO "authenticated";;

GRANT SELECT("created_at") ON TABLE "public"."mosques" TO "anon";;

GRANT SELECT("created_at") ON TABLE "public"."mosques" TO "authenticated";;

GRANT SELECT("updated_at") ON TABLE "public"."mosques" TO "anon";;

GRANT SELECT("updated_at") ON TABLE "public"."mosques" TO "authenticated";;

GRANT SELECT("is_active") ON TABLE "public"."mosques" TO "anon";;

GRANT SELECT("is_active") ON TABLE "public"."mosques" TO "authenticated";;

GRANT SELECT("country") ON TABLE "public"."mosques" TO "anon";;

GRANT SELECT("country") ON TABLE "public"."mosques" TO "authenticated";;

GRANT SELECT("active") ON TABLE "public"."mosques" TO "anon";;

GRANT SELECT("active") ON TABLE "public"."mosques" TO "authenticated";;

GRANT SELECT("location") ON TABLE "public"."mosques" TO "anon";;

GRANT SELECT("location") ON TABLE "public"."mosques" TO "authenticated";;

GRANT SELECT("time_zone") ON TABLE "public"."mosques" TO "anon";;

GRANT SELECT("time_zone") ON TABLE "public"."mosques" TO "authenticated";;

GRANT SELECT("allow_multi_mosque_local_admins") ON TABLE "public"."mosques" TO "anon";;

GRANT SELECT("allow_multi_mosque_local_admins") ON TABLE "public"."mosques" TO "authenticated";;

GRANT SELECT("live_stream_enabled") ON TABLE "public"."mosques" TO "anon";;

GRANT SELECT("live_stream_enabled") ON TABLE "public"."mosques" TO "authenticated";;

GRANT SELECT("prayer_calculation_method") ON TABLE "public"."mosques" TO "anon";;

GRANT SELECT("prayer_calculation_method") ON TABLE "public"."mosques" TO "authenticated";;

GRANT SELECT("prayer_school") ON TABLE "public"."mosques" TO "anon";;

GRANT SELECT("prayer_school") ON TABLE "public"."mosques" TO "authenticated";;

GRANT SELECT("default_muezzin_user_id") ON TABLE "public"."mosques" TO "authenticated";;

GRANT SELECT("prayer_source") ON TABLE "public"."mosques" TO "anon";;

GRANT SELECT("prayer_source") ON TABLE "public"."mosques" TO "authenticated";;

-- Table: subscriptions
CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "mosque_id" "uuid" NOT NULL,
    "price_cents" integer DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'GBP'::"text" NOT NULL,
    "provider" "public"."subscription_provider" DEFAULT 'stripe'::"public"."subscription_provider" NOT NULL,
    "provider_customer_id" "text",
    "provider_subscription_id" "text",
    "status" "public"."subscription_status" DEFAULT 'active'::"public"."subscription_status" NOT NULL,
    "start_date" "date" DEFAULT (("now"() AT TIME ZONE 'utc'::"text"))::"date" NOT NULL,
    "end_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);;

ALTER TABLE "public"."subscriptions" OWNER TO "postgres";;

ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");;

ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_mosque_id_key" UNIQUE ("user_id", "mosque_id");;

CREATE INDEX "idx_subs_mosque" ON "public"."subscriptions" USING "btree" ("mosque_id");;

CREATE INDEX "idx_subs_status" ON "public"."subscriptions" USING "btree" ("status");;

CREATE INDEX "idx_subs_user" ON "public"."subscriptions" USING "btree" ("user_id");;

CREATE POLICY "subs_delete_self" ON "public"."subscriptions" FOR DELETE USING (("auth"."uid"() = "user_id"));;

CREATE POLICY "subs_insert_self" ON "public"."subscriptions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));;

CREATE POLICY "subs_select_self" ON "public"."subscriptions" FOR SELECT USING (("auth"."uid"() = "user_id"));;

ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;;

CREATE POLICY "subscriptions insert own" ON "public"."subscriptions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));;

CREATE POLICY "subscriptions select own" ON "public"."subscriptions" FOR SELECT USING (("auth"."uid"() = "user_id"));;

CREATE POLICY "subscriptions service_role all" ON "public"."subscriptions" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));;

CREATE POLICY "subscriptions update own" ON "public"."subscriptions" FOR UPDATE USING (("auth"."uid"() = "user_id"));;

GRANT ALL ON TABLE "public"."subscriptions" TO "anon";;

GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";;

GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";;

-- Table: streams
CREATE TABLE IF NOT EXISTS "public"."streams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "mosque_id" "uuid" NOT NULL,
    "type" "public"."stream_type" DEFAULT 'hls'::"public"."stream_type" NOT NULL,
    "url" "text" NOT NULL,
    "backup_url" "text",
    "is_live" boolean DEFAULT false NOT NULL,
    "latency_ms" integer,
    "gain_default" numeric(4,2) DEFAULT 1,
    "last_health_check" timestamp with time zone,
    "status" "public"."stream_status" DEFAULT 'active'::"public"."stream_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "current_prayer" "text",
    "started_at" timestamp with time zone,
    "ended_at" timestamp with time zone,
    "stream_url" "text",
    "livekit_room_name" "text"
);;

ALTER TABLE "public"."streams" OWNER TO "postgres";;

ALTER TABLE ONLY "public"."streams"
    ADD CONSTRAINT "streams_pkey" PRIMARY KEY ("id");;

CREATE INDEX "idx_streams_is_live" ON "public"."streams" USING "btree" ("is_live");;

CREATE INDEX "idx_streams_mosque" ON "public"."streams" USING "btree" ("mosque_id");;

CREATE INDEX "idx_streams_mosque_id" ON "public"."streams" USING "btree" ("mosque_id");;

CREATE UNIQUE INDEX "idx_streams_one_row_per_mosque" ON "public"."streams" USING "btree" ("mosque_id");;

CREATE INDEX "idx_streams_status" ON "public"."streams" USING "btree" ("status");;

CREATE UNIQUE INDEX "ux_streams_active_per_mosque" ON "public"."streams" USING "btree" ("mosque_id") WHERE ("status" = 'active'::"public"."stream_status");;

CREATE UNIQUE INDEX "ux_streams_live_per_mosque" ON "public"."streams" USING "btree" ("mosque_id") WHERE ("is_live" = true);;

CREATE POLICY "deny all" ON "public"."streams" USING (false) WITH CHECK (false);;

ALTER TABLE "public"."streams" ENABLE ROW LEVEL SECURITY;;

CREATE POLICY "streams read live" ON "public"."streams" FOR SELECT USING ((("status" = 'active'::"public"."stream_status") AND ("is_live" IS TRUE)));;

CREATE POLICY "streams service_role all" ON "public"."streams" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));;

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."streams" TO "anon";;

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."streams" TO "authenticated";;

GRANT ALL ON TABLE "public"."streams" TO "service_role";;

GRANT SELECT("id") ON TABLE "public"."streams" TO "anon";;

GRANT SELECT("id") ON TABLE "public"."streams" TO "authenticated";;

GRANT SELECT("mosque_id") ON TABLE "public"."streams" TO "anon";;

GRANT SELECT("mosque_id") ON TABLE "public"."streams" TO "authenticated";;

GRANT SELECT("type") ON TABLE "public"."streams" TO "anon";;

GRANT SELECT("type") ON TABLE "public"."streams" TO "authenticated";;

GRANT SELECT("is_live") ON TABLE "public"."streams" TO "anon";;

GRANT SELECT("is_live") ON TABLE "public"."streams" TO "authenticated";;

GRANT SELECT("last_health_check") ON TABLE "public"."streams" TO "anon";;

GRANT SELECT("last_health_check") ON TABLE "public"."streams" TO "authenticated";;

GRANT SELECT("status") ON TABLE "public"."streams" TO "anon";;

GRANT SELECT("status") ON TABLE "public"."streams" TO "authenticated";;

GRANT SELECT("current_prayer") ON TABLE "public"."streams" TO "anon";;

GRANT SELECT("current_prayer") ON TABLE "public"."streams" TO "authenticated";;

GRANT SELECT("started_at") ON TABLE "public"."streams" TO "anon";;

GRANT SELECT("started_at") ON TABLE "public"."streams" TO "authenticated";;

GRANT SELECT("ended_at") ON TABLE "public"."streams" TO "anon";;

GRANT SELECT("ended_at") ON TABLE "public"."streams" TO "authenticated";;

GRANT SELECT("livekit_room_name") ON TABLE "public"."streams" TO "anon";;

GRANT SELECT("livekit_room_name") ON TABLE "public"."streams" TO "authenticated";;

-- Table: muezzins
CREATE TABLE IF NOT EXISTS "public"."muezzins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "mosque_id" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "assigned_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);;

ALTER TABLE "public"."muezzins" OWNER TO "postgres";;

COMMENT ON TABLE "public"."muezzins" IS 'Muezzin assignments: which users can broadcast adhans for which mosque(s).';;

ALTER TABLE ONLY "public"."muezzins"
    ADD CONSTRAINT "muezzins_pkey" PRIMARY KEY ("id");;

ALTER TABLE ONLY "public"."muezzins"
    ADD CONSTRAINT "muezzins_user_id_mosque_id_key" UNIQUE ("user_id", "mosque_id");;

CREATE INDEX "idx_muezzins_mosque" ON "public"."muezzins" USING "btree" ("mosque_id");;

CREATE INDEX "idx_muezzins_user" ON "public"."muezzins" USING "btree" ("user_id");;

CREATE POLICY "muezzin self select" ON "public"."muezzins" FOR SELECT USING (("auth"."uid"() = "user_id"));;

CREATE POLICY "muezzin self update" ON "public"."muezzins" FOR UPDATE USING (("auth"."uid"() = "user_id"));;

CREATE POLICY "muezzin self upsert" ON "public"."muezzins" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));;

CREATE POLICY "muezzin service_role all" ON "public"."muezzins" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));;

CREATE POLICY "muezzin_read_own_assignment" ON "public"."muezzins" FOR SELECT USING (("user_id" = "auth"."uid"()));;

ALTER TABLE "public"."muezzins" ENABLE ROW LEVEL SECURITY;;

CREATE POLICY "self select" ON "public"."muezzins" FOR SELECT USING (("user_id" = "auth"."uid"()));;

CREATE POLICY "self update" ON "public"."muezzins" FOR UPDATE USING (("user_id" = "auth"."uid"()));;

GRANT ALL ON TABLE "public"."muezzins" TO "anon";;

GRANT ALL ON TABLE "public"."muezzins" TO "authenticated";;

GRANT ALL ON TABLE "public"."muezzins" TO "service_role";;

-- Table: adhans
CREATE TABLE IF NOT EXISTS "public"."adhans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "mosque_id" "uuid" NOT NULL,
    "prayer" "public"."prayer_t" NOT NULL,
    "scheduled_at" timestamp with time zone NOT NULL,
    "muezzin_user_id" "uuid",
    "status" "public"."adhan_status" DEFAULT 'scheduled'::"public"."adhan_status" NOT NULL,
    "recording_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source" "text" DEFAULT 'live'::"text",
    "broadcast_started_at" timestamp with time zone,
    "broadcast_ended_at" timestamp with time zone,
    "started_at" timestamp with time zone,
    "ended_at" timestamp with time zone,
    "stream_id" "uuid",
    CONSTRAINT "adhans_source_check" CHECK (("source" = ANY (ARRAY['live'::"text", 'recording'::"text"])))
);;

ALTER TABLE "public"."adhans" OWNER TO "postgres";;

ALTER TABLE ONLY "public"."adhans"
    ADD CONSTRAINT "adhans_pkey" PRIMARY KEY ("id");;

CREATE INDEX "idx_adhans_mosque" ON "public"."adhans" USING "btree" ("mosque_id");;

CREATE INDEX "idx_adhans_mosque_id" ON "public"."adhans" USING "btree" ("mosque_id");;

CREATE INDEX "idx_adhans_mosque_scheduled" ON "public"."adhans" USING "btree" ("mosque_id", "scheduled_at" DESC);;

CREATE INDEX "idx_adhans_mosque_time" ON "public"."adhans" USING "btree" ("mosque_id", "scheduled_at");;

CREATE INDEX "idx_adhans_scheduled_at" ON "public"."adhans" USING "btree" ("scheduled_at");;

CREATE INDEX "idx_adhans_status" ON "public"."adhans" USING "btree" ("status");;

ALTER TABLE "public"."adhans" ENABLE ROW LEVEL SECURITY;;

CREATE POLICY "public_read_adhans" ON "public"."adhans" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."mosques" "m"
  WHERE (("m"."id" = "adhans"."mosque_id") AND ("m"."is_active" = true)))));;

GRANT ALL ON TABLE "public"."adhans" TO "anon";;

GRANT ALL ON TABLE "public"."adhans" TO "authenticated";;

GRANT ALL ON TABLE "public"."adhans" TO "service_role";;

-- Table: adhan_broadcasts
CREATE TABLE IF NOT EXISTS "public"."adhan_broadcasts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "mosque_id" "uuid" NOT NULL,
    "prayer" "text" NOT NULL,
    "scheduled_for" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "started_at" timestamp with time zone,
    "ended_at" timestamp with time zone,
    "started_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "adhan_broadcasts_prayer_check" CHECK (("prayer" = ANY (ARRAY['fajr'::"text", 'dhuhr'::"text", 'asr'::"text", 'maghrib'::"text", 'isha'::"text"]))),
    CONSTRAINT "adhan_broadcasts_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'live'::"text", 'completed'::"text", 'missed'::"text", 'cancelled'::"text"])))
);;

ALTER TABLE "public"."adhan_broadcasts" OWNER TO "postgres";;

ALTER TABLE ONLY "public"."adhan_broadcasts"
    ADD CONSTRAINT "adhan_broadcasts_mosque_id_prayer_scheduled_for_key" UNIQUE ("mosque_id", "prayer", "scheduled_for");;

ALTER TABLE ONLY "public"."adhan_broadcasts"
    ADD CONSTRAINT "adhan_broadcasts_pkey" PRIMARY KEY ("id");;

CREATE INDEX "idx_adhan_broadcasts_mosque_scheduled" ON "public"."adhan_broadcasts" USING "btree" ("mosque_id", "scheduled_for");;

CREATE INDEX "idx_adhan_broadcasts_status_scheduled" ON "public"."adhan_broadcasts" USING "btree" ("status", "scheduled_for");;

ALTER TABLE ONLY "public"."adhan_broadcasts"
    ADD CONSTRAINT "adhan_broadcasts_started_by_fkey" FOREIGN KEY ("started_by") REFERENCES "auth"."users"("id");;

ALTER TABLE "public"."adhan_broadcasts" ENABLE ROW LEVEL SECURITY;;

CREATE POLICY "broadcast select for muezzin" ON "public"."adhan_broadcasts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."muezzins" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND ("m"."mosque_id" = "adhan_broadcasts"."mosque_id") AND ("m"."is_active" = true)))));;

CREATE POLICY "broadcast service_role all" ON "public"."adhan_broadcasts" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));;

CREATE POLICY "broadcast update for muezzin" ON "public"."adhan_broadcasts" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."muezzins" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND ("m"."mosque_id" = "adhan_broadcasts"."mosque_id") AND ("m"."is_active" = true)))));;

CREATE POLICY "muezzin select own mosque" ON "public"."adhan_broadcasts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."muezzins" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND ("m"."mosque_id" = "adhan_broadcasts"."mosque_id") AND ("m"."is_active" = true)))));;

CREATE POLICY "muezzin update own mosque" ON "public"."adhan_broadcasts" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."muezzins" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND ("m"."mosque_id" = "adhan_broadcasts"."mosque_id") AND ("m"."is_active" = true)))));;

GRANT ALL ON TABLE "public"."adhan_broadcasts" TO "anon";;

GRANT ALL ON TABLE "public"."adhan_broadcasts" TO "authenticated";;

GRANT ALL ON TABLE "public"."adhan_broadcasts" TO "service_role";;

-- Table: campaigns
CREATE TABLE IF NOT EXISTS "public"."campaigns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "mosque_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "goal_cents" integer,
    "raised_cents" integer DEFAULT 0 NOT NULL,
    "start_at" timestamp with time zone,
    "end_at" timestamp with time zone,
    "status" "public"."campaign_status" DEFAULT 'active'::"public"."campaign_status" NOT NULL,
    "cover_image_url" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "campaigns_goal_nonneg" CHECK ((("goal_cents" IS NULL) OR ("goal_cents" >= 0))),
    CONSTRAINT "campaigns_raised_nonneg" CHECK (("raised_cents" >= 0)),
    CONSTRAINT "campaigns_status_check" CHECK ((("status")::"text" = ANY (ARRAY['active'::"text", 'paused'::"text", 'ended'::"text"])))
);;

ALTER TABLE "public"."campaigns" OWNER TO "postgres";;

ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id");;

CREATE INDEX "idx_campaigns_mosque_status" ON "public"."campaigns" USING "btree" ("mosque_id", "status");;

ALTER TABLE "public"."campaigns" ENABLE ROW LEVEL SECURITY;;

CREATE POLICY "campaigns select all" ON "public"."campaigns" FOR SELECT USING (true);;

CREATE POLICY "campaigns select followers" ON "public"."campaigns" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."subscriptions" "s"
  WHERE (("s"."mosque_id" = "campaigns"."mosque_id") AND ("s"."user_id" = "auth"."uid"())))));;

CREATE POLICY "campaigns_select_auth" ON "public"."campaigns" FOR SELECT TO "authenticated" USING (true);;

CREATE POLICY "campaigns_select_followers" ON "public"."campaigns" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."subscriptions" "s"
  WHERE (("s"."user_id" = "auth"."uid"()) AND ("s"."mosque_id" = "campaigns"."mosque_id")))));;

CREATE POLICY "deny all" ON "public"."campaigns" USING (false) WITH CHECK (false);;

GRANT ALL ON TABLE "public"."campaigns" TO "anon";;

GRANT ALL ON TABLE "public"."campaigns" TO "authenticated";;

GRANT ALL ON TABLE "public"."campaigns" TO "service_role";;

GRANT SELECT("id") ON TABLE "public"."campaigns" TO "anon";;

GRANT SELECT("id") ON TABLE "public"."campaigns" TO "authenticated";;

GRANT SELECT("mosque_id") ON TABLE "public"."campaigns" TO "anon";;

GRANT SELECT("mosque_id") ON TABLE "public"."campaigns" TO "authenticated";;

GRANT SELECT("title") ON TABLE "public"."campaigns" TO "anon";;

GRANT SELECT("title") ON TABLE "public"."campaigns" TO "authenticated";;

GRANT SELECT("description") ON TABLE "public"."campaigns" TO "anon";;

GRANT SELECT("description") ON TABLE "public"."campaigns" TO "authenticated";;

GRANT SELECT("goal_cents") ON TABLE "public"."campaigns" TO "anon";;

GRANT SELECT("goal_cents") ON TABLE "public"."campaigns" TO "authenticated";;

GRANT SELECT("raised_cents") ON TABLE "public"."campaigns" TO "anon";;

GRANT SELECT("raised_cents") ON TABLE "public"."campaigns" TO "authenticated";;

GRANT SELECT("end_at") ON TABLE "public"."campaigns" TO "anon";;

GRANT SELECT("end_at") ON TABLE "public"."campaigns" TO "authenticated";;

GRANT SELECT("status") ON TABLE "public"."campaigns" TO "authenticated";;

GRANT SELECT("status") ON TABLE "public"."campaigns" TO "anon";;

GRANT SELECT("created_at") ON TABLE "public"."campaigns" TO "anon";;

GRANT SELECT("created_at") ON TABLE "public"."campaigns" TO "authenticated";;

-- Table: donations
CREATE TABLE IF NOT EXISTS "public"."donations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "mosque_id" "uuid" NOT NULL,
    "amount_cents" integer NOT NULL,
    "currency" "text" DEFAULT 'GBP'::"text" NOT NULL,
    "provider" "public"."donation_provider" DEFAULT 'stripe'::"public"."donation_provider" NOT NULL,
    "provider_payment_id" "text",
    "status" "public"."donation_status" DEFAULT 'pending'::"public"."donation_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "donations_amount_positive" CHECK (("amount_cents" > 0)),
    CONSTRAINT "donations_currency_iso" CHECK (("currency" ~ '^[A-Z]{3}$'::"text"))
);;

ALTER TABLE "public"."donations" OWNER TO "postgres";;

ALTER TABLE ONLY "public"."donations"
    ADD CONSTRAINT "donations_pkey" PRIMARY KEY ("id");;

CREATE INDEX "idx_donations_mosque_time" ON "public"."donations" USING "btree" ("mosque_id", "created_at");;

CREATE INDEX "idx_donations_user_time" ON "public"."donations" USING "btree" ("user_id", "created_at");;

CREATE POLICY "deny all" ON "public"."donations" USING (false) WITH CHECK (false);;

ALTER TABLE "public"."donations" ENABLE ROW LEVEL SECURITY;;

GRANT ALL ON TABLE "public"."donations" TO "anon";;

GRANT ALL ON TABLE "public"."donations" TO "authenticated";;

GRANT ALL ON TABLE "public"."donations" TO "service_role";;

-- Table: events
CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "mosque_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "type" "public"."event_type_t" DEFAULT 'other'::"public"."event_type_t" NOT NULL,
    "start_at" timestamp with time zone NOT NULL,
    "end_at" timestamp with time zone,
    "stream_url" "text",
    "registration_url" "text",
    "capacity" integer,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'published'::"text" NOT NULL,
    "is_public" boolean DEFAULT true NOT NULL,
    "location" "text",
    CONSTRAINT "events_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'cancelled'::"text"])))
);;

ALTER TABLE "public"."events" OWNER TO "postgres";;

COMMENT ON COLUMN "public"."events"."location" IS 'Optional venue or room label for public event details.';;

ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");;

CREATE INDEX "idx_events_mosque_time" ON "public"."events" USING "btree" ("mosque_id", "start_at");;

CREATE POLICY "deny all" ON "public"."events" USING (false) WITH CHECK (false);;

ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;;

CREATE POLICY "events select all" ON "public"."events" FOR SELECT USING (true);;

CREATE POLICY "events select followers" ON "public"."events" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."subscriptions" "s"
  WHERE (("s"."mosque_id" = "events"."mosque_id") AND ("s"."user_id" = "auth"."uid"())))));;

CREATE POLICY "events_select_auth" ON "public"."events" FOR SELECT TO "authenticated" USING (true);;

CREATE POLICY "events_select_followers" ON "public"."events" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."subscriptions" "s"
  WHERE (("s"."user_id" = "auth"."uid"()) AND ("s"."mosque_id" = "events"."mosque_id")))));;

GRANT ALL ON TABLE "public"."events" TO "anon";;

GRANT ALL ON TABLE "public"."events" TO "authenticated";;

GRANT ALL ON TABLE "public"."events" TO "service_role";;

GRANT SELECT("id") ON TABLE "public"."events" TO "anon";;

GRANT SELECT("id") ON TABLE "public"."events" TO "authenticated";;

GRANT SELECT("mosque_id") ON TABLE "public"."events" TO "anon";;

GRANT SELECT("mosque_id") ON TABLE "public"."events" TO "authenticated";;

GRANT SELECT("title") ON TABLE "public"."events" TO "anon";;

GRANT SELECT("title") ON TABLE "public"."events" TO "authenticated";;

GRANT SELECT("description") ON TABLE "public"."events" TO "anon";;

GRANT SELECT("description") ON TABLE "public"."events" TO "authenticated";;

GRANT SELECT("start_at") ON TABLE "public"."events" TO "anon";;

GRANT SELECT("start_at") ON TABLE "public"."events" TO "authenticated";;

GRANT SELECT("capacity") ON TABLE "public"."events" TO "anon";;

GRANT SELECT("capacity") ON TABLE "public"."events" TO "authenticated";;

GRANT SELECT("created_at") ON TABLE "public"."events" TO "anon";;

GRANT SELECT("created_at") ON TABLE "public"."events" TO "authenticated";;

GRANT SELECT("status") ON TABLE "public"."events" TO "authenticated";;

GRANT SELECT("status") ON TABLE "public"."events" TO "anon";;

GRANT SELECT("is_public") ON TABLE "public"."events" TO "authenticated";;

GRANT SELECT("is_public") ON TABLE "public"."events" TO "anon";;

GRANT SELECT("location") ON TABLE "public"."events" TO "anon";;

GRANT SELECT("location") ON TABLE "public"."events" TO "authenticated";;

-- Table: follows
CREATE TABLE IF NOT EXISTS "public"."follows" (
    "user_id" "uuid" NOT NULL,
    "mosque_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);;

ALTER TABLE "public"."follows" OWNER TO "postgres";;

ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_pkey" PRIMARY KEY ("user_id", "mosque_id");;

ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;;

ALTER TABLE "public"."follows" ENABLE ROW LEVEL SECURITY;;

CREATE POLICY "follows_delete_self" ON "public"."follows" FOR DELETE USING (("auth"."uid"() = "user_id"));;

CREATE POLICY "follows_insert_self" ON "public"."follows" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));;

CREATE POLICY "follows_select_self" ON "public"."follows" FOR SELECT USING (("auth"."uid"() = "user_id"));;

GRANT ALL ON TABLE "public"."follows" TO "anon";;

GRANT ALL ON TABLE "public"."follows" TO "authenticated";;

GRANT ALL ON TABLE "public"."follows" TO "service_role";;

-- Table: mosque_prayer_times
CREATE TABLE IF NOT EXISTS "public"."mosque_prayer_times" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "mosque_id" "uuid" NOT NULL,
    "prayer_date" "date" NOT NULL,
    "fajr" time without time zone NOT NULL,
    "sunrise" time without time zone,
    "dhuhr" time without time zone NOT NULL,
    "asr" time without time zone NOT NULL,
    "maghrib" time without time zone NOT NULL,
    "isha" time without time zone NOT NULL,
    "source" "text" DEFAULT 'csv'::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);;

ALTER TABLE "public"."mosque_prayer_times" OWNER TO "postgres";;

ALTER TABLE ONLY "public"."mosque_prayer_times"
    ADD CONSTRAINT "mosque_prayer_times_mosque_id_prayer_date_key" UNIQUE ("mosque_id", "prayer_date");;

ALTER TABLE ONLY "public"."mosque_prayer_times"
    ADD CONSTRAINT "mosque_prayer_times_pkey" PRIMARY KEY ("id");;

CREATE POLICY "deny all" ON "public"."mosque_prayer_times" USING (false) WITH CHECK (false);;

ALTER TABLE "public"."mosque_prayer_times" ENABLE ROW LEVEL SECURITY;;

CREATE POLICY "mprayer_select_auth" ON "public"."mosque_prayer_times" FOR SELECT TO "authenticated" USING (true);;

GRANT ALL ON TABLE "public"."mosque_prayer_times" TO "anon";;

GRANT ALL ON TABLE "public"."mosque_prayer_times" TO "authenticated";;

GRANT ALL ON TABLE "public"."mosque_prayer_times" TO "service_role";;

-- Table: recorded_adhans
CREATE TABLE IF NOT EXISTS "public"."recorded_adhans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "mosque_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "duration_sec" integer,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "visibility" "public"."visibility_t" DEFAULT 'public'::"public"."visibility_t" NOT NULL
);;

ALTER TABLE "public"."recorded_adhans" OWNER TO "postgres";;

COMMENT ON TABLE "public"."recorded_adhans" IS 'Each mosque can store its own audio recordings of adhans for fallback or scheduling.';;

ALTER TABLE ONLY "public"."recorded_adhans"
    ADD CONSTRAINT "recorded_adhans_pkey" PRIMARY KEY ("id");;

CREATE INDEX "idx_recorded_adhans_mosque" ON "public"."recorded_adhans" USING "btree" ("mosque_id");;

CREATE INDEX "idx_recorded_adhans_mosque_created" ON "public"."recorded_adhans" USING "btree" ("mosque_id", "created_at" DESC);;

CREATE INDEX "idx_recorded_adhans_visibility" ON "public"."recorded_adhans" USING "btree" ("visibility");;

CREATE POLICY "public_read_recorded_adhans" ON "public"."recorded_adhans" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."mosques" "m"
  WHERE (("m"."id" = "recorded_adhans"."mosque_id") AND ("m"."is_active" = true)))));;

ALTER TABLE "public"."recorded_adhans" ENABLE ROW LEVEL SECURITY;;

CREATE POLICY "recorded_adhans_public_read" ON "public"."recorded_adhans" FOR SELECT USING (("visibility" = 'public'::"public"."visibility_t"));;

GRANT ALL ON TABLE "public"."recorded_adhans" TO "anon";;

GRANT ALL ON TABLE "public"."recorded_adhans" TO "authenticated";;

GRANT ALL ON TABLE "public"."recorded_adhans" TO "service_role";;

-- Table: user_mosque_prefs
CREATE TABLE IF NOT EXISTS "public"."user_mosque_prefs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "mosque_id" "uuid" NOT NULL,
    "volume_percent" integer DEFAULT 100 NOT NULL,
    "muted" boolean DEFAULT false NOT NULL,
    "enabled_prayers" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_mosque_prefs_volume_percent_check" CHECK ((("volume_percent" >= 0) AND ("volume_percent" <= 100)))
);;

ALTER TABLE "public"."user_mosque_prefs" OWNER TO "postgres";;

ALTER TABLE ONLY "public"."user_mosque_prefs"
    ADD CONSTRAINT "user_mosque_prefs_pkey" PRIMARY KEY ("id");;

ALTER TABLE ONLY "public"."user_mosque_prefs"
    ADD CONSTRAINT "user_mosque_prefs_user_id_mosque_id_key" UNIQUE ("user_id", "mosque_id");;

CREATE INDEX "idx_prefs_user_mosque" ON "public"."user_mosque_prefs" USING "btree" ("user_id", "mosque_id");;

CREATE POLICY "deny all" ON "public"."user_mosque_prefs" USING (false) WITH CHECK (false);;

CREATE POLICY "prefs insert own" ON "public"."user_mosque_prefs" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));;

CREATE POLICY "prefs select own" ON "public"."user_mosque_prefs" FOR SELECT USING (("auth"."uid"() = "user_id"));;

CREATE POLICY "prefs service_role all" ON "public"."user_mosque_prefs" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));;

CREATE POLICY "prefs update own" ON "public"."user_mosque_prefs" FOR UPDATE USING (("auth"."uid"() = "user_id"));;

ALTER TABLE "public"."user_mosque_prefs" ENABLE ROW LEVEL SECURITY;;

GRANT ALL ON TABLE "public"."user_mosque_prefs" TO "anon";;

GRANT ALL ON TABLE "public"."user_mosque_prefs" TO "authenticated";;

GRANT ALL ON TABLE "public"."user_mosque_prefs" TO "service_role";;

