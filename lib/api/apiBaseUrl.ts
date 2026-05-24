import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const DEFAULT_SERVER_API_TIMEOUT_MS = Platform.OS === 'web' ? 1500 : 6000;

function normalizePath(path: string) {
  if (!path) return '/';
  if (/^https?:\/\//i.test(path)) return path;
  return path.startsWith('/') ? path : `/${path}`;
}

function extractHost(value: string | null | undefined) {
  if (!value) return null;
  const hostMatch = value.match(/^[a-z]+:\/\/([^/]+)/i);
  if (hostMatch?.[1]) return hostMatch[1];
  return value.replace(/^https?:\/\//i, '').split('/')[0] || null;
}

function normalizeHttpLikeUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    const protocol =
      parsed.protocol === 'exp:' ? 'http:' : parsed.protocol === 'exps:' ? 'https:' : parsed.protocol;

    if (!['http:', 'https:'].includes(protocol)) return null;

    const pathname =
      parsed.pathname && parsed.pathname !== '/'
        ? parsed.pathname.replace(/\/+$/, '')
        : '';

    return `${protocol}//${parsed.host}${pathname}${parsed.search ?? ''}${parsed.hash ?? ''}`;
  } catch {
    return null;
  }
}

function trimTrailingSlashes(value: string) {
  return value.replace(/\/+$/, '');
}

function trimLeadingSlashes(value: string) {
  return value.replace(/^\/+/, '');
}

function joinUrlPath(basePath: string, nextPath: string) {
  const left = trimTrailingSlashes(basePath);
  const right = trimLeadingSlashes(nextPath);
  if (!left) return `/${right}`;
  if (!right) return left || '/';
  return `${left}/${right}`;
}

function addNativeCandidatesFromBase(candidates: Set<string>, baseUrl: string, normalizedPath: string) {
  try {
    const parsed = new URL(baseUrl);
    const origin = `${parsed.protocol}//${parsed.host}`;
    const basePath = trimTrailingSlashes(parsed.pathname || '');

    // Expo tunnels can expose API routes at the origin root even when the
    // app URL itself includes a `/--` path prefix. Prefer the root API path
    // first so native clients do not get stuck on a 404-only `/--/api/*`
    // variant.
    candidates.add(`${origin}${normalizedPath}`);

    const pathVariants = new Set<string>();
    pathVariants.add(basePath);
    pathVariants.add('');

    if (basePath.endsWith('/--')) {
      pathVariants.add(basePath.slice(0, -3));
    } else {
      pathVariants.add(joinUrlPath(basePath, '/--'));
    }

    for (const pathVariant of pathVariants) {
      candidates.add(`${origin}${joinUrlPath(pathVariant, normalizedPath)}`);
    }
  } catch {
    // Ignore malformed dev URLs.
  }
}

function nativeLoopbackBaseFor(value: string | null | undefined) {
  const normalized = normalizeHttpLikeUrl(value);
  if (!normalized) return null;

  try {
    const parsed = new URL(normalized);
    if (!['10.0.2.2', 'localhost', '0.0.0.0', '127.0.0.1', '::1'].includes(parsed.hostname)) {
      return null;
    }

    const pathname = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : '';
    return `${parsed.protocol}//127.0.0.1${parsed.port ? `:${parsed.port}` : ''}${pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

function isNativeLoopbackOnlyBase(value: string | null | undefined) {
  const normalized = normalizeHttpLikeUrl(value);
  if (!normalized) return false;

  try {
    const parsed = new URL(normalized);
    return ['10.0.2.2', 'localhost', '0.0.0.0', '127.0.0.1', '::1'].includes(parsed.hostname);
  } catch {
    return false;
  }
}

function shouldPreferUsbReverseLoopback() {
  if (Platform.OS !== 'android') return false;

  const platformConstants = (Platform as any).constants ?? {};
  const deviceSignature = [
    platformConstants.Brand,
    platformConstants.Fingerprint,
    platformConstants.Manufacturer,
    platformConstants.Model,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const isEmulator = /(generic|sdk_gphone|emulator|ranchu|goldfish)/.test(deviceSignature);
  return !isEmulator;
}

function resolveNativeDevBaseUrls() {
  const bases: string[] = [];
  const addBase = (value: string | null | undefined) => {
    const normalized = normalizeHttpLikeUrl(value);
    if (!normalized) return;
    try {
      const parsed = new URL(normalized);
      if (parsed.hostname === 'localhost') {
        const alias = `${parsed.protocol}//127.0.0.1${parsed.port ? `:${parsed.port}` : ''}${parsed.pathname}${parsed.search}${parsed.hash}`;
        if (!bases.includes(alias)) {
          bases.push(alias);
        }
      }
    } catch {
      // Keep the normalized base below.
    }
    if (!bases.includes(normalized)) {
      bases.push(normalized);
    }
  };
  const constantsHost =
    extractHost((Constants.expoConfig as any)?.hostUri) ||
    extractHost((Constants as any)?.manifest2?.extra?.expoClient?.hostUri) ||
    extractHost((Constants as any)?.manifest?.debuggerHost);

  if (constantsHost) {
    addBase(`http://${constantsHost}`);
  }

  const linkingHost = extractHost(Linking.createURL('/'));
  if (linkingHost && (/:\d+$/.test(linkingHost) || linkingHost.includes('.'))) {
    addBase(`http://${linkingHost}`);
  }

  addBase(Linking.createURL('/'));
  return bases;
}

