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

export type LiveKitSubscribeConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed';

export type LiveKitSubscribeState = {
  connectionState: LiveKitSubscribeConnectionState;
  isPlaying: boolean;
  error: string | null;
  diagnostics: LiveKitRuntimeDiagnostics | null;
  setVolume: (volume: number) => void;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
};

type Options = {
  mosqueId: string | null;
  livekitRoomName: string | null;
  autoConnect: boolean;
};

const LIVEKIT_REMOTE_PLAYBACK_GAIN = 2.5;

function forEachCollectionValue(collection: any, callback: (value: any) => void) {
  if (!collection) return;
  if (typeof collection.forEach === 'function') {
    collection.forEach(callback);
    return;
  }
  if (Array.isArray(collection)) {
    collection.forEach(callback);
    return;
  }
  Object.values(collection).forEach(callback);
}

async function selectSpeakerOutput(audioSession: any) {
  try {
    const outputs = typeof audioSession?.getAudioOutputs === 'function'
      ? await audioSession.getAudioOutputs()
      : [];
    if (Array.isArray(outputs) && outputs.includes('speaker')) {
      await audioSession.selectAudioOutput?.('speaker');
      console.log('[LK subscribe] selected speaker output');
    }
  } catch (error: any) {
    console.log('[LK subscribe] speaker output selection skipped', error?.message ?? String(error));
  }
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

async function fetchSubscriberToken(
  mosqueId: string
): Promise<{ token: string; roomName: string; livekitUrl: string }> {
  const endpoints = resolveApiUrls('/api/listener/livekit-token');
  if (!endpoints.length) {
    throw new Error('Could not resolve the LiveKit listener token endpoint.');
  }
  console.log('[LK subscribe] listener token endpoints', endpoints);

  let accessToken = await getAccessToken();
  let lastError: Error | null = null;
  for (const endpoint of endpoints) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        console.log('[LK subscribe] requesting listener token', endpoint);
        const res = await fetchServerApi(
          endpoint,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ mosqueId }),
          },
          10000
        );

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const message = (err as any)?.error ?? `Token request failed (${res.status})`;
          if (attempt === 0 && isExpiredSessionError(res.status, message)) {
            console.warn('[LK subscribe] auth expired; refreshing session and retrying listener token');
            accessToken = await getAccessToken(true);
            continue;
          }
          throw new Error(message);
        }
        return res.json();
      } catch (error: any) {
        lastError = error instanceof Error ? error : new Error(error?.message ?? String(error));
        console.warn('[LK subscribe] listener token endpoint failed', endpoint, lastError.message);
        break;
      }
    }
  }

  throw lastError ?? new Error('Could not request a LiveKit listener token.');
}

function useWebSubscribeStub(): LiveKitSubscribeState {
  return {
    connectionState: 'idle',
    isPlaying: false,
    error: null,
    diagnostics: null,
    setVolume: () => {},
    connect: async () => {},
    disconnect: async () => {},
  };
}

