import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import {
  createLiveKitDiagnostics,
  describeLiveKitError,
  describeLiveKitStack,
  loadLiveKitRuntime,
  mergeLiveKitDiagnostics,
  summarizeLiveKitUrl,
  type LiveKitRuntimeDiagnostics,
} from '../livekitRuntime';
import { fetchServerApi, resolveApiUrls } from '../api/apiBaseUrl';
import { supabase } from '../supabase';

export type LiveKitBroadcastConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed';

export type LiveKitBroadcastState = {
  connectionState: LiveKitBroadcastConnectionState;
  audioLevel: number;
  inputGain: number;
  error: string | null;
  diagnostics: LiveKitRuntimeDiagnostics | null;
  setInputGain: (gain: number) => void;
  connect: () => Promise<boolean>;
  disconnect: () => Promise<void>;
};

type Options = {
  mosqueId: string | null;
  prayer: string | null;
  scheduledAt: string | null;
  enabled: boolean;
};

const DEFAULT_INPUT_GAIN = 2;
const MIN_INPUT_GAIN = 0.5;
const MAX_INPUT_GAIN = 4;

function clampInputGain(gain: number) {
  const normalized = Number.isFinite(gain) ? gain : DEFAULT_INPUT_GAIN;
  return Math.max(MIN_INPUT_GAIN, Math.min(MAX_INPUT_GAIN, Math.round(normalized * 10) / 10));
}

function applyLocalAudioTrackGain(track: any, gain: number) {
  const mediaTrack = track?.mediaStreamTrack ?? track?._mediaStreamTrack ?? track;
  try {
    mediaTrack?._setVolume?.(gain);
  } catch {}
}

function ignoreMaybeAsync(action?: () => unknown) {
  try {
    const result = action?.();
    if (result && typeof (result as { then?: unknown }).then === 'function') {
      void Promise.resolve(result).catch(() => {});
    }
  } catch {}
}

function isExpiredSessionError(status: number, message: string) {
  return status === 401 || /session is invalid|session.*expired|jwt.*expired|invalid.*token/i.test(message);
}

async function getAccessToken(forceRefresh = false) {
  if (forceRefresh) {
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session?.access_token) {
      throw new Error('Your session has expired. Please sign in again.');
    }
    return data.session.access_token;
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) return session.access_token;

  return getAccessToken(true);
}

async function fetchPublisherToken(
  mosqueId: string,
  prayer: string,
  scheduledAt: string
): Promise<{ token: string; roomName: string; livekitUrl: string }> {
  const endpoints = resolveApiUrls('/api/muezzin/livekit-token');
  if (!endpoints.length) {
    throw new Error('Could not resolve the LiveKit token endpoint.');
  }
  console.log('[LK] publisher token endpoints', endpoints);

  let accessToken = await getAccessToken();
  let lastError: Error | null = null;
  for (const endpoint of endpoints) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        console.log('[LK] requesting publisher token', endpoint);
        const res = await fetchServerApi(
          endpoint,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ mosqueId, prayer, scheduledAt }),
          },
          10000
        );

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const message = (err as any)?.error ?? `Token request failed (${res.status})`;
          if (attempt === 0 && isExpiredSessionError(res.status, message)) {
            console.warn('[LK] auth expired; refreshing session and retrying publisher token');
            accessToken = await getAccessToken(true);
            continue;
          }
          throw new Error(message);
        }
        return res.json();
      } catch (error: any) {
        lastError = error instanceof Error ? error : new Error(error?.message ?? String(error));
        console.warn('[LK] publisher token endpoint failed', endpoint, lastError.message);
        break;
      }
    }
  }

  throw lastError ?? new Error('Could not request a LiveKit publisher token.');
}

function useWebStub(): LiveKitBroadcastState {
  return {
    connectionState: 'idle',
    audioLevel: 0,
    inputGain: DEFAULT_INPUT_GAIN,
    error: 'Live broadcasting requires the Adhan Connect mobile app.',
    diagnostics: null,
    setInputGain: () => {},
    connect: async () => false,
    disconnect: async () => {},
  };
}

