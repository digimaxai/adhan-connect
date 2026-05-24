import { NativeModules, PixelRatio, Platform } from 'react-native';

export type LiveKitRuntimeDiagnostics = {
  phase: string;
  updatedAt: string;
  steps: string[];
  webRTCModulePresent: boolean;
  webRTCModuleKeys: string[];
  reactNativeModuleKeys: string[];
  clientModuleKeys: string[];
  usedReactNativeRegisterGlobals: boolean;
  usedWebRTCFallbackRegisterGlobals: boolean;
  reactNativeLoadError: string | null;
  globals: {
    navigator: boolean;
    navigatorProduct: string | null;
    mediaDevices: boolean;
    getUserMedia: boolean;
    RTCPeerConnection: boolean;
    MediaStream: boolean;
    MediaStreamTrack: boolean;
    window: boolean;
    document: boolean;
    crypto: boolean;
    cryptoRandomUUID: boolean;
    TextEncoder: boolean;
    TextDecoder: boolean;
    ReadableStream: boolean;
    WritableStream: boolean;
    atob: boolean;
    btoa: boolean;
    Event: boolean;
    CustomEvent: boolean;
  };
  error: string | null;
  stack: string | null;
};

type Runtime = {
  Room: any;
  RoomEvent: any;
  createLocalAudioTrack: any;
  AudioPresets?: any;
  AudioSession?: any;
  AndroidAudioTypePresets?: any;
  diagnostics: LiveKitRuntimeDiagnostics;
};

const globalAny = globalThis as any;
let globalsRegistered = false;
let globalsRegisteredVia: 'react-native' | 'webrtc-fallback' | null = null;
const WEBRTC_NATIVE_MODULE_MISSING_MESSAGE =
  'Live broadcasting requires a development build. Expo Go does not include the WebRTC native module.';

function safeKeys(value: unknown, limit = 40): string[] {
  if (!value || (typeof value !== 'object' && typeof value !== 'function')) return [];
  try {
    return Object.keys(value as Record<string, unknown>).slice(0, limit);
  } catch {
    return [];
  }
}

export function describeLiveKitError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown LiveKit error.';
}

export function describeLiveKitStack(error: unknown): string | null {
  if (!(error instanceof Error) || !error.stack) return null;
  return error.stack.split('\n').slice(0, 10).join('\n');
}

export function createLiveKitDiagnostics(phase = 'idle'): LiveKitRuntimeDiagnostics {
  return {
    phase,
    updatedAt: new Date().toISOString(),
    steps: [],
    webRTCModulePresent: !!NativeModules.WebRTCModule,
    webRTCModuleKeys: safeKeys(NativeModules.WebRTCModule),
    reactNativeModuleKeys: [],
    clientModuleKeys: [],
    usedReactNativeRegisterGlobals: false,
    usedWebRTCFallbackRegisterGlobals: false,
    reactNativeLoadError: null,
    globals: collectGlobalDiagnostics(),
    error: null,
    stack: null,
  };
}

export function mergeLiveKitDiagnostics(
  previous: LiveKitRuntimeDiagnostics | null,
  phase: string,
  patch: Partial<LiveKitRuntimeDiagnostics> = {}
): LiveKitRuntimeDiagnostics {
  return {
    ...(previous ?? createLiveKitDiagnostics()),
    ...patch,
    phase,
    updatedAt: new Date().toISOString(),
    globals: patch.globals ?? collectGlobalDiagnostics(),
  };
}