function useNativeSubscribe(options: Options): LiveKitSubscribeState {
  const [connectionState, setConnectionState] = useState<LiveKitSubscribeConnectionState>('idle');
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<LiveKitRuntimeDiagnostics | null>(null);

  const roomRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const remoteTracksRef = useRef<Map<string, any>>(new Map());
  const audioSessionRef = useRef<any>(null);
  const audioSessionStartedRef = useRef(false);
  const activeRoomNameRef = useRef<string | null>(null);
  const diagnosticsRef = useRef<LiveKitRuntimeDiagnostics | null>(null);
  const volumeRef = useRef(LIVEKIT_REMOTE_PLAYBACK_GAIN);
  const connectPromiseRef = useRef<Promise<void> | null>(null);
  const disconnectPromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const setVolume = useCallback((volume: number) => {
    const clamped = Math.max(0, Math.min(1, volume));
    const boosted = Math.min(10, clamped * LIVEKIT_REMOTE_PLAYBACK_GAIN);
    volumeRef.current = boosted;
    remoteTracksRef.current.forEach((track) => {
      try {
        track.setVolume?.(boosted);
      } catch {}
    });
    audioSessionRef.current?.setDefaultRemoteAudioTrackVolume?.(boosted).catch(() => {});
  }, []);

  const disconnect = useCallback(async () => {
    if (disconnectPromiseRef.current) return disconnectPromiseRef.current;

    const disconnectPromise = (async () => {
      console.log('[LK subscribe] disconnect requested', {
        hasRoom: !!roomRef.current,
        activeRoomName: activeRoomNameRef.current,
      });
      if (roomRef.current) {
        try {
          await roomRef.current.disconnect();
        } catch {}
        roomRef.current = null;
      }
      activeRoomNameRef.current = null;
      remoteTracksRef.current.clear();
      if (audioSessionStartedRef.current) {
        try {
          await audioSessionRef.current?.stopAudioSession?.();
        } catch {}
        audioSessionStartedRef.current = false;
        audioSessionRef.current = null;
      }
      if (mountedRef.current) {
        setConnectionState('idle');
        setIsPlaying(false);
        setError(null);
      }
    })();

    disconnectPromiseRef.current = disconnectPromise;
    try {
      await disconnectPromise;
    } finally {
      if (disconnectPromiseRef.current === disconnectPromise) {
        disconnectPromiseRef.current = null;
      }
    }
  }, []);

  const connect = useCallback(async () => {
    if (connectPromiseRef.current) {
      console.log('[LK subscribe] connect() reusing in-flight request');
      return connectPromiseRef.current;
    }

    const connectPromise = (async () => {
    const { mosqueId, livekitRoomName } = options;
    console.log('[LK subscribe] connect() called', {
      mosqueId,
      livekitRoomName,
      hasRoom: !!roomRef.current,
      activeRoomName: activeRoomNameRef.current,
    });

    diagnosticsRef.current = createLiveKitDiagnostics('listener-connect-called');
    if (mountedRef.current) setDiagnostics(diagnosticsRef.current);

    if (!mosqueId || !livekitRoomName) {
      const message = 'Missing mosque or LiveKit room information.';
      diagnosticsRef.current = mergeLiveKitDiagnostics(diagnosticsRef.current, 'listener-aborted', { error: message });
      if (mountedRef.current) {
        setDiagnostics(diagnosticsRef.current);
        setError(message);
        setConnectionState('failed');
      }
      return;
    }

    if (roomRef.current && activeRoomNameRef.current === livekitRoomName) return;
    if (roomRef.current) {
      await disconnect();
    }

    setError(null);
    setConnectionState('connecting');
    diagnosticsRef.current = mergeLiveKitDiagnostics(diagnosticsRef.current, 'listener-runtime-loading');
    if (mountedRef.current) setDiagnostics(diagnosticsRef.current);

    try {
      const runtime = loadLiveKitRuntime();
      diagnosticsRef.current = runtime.diagnostics;
      if (mountedRef.current) setDiagnostics(runtime.diagnostics);
      if (runtime.AudioSession) {
        audioSessionRef.current = runtime.AudioSession;
        if (runtime.AndroidAudioTypePresets?.media) {
          await runtime.AudioSession.configureAudio({
            android: {
              preferredOutputList: ['speaker', 'bluetooth', 'headset', 'earpiece'],
              audioTypeOptions: runtime.AndroidAudioTypePresets.media,
            },
            ios: { defaultOutput: 'speaker' },
          });
        }
        await runtime.AudioSession.setDefaultRemoteAudioTrackVolume?.(volumeRef.current);
        await runtime.AudioSession.startAudioSession();
        audioSessionStartedRef.current = true;
        await selectSpeakerOutput(runtime.AudioSession);
      }

      const tokenData = await fetchSubscriberToken(mosqueId);
      diagnosticsRef.current = mergeLiveKitDiagnostics(diagnosticsRef.current, 'listener-token-ready', {
        steps: [
          ...(diagnosticsRef.current?.steps ?? []),
          `token-room:${tokenData.roomName}`,
          `url:${summarizeLiveKitUrl(tokenData.livekitUrl) ?? 'unknown'}`,
        ],
      });
      if (mountedRef.current) setDiagnostics(diagnosticsRef.current);
      console.log('[LK subscribe] token ready - room:', tokenData.roomName, 'url:', summarizeLiveKitUrl(tokenData.livekitUrl));

      const room = new runtime.Room();
      roomRef.current = room;
      activeRoomNameRef.current = tokenData.roomName;

      room.on(runtime.RoomEvent.Reconnecting, () => {
        diagnosticsRef.current = mergeLiveKitDiagnostics(diagnosticsRef.current, 'listener-room-reconnecting');
        if (mountedRef.current) setDiagnostics(diagnosticsRef.current);
        if (mountedRef.current) setConnectionState('reconnecting');
      });
      room.on(runtime.RoomEvent.Reconnected, () => {
        diagnosticsRef.current = mergeLiveKitDiagnostics(diagnosticsRef.current, 'listener-room-reconnected');
        if (mountedRef.current) setDiagnostics(diagnosticsRef.current);
        if (mountedRef.current) setConnectionState('connected');
      });
      room.on(runtime.RoomEvent.Disconnected, () => {
        remoteTracksRef.current.clear();
        roomRef.current = null;
        activeRoomNameRef.current = null;
        diagnosticsRef.current = mergeLiveKitDiagnostics(diagnosticsRef.current, 'listener-room-disconnected');
        if (mountedRef.current) setDiagnostics(diagnosticsRef.current);
        if (mountedRef.current) {
          setConnectionState('idle');
          setIsPlaying(false);
        }
      });

      const adoptRemoteAudioTrack = (track: any, source = 'event') => {
        if (track.kind === 'audio') {
          const trackId =
            track.sid ??
            track.mediaStreamTrack?.id ??
            `audio-${remoteTracksRef.current.size + 1}`;
          remoteTracksRef.current.set(trackId, track);
          try {
            track.setVolume?.(volumeRef.current);
          } catch {}
          audioSessionRef.current?.setDefaultRemoteAudioTrackVolume?.(volumeRef.current).catch(() => {});
          void selectSpeakerOutput(audioSessionRef.current);
          diagnosticsRef.current = mergeLiveKitDiagnostics(diagnosticsRef.current, 'listener-audio-subscribed', {
            steps: [
              ...(diagnosticsRef.current?.steps ?? []),
              `subscribed:${trackId}`,
              `source:${source}`,
              `playback-gain:${volumeRef.current.toFixed(1)}x`,
            ],
          });
          if (mountedRef.current) setDiagnostics(diagnosticsRef.current);
          console.log('[LK subscribe] audio track subscribed', trackId, source);
          if (mountedRef.current) setIsPlaying(true);
        }
      };

      const adoptPublishedRemoteAudioTracks = () => {
        forEachCollectionValue(room.remoteParticipants, (participant: any) => {
          forEachCollectionValue(participant?.audioTrackPublications, (publication: any) => {
            if (publication?.track) adoptRemoteAudioTrack(publication.track, 'publication-scan');
          });
          forEachCollectionValue(participant?.trackPublications, (publication: any) => {
            if (publication?.kind === 'audio' && publication?.track) {
              adoptRemoteAudioTrack(publication.track, 'publication-scan');
            }
          });
        });
      };

      // Track remote audio publications so we can control volume.
      room.on(runtime.RoomEvent.TrackSubscribed, (track: any) => {
        adoptRemoteAudioTrack(track, 'event');
      });
      room.on(runtime.RoomEvent.TrackUnsubscribed, (track: any) => {
        remoteTracksRef.current.delete(track.sid);
        if (remoteTracksRef.current.size === 0 && mountedRef.current) {
          setIsPlaying(false);
        }
      });

      await room.connect(tokenData.livekitUrl, tokenData.token, {
        autoSubscribe: true, // automatically subscribe to all published tracks
      });
      diagnosticsRef.current = mergeLiveKitDiagnostics(diagnosticsRef.current, 'listener-room-connected');
      if (mountedRef.current) setDiagnostics(diagnosticsRef.current);
      adoptPublishedRemoteAudioTracks();

      if (mountedRef.current) setConnectionState('connected');
    } catch (err) {
      const msg = describeLiveKitError(err);
      console.log('[LK subscribe] connect() error:', msg, describeLiveKitStack(err));
      diagnosticsRef.current = mergeLiveKitDiagnostics(diagnosticsRef.current, 'listener-failed', {
        error: msg,
        stack: describeLiveKitStack(err),
      });
      if (mountedRef.current) {
        setDiagnostics(diagnosticsRef.current);
        setError(msg);
        setConnectionState('failed');
      }
      if (roomRef.current) {
        roomRef.current.disconnect().catch(() => {});
        roomRef.current = null;
      }
      activeRoomNameRef.current = null;
      remoteTracksRef.current.clear();
      if (audioSessionStartedRef.current) {
        try {
          await audioSessionRef.current?.stopAudioSession?.();
        } catch {}
        audioSessionStartedRef.current = false;
        audioSessionRef.current = null;
      }
    }
    })();

    connectPromiseRef.current = connectPromise;
    try {
      await connectPromise;
    } finally {
      if (connectPromiseRef.current === connectPromise) {
        connectPromiseRef.current = null;
      }
    }
  }, [disconnect, options.mosqueId, options.livekitRoomName]);

  // Auto-connect when livekitRoomName appears and autoConnect is true.
  useEffect(() => {
    const { mosqueId, livekitRoomName, autoConnect } = options;
    if (!autoConnect) return;
    if (!mosqueId || !livekitRoomName || !autoConnect) {
      if (!livekitRoomName && roomRef.current) {
        // Room ended; disconnect the listener.
        void disconnect();
      }
      return;
    }
    void connect();
  }, [options.mosqueId, options.livekitRoomName, options.autoConnect, connect, disconnect]);

  // Disconnect on unmount.
  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect().catch(() => {});
        roomRef.current = null;
      }
      activeRoomNameRef.current = null;
      remoteTracksRef.current.clear();
      if (audioSessionStartedRef.current) {
        audioSessionRef.current?.stopAudioSession?.().catch(() => {});
        audioSessionStartedRef.current = false;
        audioSessionRef.current = null;
      }
    };
  }, []);

  return { connectionState, isPlaying, error, diagnostics, setVolume, connect, disconnect };
}

export function useLiveKitSubscribe(options: Options): LiveKitSubscribeState {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useWebSubscribeStub();
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useNativeSubscribe(options);
}