export function resolveApiUrl(path: string): string | null {
  return resolveApiUrls(path)[0] ?? null;
}

export function createFetchTimeoutSignal(timeoutMs = DEFAULT_SERVER_API_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timeoutId),
  };
}

export async function fetchServerApi(
  input: string | URL,
  init?: RequestInit,
  timeoutMs = DEFAULT_SERVER_API_TIMEOUT_MS
) {
  const controller = new AbortController();
  const timeoutError = new Error(`Server API request timed out after ${timeoutMs}ms.`);
  timeoutError.name = 'AbortError';
  const timeoutId = setTimeout(() => controller.abort(timeoutError), timeoutMs);
  try {
    return await Promise.race([
      fetch(input, {
        ...init,
        signal: controller.signal,
      }),
      new Promise<Response>((_, reject) => {
        const rejectId = setTimeout(() => reject(timeoutError), timeoutMs);
        controller.signal.addEventListener(
          'abort',
          () => {
            clearTimeout(rejectId);
            reject(timeoutError);
          },
          { once: true }
        );
      }),
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}

export function resolveApiUrls(path: string): string[] {
  const normalized = normalizePath(path);
  if (/^https?:\/\//i.test(normalized)) return [normalized];

  const candidates = new Set<string>();

  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    candidates.add(`${window.location.origin}${normalized}`);
    return Array.from(candidates);
  }

  const envBase = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  const preferUsbReverseLoopback = Platform.OS !== 'web' && shouldPreferUsbReverseLoopback();
  const envBaseIsLoopbackOnly = isNativeLoopbackOnlyBase(envBase);

  if (envBase && preferUsbReverseLoopback && !envBaseIsLoopbackOnly) {
    candidates.add(`${envBase.replace(/\/+$/, '')}${normalized}`);
  }

  if (Platform.OS !== 'web') {
    for (const nativeDevBase of resolveNativeDevBaseUrls()) {
      if (preferUsbReverseLoopback) {
        const loopbackBase = nativeLoopbackBaseFor(nativeDevBase);
        if (loopbackBase) {
          addNativeCandidatesFromBase(candidates, loopbackBase, normalized);
        }
      }
      if (!(preferUsbReverseLoopback && isNativeLoopbackOnlyBase(nativeDevBase))) {
        addNativeCandidatesFromBase(candidates, nativeDevBase, normalized);
      }
    }

    if (preferUsbReverseLoopback) {
      const envLoopbackBase = nativeLoopbackBaseFor(envBase);
      if (envLoopbackBase) {
        addNativeCandidatesFromBase(candidates, envLoopbackBase, normalized);
      }
    }
  }

  if (envBase && !(preferUsbReverseLoopback && envBaseIsLoopbackOnly)) {
    candidates.add(`${envBase.replace(/\/+$/, '')}${normalized}`);
  }

  return Array.from(candidates);
}

export function supportsServerApi() {
  return resolveApiUrls('/').length > 0;
}
