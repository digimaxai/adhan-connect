-- Ensure each listener has only one Jumu'ah plan per mosque per Friday.

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY mosque_id, user_id, friday_date
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS rn
  FROM public.jumuah_attendance_intents
)
DELETE FROM public.jumuah_attendance_intents jai
USING ranked
WHERE jai.id = ranked.id
  AND ranked.rn > 1;

ALTER TABLE public.jumuah_attendance_intents
  DROP CONSTRAINT IF EXISTS jumuah_attendance_intents_slot_id_user_id_friday_date_key;

ALTER TABLE public.jumuah_attendance_intents
  DROP CONSTRAINT IF EXISTS jumuah_attendance_intents_slot_user_friday_unique;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'jumuah_attendance_intents_mosque_user_friday_unique'
      AND conrelid = 'public.jumuah_attendance_intents'::regclass
  ) THEN
    ALTER TABLE public.jumuah_attendance_intents
      ADD CONSTRAINT jumuah_attendance_intents_mosque_user_friday_unique
      UNIQUE (mosque_id, user_id, friday_date);
  END IF;
END $$;
