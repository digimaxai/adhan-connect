// Extensioned: this module is loaded directly by the Deno adhan-delivery-plan
// Edge Function, which requires explicit extensions on relative imports.
import { AdhanAudioAsset, EMPTY_ADHAN_AUDIO_DRAFT, validateAudioDraft } from '../adhanAudio.ts';
import { resolveAdhanScheduleSlots, type MosqueLike } from './adhanSchedulePreview.ts';

type PlannerDb = {
  from: (table: string) => any;
  rpc: (name: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string; message: string } | null }>;
};

export type MosquePlanOutcome = {
  mosqueId: string;
  planned: number;
  unchanged: number;
  skipped: number;
  errors: string[];
};

/** Only ever reads mosque_adhan_audio_activation for the live/scheduler
 * decision of "is this mosque on". mosque_adhan_audio_settings is draft data;
 * this function still reads it for its content (mode/recording/prayers), but
 * only for mosques the activation table says are active — an inactive mosque
 * is never planned even if its draft looks ready. */
export async function planActiveMosqueDeliveries(
  db: PlannerDb,
  readDaily: (request: Request) => Response | Promise<Response>,
  now = new Date().toISOString()
): Promise<MosquePlanOutcome[]> {
  const active = await db.from('mosque_adhan_audio_activation').select('mosque_id').eq('active', true);
  if (active.error) throw new Error(`Could not load active mosques: ${active.error.message}`);
  const mosqueIds: string[] = (active.data ?? []).map((row: { mosque_id: string }) => row.mosque_id);
  const outcomes: MosquePlanOutcome[] = [];
  for (const mosqueId of mosqueIds) {
    const outcome: MosquePlanOutcome = { mosqueId, planned: 0, unchanged: 0, skipped: 0, errors: [] };
    outcomes.push(outcome);
    try {
      const [mosqueResult, settingsResult, assetsResult] = await Promise.all([
        db.from('mosques').select('id,status,time_zone,prayers_not_offered').eq('id', mosqueId).maybeSingle(),
        db.from('mosque_adhan_audio_settings').select('draft_mode,default_asset_id,fajr_asset_id,enabled_prayers,revision').eq('mosque_id', mosqueId).maybeSingle(),
        db.from('adhan_audio_assets').select('id,mosque_id,title,reciter,state,duration_sec,created_at')
          .or(`mosque_id.eq.${mosqueId},mosque_id.is.null`).eq('state', 'ready'),
      ]);
      if (mosqueResult.error || settingsResult.error || assetsResult.error) {
        outcome.errors.push('Could not load mosque/settings/assets.');
        continue;
      }
      const mosque = mosqueResult.data as MosqueLike | null;
      if (!mosque) { outcome.errors.push('Mosque not found.'); continue; }
      const settings = validateAudioDraft(settingsResult.data ?? EMPTY_ADHAN_AUDIO_DRAFT);
      // Activation is a point-in-time confirmation, not a promise the draft
      // never changes again. If an admin has since edited the mode back to
      // live_only, planning safely does nothing rather than trusting a stale
      // activation row — this mosque must be re-activated to resume automation.
      if (settings.draft_mode === 'live_only') { outcome.skipped++; continue; }

      const slots = await resolveAdhanScheduleSlots(db, mosque, settings, (assetsResult.data ?? []) as AdhanAudioAsset[], readDaily, now);
      for (const slot of slots) {
        if (slot.status !== 'ready') { outcome.skipped++; continue; }
        const existing = await db.from('adhan_delivery_occurrences').select('plan_revision')
          .eq('mosque_id', slot.mosqueId).eq('local_date', slot.localDate).eq('prayer', slot.prayer).maybeSingle();
        if (existing.error) { outcome.errors.push(`${slot.prayer} ${slot.localDate}: could not read existing plan.`); continue; }
        const expectedPlanRevision = (existing.data as { plan_revision: number } | null)?.plan_revision ?? 0;
        const result = await db.rpc('plan_adhan_delivery_v1', {
          p_mosque: slot.mosqueId, p_date: slot.localDate, p_prayer: slot.prayer, p_scheduled_at: slot.scheduledAt,
          p_mode: slot.mode, p_settings_revision: slot.settingsRevision, p_recording: slot.recordingId,
          p_expected_plan_revision: expectedPlanRevision,
        });
        if (result.error) { outcome.errors.push(`${slot.prayer} ${slot.localDate}: ${result.error.message}`); continue; }
        const row = result.data as { plan_revision: number } | null;
        if (row && row.plan_revision > expectedPlanRevision) outcome.planned++; else outcome.unchanged++;
      }
    } catch (error) {
      outcome.errors.push(error instanceof Error ? error.message : 'Unknown planning error.');
    }
  }
  return outcomes;
}