export function summarizeLiveKitUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return url.replace(/^(wss?:\/\/[^/?#]+).*$/i, '$1');
  }
}

function collectGlobalDiagnostics(): LiveKitRuntimeDiagnostics['globals'] {
  return {
    navigator: typeof globalAny.navigator === 'object' && !!globalAny.navigator,
    navigatorProduct:
      typeof globalAny.navigator?.product === 'string' ? globalAny.navigator.product : null,
    mediaDevices: typeof globalAny.navigator?.mediaDevices === 'object',
    getUserMedia: typeof globalAny.navigator?.mediaDevices?.getUserMedia === 'function',
    RTCPeerConnection: typeof globalAny.RTCPeerConnection === 'function',
    MediaStream: typeof globalAny.MediaStream === 'function',
    MediaStreamTrack: typeof globalAny.MediaStreamTrack === 'function',
    window: typeof globalAny.window !== 'undefined',
    document: typeof globalAny.document !== 'undefined',
    crypto: typeof globalAny.crypto === 'object' && !!globalAny.crypto,
    cryptoRandomUUID: typeof globalAny.crypto?.randomUUID === 'function',
    TextEncoder: typeof globalAny.TextEncoder === 'function',
    TextDecoder: typeof globalAny.TextDecoder === 'function',
    ReadableStream: typeof globalAny.ReadableStream === 'function',
    WritableStream: typeof globalAny.WritableStream === 'function',
    atob: typeof globalAny.atob === 'function',
    btoa: typeof globalAny.btoa === 'function',
    Event: typeof globalAny.Event === 'function',
    CustomEvent: typeof globalAny.CustomEvent === 'function',
  };
}

function addStep(diagnostics: LiveKitRuntimeDiagnostics, step: string) {
  diagnostics.steps = [...diagnostics.steps, step];
  diagnostics.updatedAt = new Date().toISOString();
  diagnostics.globals = collectGlobalDiagnostics();
}

function throwMissingWebRTCNativeModule(diagnostics: LiveKitRuntimeDiagnostics): never {
  diagnostics.error = WEBRTC_NATIVE_MODULE_MISSING_MESSAGE;
  diagnostics.stack = null;
  diagnostics.webRTCModulePresent = false;
  diagnostics.webRTCModuleKeys = [];
  addStep(diagnostics, 'webrtc-native-module-missing');
  throw new Error(WEBRTC_NATIVE_MODULE_MISSING_MESSAGE);
}

function installBasePolyfills(diagnostics: LiveKitRuntimeDiagnostics) {
  if (!globalAny.navigator || typeof globalAny.navigator !== 'object') {
    globalAny.navigator = {};
  }
  if (!globalAny.navigator.product) {
    globalAny.navigator.product = 'ReactNative';
  }
  if (typeof globalAny.window === 'undefined') {
    globalAny.window = globalAny;
  }
  if (globalAny.window && !globalAny.window.navigator) {
    globalAny.window.navigator = globalAny.navigator;
  }
  if (!globalAny.LiveKitReactNativeGlobal) {
    globalAny.LiveKitReactNativeGlobal = {
      platform: Platform.OS,
      devicePixelRatio: PixelRatio.get(),
    };
  }

  installDomEventFallbacks(diagnostics);

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react-native-url-polyfill').setupURLPolyfill();
    addStep(diagnostics, 'url-polyfill');
  } catch {}

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('promise.allsettled').shim();
    addStep(diagnostics, 'promise-allsettled-polyfill');
  } catch {}

  try {
    if (!Array.prototype.at) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('array.prototype.at').shim();
      addStep(diagnostics, 'array-at-polyfill');
    }
  } catch {}

  try {
    if (
      typeof globalAny.ReadableStream === 'undefined' ||
      typeof globalAny.WritableStream === 'undefined'
    ) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const streams = require('web-streams-polyfill');
      globalAny.ReadableStream = globalAny.ReadableStream ?? streams.ReadableStream;
      globalAny.WritableStream = globalAny.WritableStream ?? streams.WritableStream;
      addStep(diagnostics, 'web-streams-polyfill');
    }
  } catch {}

  if (!globalAny.crypto) {
    globalAny.crypto = {};
  }
  if (typeof globalAny.crypto.randomUUID !== 'function') {
    globalAny.crypto.randomUUID = () =>
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char: string) => {
        const random = (Math.random() * 16) | 0;
        const value = char === 'x' ? random : (random & 0x3) | 0x8;
        return value.toString(16);
      });
    addStep(diagnostics, 'crypto-randomuuid-polyfill');
  }

  if (typeof globalAny.atob !== 'function' || typeof globalAny.btoa !== 'function') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const base64 = require('base64-js');
      globalAny.atob =
        globalAny.atob ??
        ((input: string) => {
          const bytes = base64.toByteArray(input);
          return Array.from(bytes as Uint8Array, (byte: number) => String.fromCharCode(byte)).join('');
        });
      globalAny.btoa =
        globalAny.btoa ??
        ((input: string) => {
          const bytes = new Uint8Array(input.length);
          for (let index = 0; index < input.length; index += 1) {
            bytes[index] = input.charCodeAt(index) & 0xff;
          }
          return base64.fromByteArray(bytes);
        });
      addStep(diagnostics, 'base64-polyfill');
    } catch {}
  }

  if (
    typeof globalAny.TextEncoder !== 'function' ||
    typeof globalAny.TextDecoder !== 'function'
  ) {
    installTextEncodingFallback();
    addStep(diagnostics, 'text-encoding-fallback');
  }
}

