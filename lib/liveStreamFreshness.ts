const MAX_LIVE_BROADCAST_MS = 20 * 60 * 1000;

type MaybeLiveStream = {
  is_live?: boolean | null;
  started_at?: string | null;
};

type MaybeLiveAdhan = {
  status?: string | null;
  scheduled_at?: string | null;
  started_at?: string | null;
  broadcast_started_at?: string | null;
  ended_at?: string | null;
  broadcast_ended_at?: string | null;
};

function parseTimestampMs(value?: string | null) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function isFreshLiveReference(referenceAt?: string | null, nowMs = Date.now()) {
  const referenceMs = parseTimestampMs(referenceAt);
  if (referenceMs === null) return true;
  if (referenceMs > nowMs) return true;
  return nowMs - referenceMs <= MAX_LIVE_BROADCAST_MS;
}

export function isFreshLiveStream<T extends MaybeLiveStream>(stream?: T | null, nowMs = Date.now()) {
  if (!stream?.is_live) return false;
  return isFreshLiveReference(stream.started_at, nowMs);
}

export function isFreshLiveAdhan<T extends MaybeLiveAdhan>(adhan?: T | null, nowMs = Date.now()) {
  if (adhan?.status !== 'live') return false;
  if (adhan.ended_at || adhan.broadcast_ended_at) return false;
  return isFreshLiveReference(adhan.started_at ?? adhan.broadcast_started_at ?? adhan.scheduled_at, nowMs);
}

