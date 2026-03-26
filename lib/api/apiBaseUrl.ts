import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

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

function resolveNativeDevBaseUrl() {
  const linkingUrl = normalizeHttpLikeUrl(Linking.createURL('/'));
  if (linkingUrl) {
    return linkingUrl;
  }

  const constantsHost =
    extractHost((Constants.expoConfig as any)?.hostUri) ||
    extractHost((Constants as any)?.manifest2?.extra?.expoClient?.hostUri) ||
    extractHost((Constants as any)?.manifest?.debuggerHost);

  if (constantsHost) {
    return `http://${constantsHost}`;
  }

  const linkingHost = extractHost(Linking.createURL('/'));
  if (linkingHost && (/:\d+$/.test(linkingHost) || linkingHost.includes('.'))) {
    return `http://${linkingHost}`;
  }

  return null;
}

export function resolveApiUrl(path: string): string | null {
  return resolveApiUrls(path)[0] ?? null;
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
  if (envBase) {
    candidates.add(`${envBase.replace(/\/+$/, '')}${normalized}`);
  }

  if (Platform.OS !== 'web') {
    const linkingBase = normalizeHttpLikeUrl(Linking.createURL('/'));
    if (linkingBase) {
      addNativeCandidatesFromBase(candidates, linkingBase, normalized);
    }

    const nativeDevBase = resolveNativeDevBaseUrl();
    if (nativeDevBase) {
      addNativeCandidatesFromBase(candidates, nativeDevBase, normalized);
    }
  }

  return Array.from(candidates);
}

export function supportsServerApi() {
  return resolveApiUrls('/').length > 0;
}