function installDomEventFallbacks(diagnostics: LiveKitRuntimeDiagnostics) {
  if (typeof globalAny.Event !== 'function' && NativeModules.WebRTCModule) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const webRTC = require('@livekit/react-native-webrtc');
      if (typeof webRTC.Event === 'function') {
        globalAny.Event = webRTC.Event;
        addStep(diagnostics, 'webrtc-event-polyfill');
      }
      if (typeof globalAny.EventTarget !== 'function' && typeof webRTC.EventTarget === 'function') {
        globalAny.EventTarget = webRTC.EventTarget;
        addStep(diagnostics, 'webrtc-eventtarget-polyfill');
      }
    } catch {}
  }

  if (typeof globalAny.Event !== 'function') {
    globalAny.Event = class Event {
      static NONE = 0;
      static CAPTURING_PHASE = 1;
      static AT_TARGET = 2;
      static BUBBLING_PHASE = 3;

      type: string;
      bubbles: boolean;
      cancelable: boolean;
      composed: boolean;
      currentTarget: unknown = null;
      defaultPrevented = false;
      eventPhase = 0;
      isTrusted = false;
      target: unknown = null;
      timeStamp = Date.now();

      constructor(type: string, init: { bubbles?: boolean; cancelable?: boolean; composed?: boolean } = {}) {
        this.type = String(type);
        this.bubbles = !!init.bubbles;
        this.cancelable = !!init.cancelable;
        this.composed = !!init.composed;
      }

      composedPath() {
        return [];
      }

      preventDefault() {
        if (this.cancelable) this.defaultPrevented = true;
      }

      stopImmediatePropagation() {}

      stopPropagation() {}
    };
    addStep(diagnostics, 'event-fallback-polyfill');
  }

  if (typeof globalAny.CustomEvent !== 'function') {
    globalAny.CustomEvent = class CustomEvent extends globalAny.Event {
      detail: unknown;

      constructor(
        type: string,
        init: { bubbles?: boolean; cancelable?: boolean; composed?: boolean; detail?: unknown } = {}
      ) {
        super(type, init);
        this.detail = init.detail;
      }
    };
    addStep(diagnostics, 'customevent-fallback-polyfill');
  }

  if (globalAny.window) {
    globalAny.window.Event = globalAny.window.Event ?? globalAny.Event;
    globalAny.window.CustomEvent = globalAny.window.CustomEvent ?? globalAny.CustomEvent;
    if (globalAny.EventTarget) {
      globalAny.window.EventTarget = globalAny.window.EventTarget ?? globalAny.EventTarget;
    }
  }
}

function installTextEncodingFallback() {
  if (typeof globalAny.TextEncoder !== 'function') {
    globalAny.TextEncoder = class TextEncoder {
      encode(input = '') {
        const value = unescape(encodeURIComponent(String(input)));
        const bytes = new Uint8Array(value.length);
        for (let index = 0; index < value.length; index += 1) {
          bytes[index] = value.charCodeAt(index);
        }
        return bytes;
      }
    };
  }

  if (typeof globalAny.TextDecoder !== 'function') {
    globalAny.TextDecoder = class TextDecoder {
      decode(input?: Uint8Array | ArrayBuffer | null) {
        if (!input) return '';
        const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
        let value = '';
        for (let index = 0; index < bytes.length; index += 1) {
          value += String.fromCharCode(bytes[index]);
        }
        return decodeURIComponent(escape(value));
      }
    };
  }
}