function extractAudioLevelFromStats(stats: any): number {
  let level = 0;
  const visit = (report: any) => {
    if (!report || typeof report !== 'object') return;
    if (typeof report.audioLevel === 'number') {
      level = Math.max(level, report.audioLevel);
    }
    if (typeof report.totalAudioEnergy === 'number' && typeof report.totalSamplesDuration === 'number') {
      const derived = report.totalSamplesDuration > 0
        ? Math.sqrt(report.totalAudioEnergy / report.totalSamplesDuration)
        : 0;
      if (Number.isFinite(derived)) level = Math.max(level, derived);
    }
  };

  if (typeof stats?.forEach === 'function') {
    stats.forEach(visit);
  } else if (Array.isArray(stats)) {
    stats.forEach(visit);
  } else {
    visit(stats);
  }

  return Number.isFinite(level) ? Math.max(0, Math.min(1, level)) : 0;
}

function useNativeBroadcast(options: Options): LiveKitBroadcastState {
  const [connectionState, setConnectionState] = useState<LiveKitBroadcastConnectionState>('idle');
  const [audioLevel, setAudioLevel] = useState(0);
  const [inputGain, setInputGainState] = useState(DEFAULT_INPUT_GAIN);
  const [error, setError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<LiveKitRuntimeDiagnostics | null>(null);

  const roomRef = useRef<any>(null);
  const audioTrackRef = useRef<any>(null);
  const audioLevelTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const diagnosticsRef = useRef<LiveKitRuntimeDiagnostics | null>(null);
  const audioSessionRef = useRef<any>(null);
  const audioSessionStartedRef = useRef(false);
  const connectionStateRef = useRef<LiveKitBroadcastConnectionState>('idle');
  const connectPromiseRef = useRef<Promise<boolean> | null>(null);
  const inputGainRef = useRef(DEFAULT_INPUT_GAIN);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const setLiveConnectionState = useCallback((state: LiveKitBroadcastConnectionState) => {
    connectionStateRef.current = state;
    if (mountedRef.current) setConnectionState(state);
  }, []);

  const pushDiagnostics = useCallback((phase: string, patch: Partial<LiveKitRuntimeDiagnostics> = {}) => {
    const next = mergeLiveKitDiagnostics(diagnosticsRef.current, phase, patch);
    diagnosticsRef.current = next;
    if (mountedRef.current) setDiagnostics(next);
    return next;
  }, []);

  const stopAudioLevelPolling = useCallback(() => {
    if (audioLevelTimerRef.current) {
      clearInterval(audioLevelTimerRef.current);
      audioLevelTimerRef.current = null;
    }
  }, []);

  const startAudioLevelPolling = useCallback((track: any) => {
    stopAudioLevelPolling();
    audioLevelTimerRef.current = setInterval(async () => {
      try {
        const stats = typeof track.getRTCStatsReport === 'function'
          ? await track.getRTCStatsReport()
          : await track.getStats?.();
        const statsLevel = extractAudioLevelFromStats(stats);
        const participantLevel = Number(roomRef.current?.localParticipant?.audioLevel ?? 0);
        const level = Math.max(statsLevel, Number.isFinite(participantLevel) ? participantLevel : 0);
        if (mountedRef.current) setAudioLevel(level);
      } catch {
        if (mountedRef.current) setAudioLevel(0);
      }
    }, 300);
  }, [stopAudioLevelPolling]);

  const setInputGain = useCallback((gain: number) => {
    const next = clampInputGain(gain);
    inputGainRef.current = next;
    if (mountedRef.current) setInputGainState(next);
    applyLocalAudioTrackGain(audioTrackRef.current, next);
  }, []);

  const disconnect = useCallback(async () => {
    const hadActiveLiveKitResources =
      !!roomRef.current || !!audioTrackRef.current || audioSessionStartedRef.current;
    const previousConnectionState = connectionStateRef.current;

    if (!hadActiveLiveKitResources) {
      return;
    }

    stopAudioLevelPolling();
    setAudioLevel(0);

    if (audioTrackRef.current) {
      try {
        await audioTrackRef.current.stop?.();
      } catch {}
      audioTrackRef.current = null;
    }

    if (roomRef.current) {
      try {
        await roomRef.current.disconnect();
      } catch {}
      roomRef.current = null;
    }

    if (mountedRef.current) {
      setLiveConnectionState('idle');
      if (previousConnectionState !== 'failed') {
        setError(null);
      }
      pushDiagnostics('idle');
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Audio } = require('expo-av');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        interruptionModeIOS: 1,
        shouldDuckAndroid: false,
      });
    } catch {}

    if (audioSessionStartedRef.current) {
      try {
        await audioSessionRef.current?.stopAudioSession?.();
      } catch {}
      audioSessionStartedRef.current = false;
      audioSessionRef.current = null;
    }
  }, [pushDiagnostics, setLiveConnectionState, stopAudioLevelPolling]);

  useEffect(() => {
    if (!options.enabled) {
      void disconnect();
    }
  }, [disconnect, options.enabled]);

  const connect = useCallback(async () => {
    if (connectPromiseRef.current) {
      console.log('[LK] connect() reusing in-flight request');
      pushDiagnostics('connect-already-in-flight');
      return connectPromiseRef.current;
    }

    const connectPromise = (async () => {
    const { mosqueId, prayer, scheduledAt } = options;
    console.log('[LK] connect() called - mosqueId:', mosqueId, 'prayer:', prayer, 'hasRoom:', !!roomRef.current);
    diagnosticsRef.current = createLiveKitDiagnostics('connect-called');
    setDiagnostics(diagnosticsRef.current);

    if (!mosqueId || !prayer) {
      console.log('[LK] aborting - missing mosqueId or prayer');
      setError('Missing mosque or prayer information.');
      pushDiagnostics('aborted', { error: 'Missing mosque or prayer information.' });
      return false;
    }

    if (roomRef.current) {
      console.log('[LK] aborting - already connected');
      pushDiagnostics('already-connected');
      return true;
    }

    setError(null);
    setLiveConnectionState('connecting');
    pushDiagnostics('runtime-loading');

    try {
      const runtime = loadLiveKitRuntime();
      diagnosticsRef.current = runtime.diagnostics;
      if (mountedRef.current) setDiagnostics(runtime.diagnostics);
      console.log('[LK] runtime ready:', runtime.diagnostics);
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Audio } = require('expo-av');

      pushDiagnostics('requesting-microphone-permission');
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Microphone permission is required for live broadcast.');
      }

      pushDiagnostics('configuring-audio-session');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        interruptionModeIOS: 1,
        shouldDuckAndroid: false,
      });
      if (runtime.AudioSession) {
        audioSessionRef.current = runtime.AudioSession;
        if (runtime.AndroidAudioTypePresets?.communication) {
          await runtime.AudioSession.configureAudio({
            android: { audioTypeOptions: runtime.AndroidAudioTypePresets.communication },
            ios: { defaultOutput: 'speaker' },
          });
        }
        await runtime.AudioSession.startAudioSession();
        audioSessionStartedRef.current = true;
      }

      pushDiagnostics('requesting-livekit-token');
      const tokenData = await fetchPublisherToken(
        mosqueId,
        prayer,
        scheduledAt ?? new Date().toISOString()
      );
      pushDiagnostics('token-ready', {
        steps: [
          ...(diagnosticsRef.current?.steps ?? []),
          `token-room:${tokenData.roomName}`,
          `url:${summarizeLiveKitUrl(tokenData.livekitUrl) ?? 'unknown'}`,
        ],
      });
      console.log('[LK] token ready - room:', tokenData.roomName, 'url:', summarizeLiveKitUrl(tokenData.livekitUrl));

      const room = new runtime.Room();
      roomRef.current = room;

      room.on(runtime.RoomEvent.Reconnecting, () => {
        pushDiagnostics('room-reconnecting');
        setLiveConnectionState('reconnecting');
      });
      room.on(runtime.RoomEvent.Reconnected, () => {
        pushDiagnostics('room-reconnected');
        setLiveConnectionState('connected');
      });
      room.on(runtime.RoomEvent.Disconnected, () => {
        pushDiagnostics('room-disconnected');
        setLiveConnectionState('idle');
        if (mountedRef.current) {
          setAudioLevel(0);
        }
        stopAudioLevelPolling();
        roomRef.current = null;
        audioTrackRef.current = null;
      });
      room.on(runtime.RoomEvent.ActiveSpeakersChanged, (speakers: any[] = []) => {
        const localParticipant = room.localParticipant;
        const localSpeaker = Array.isArray(speakers)
          ? speakers.find((speaker) => speaker?.sid === localParticipant?.sid || speaker?.identity === localParticipant?.identity)
          : null;
        const level = Number(localSpeaker?.audioLevel ?? localParticipant?.audioLevel ?? 0);
        if (Number.isFinite(level) && mountedRef.current) {
          setAudioLevel(Math.max(0, Math.min(1, level)));
        }
      });

      pushDiagnostics('room-connecting');
      await room.connect(tokenData.livekitUrl, tokenData.token, {
        autoSubscribe: false,
      });
      pushDiagnostics('room-connected');

      pushDiagnostics('creating-local-audio-track');
      const audioTrack = await runtime.createLocalAudioTrack({
        echoCancellation: false,
        noiseSuppression: false,
        voiceIsolation: false,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: 48000,
      });
      applyLocalAudioTrackGain(audioTrack, inputGainRef.current);
      pushDiagnostics('publishing-local-audio-track');
      const publication = await room.localParticipant.publishTrack(audioTrack, {
        audioPreset: runtime.AudioPresets?.music,
        dtx: false,
        red: true,
      });
      audioTrackRef.current = audioTrack;
      pushDiagnostics('microphone-live', {
        steps: [
          ...(diagnosticsRef.current?.steps ?? []),
          `published:${publication?.trackSid ?? publication?.sid ?? 'audio'}`,
          `mic-gain:${inputGainRef.current.toFixed(1)}x`,
        ],
      });

      setLiveConnectionState('connected');
      startAudioLevelPolling(audioTrack);
      return true;
    } catch (err) {
      const msg = describeLiveKitError(err);
      console.log('[LK] connect() error:', msg, describeLiveKitStack(err));
      pushDiagnostics('failed', { error: msg, stack: describeLiveKitStack(err) });
      if (mountedRef.current) {
        setError(msg);
      }
      setLiveConnectionState('failed');
      if (roomRef.current) {
        ignoreMaybeAsync(() => roomRef.current?.disconnect?.());
        roomRef.current = null;
      }
      audioTrackRef.current = null;
      stopAudioLevelPolling();
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { Audio } = require('expo-av');
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: true,
          playsInSilentModeIOS: true,
          interruptionModeIOS: 1,
          shouldDuckAndroid: false,
        });
      } catch {}
      if (audioSessionStartedRef.current) {
        try {
          await audioSessionRef.current?.stopAudioSession?.();
        } catch {}
        audioSessionStartedRef.current = false;
        audioSessionRef.current = null;
      }
      return false;
    }
    })();

    connectPromiseRef.current = connectPromise;
    try {
      return await connectPromise;
    } finally {
      if (connectPromiseRef.current === connectPromise) {
        connectPromiseRef.current = null;
      }
    }
  }, [options, pushDiagnostics, setLiveConnectionState, startAudioLevelPolling, stopAudioLevelPolling]);

  useEffect(() => {
    return () => {
      stopAudioLevelPolling();
      if (audioTrackRef.current) {
        ignoreMaybeAsync(() => audioTrackRef.current?.stop?.());
      }
      if (roomRef.current) {
        ignoreMaybeAsync(() => roomRef.current?.disconnect?.());
      }
    };
  }, [stopAudioLevelPolling]);

  return { connectionState, audioLevel, inputGain, error, diagnostics, setInputGain, connect, disconnect };
}

export function useLiveKitBroadcast(options: Options): LiveKitBroadcastState {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useWebStub();
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useNativeBroadcast(options);
}