function assertClientExports(client: any) {
  if (!client?.Room) throw new Error('livekit-client Room export is missing.');
  if (!client?.RoomEvent) throw new Error('livekit-client RoomEvent export is missing.');
  if (!client?.createLocalAudioTrack) {
    throw new Error('livekit-client createLocalAudioTrack export is missing.');
  }
}

export function loadLiveKitRuntime(): Runtime {
  const diagnostics = createLiveKitDiagnostics('runtime-loading');
  diagnostics.usedReactNativeRegisterGlobals = globalsRegisteredVia === 'react-native';
  diagnostics.usedWebRTCFallbackRegisterGlobals = globalsRegisteredVia === 'webrtc-fallback';
  installBasePolyfills(diagnostics);

  if (!NativeModules.WebRTCModule) {
    throwMissingWebRTCNativeModule(diagnostics);
  }

  let reactNativeSdk: any = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    reactNativeSdk = require('@livekit/react-native');
    diagnostics.reactNativeModuleKeys = safeKeys(reactNativeSdk);
    addStep(diagnostics, '@livekit/react-native loaded');
    if (!globalsRegistered && typeof reactNativeSdk.registerGlobals === 'function') {
      reactNativeSdk.registerGlobals({ autoConfigureAudioSession: false });
      globalsRegistered = true;
      globalsRegisteredVia = 'react-native';
      diagnostics.usedReactNativeRegisterGlobals = true;
      addStep(diagnostics, '@livekit/react-native registerGlobals');
    }
  } catch (error) {
    diagnostics.reactNativeLoadError = describeLiveKitError(error);
    diagnostics.stack = describeLiveKitStack(error);
    addStep(diagnostics, '@livekit/react-native load failed');
    console.warn('[LK] @livekit/react-native load failed', diagnostics.reactNativeLoadError);
  }

  if (!globalsRegistered) {
    // Fallback avoids the React component package path and registers only WebRTC globals.
    if (!NativeModules.WebRTCModule) {
      throwMissingWebRTCNativeModule(diagnostics);
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const webRTC = require('@livekit/react-native-webrtc');
    diagnostics.webRTCModuleKeys = safeKeys(NativeModules.WebRTCModule);
    if (typeof webRTC.registerGlobals !== 'function') {
      throw new Error('@livekit/react-native-webrtc registerGlobals export is missing.');
    }
    webRTC.registerGlobals();
    globalsRegistered = true;
    globalsRegisteredVia = 'webrtc-fallback';
    diagnostics.usedWebRTCFallbackRegisterGlobals = true;
    addStep(diagnostics, '@livekit/react-native-webrtc registerGlobals');
  }

  diagnostics.usedReactNativeRegisterGlobals = globalsRegisteredVia === 'react-native';
  diagnostics.usedWebRTCFallbackRegisterGlobals = globalsRegisteredVia === 'webrtc-fallback';

  if (!NativeModules.WebRTCModule) {
    throwMissingWebRTCNativeModule(diagnostics);
  }

  installBasePolyfills(diagnostics);

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const client = require('livekit-client');
  diagnostics.clientModuleKeys = safeKeys(client);
  assertClientExports(client);
  addStep(diagnostics, 'livekit-client loaded');

  diagnostics.phase = 'runtime-ready';
  diagnostics.updatedAt = new Date().toISOString();
  diagnostics.globals = collectGlobalDiagnostics();

  return {
    Room: client.Room,
    RoomEvent: client.RoomEvent,
    createLocalAudioTrack: client.createLocalAudioTrack,
    AudioPresets: client.AudioPresets,
    AudioSession: reactNativeSdk?.AudioSession,
    AndroidAudioTypePresets: reactNativeSdk?.AndroidAudioTypePresets,
    diagnostics,
  };
}
