const MAX_UPSTREAM_REDIRECTS = 3;
const PLAYBACK_PREFIX_LIMIT_BYTES = 1024;
const PLAYBACK_PREFIX_MIN_DECISION_BYTES = 16;
const PLAYBACK_PREFIX_TIMEOUT_MS = 5000;
const HLS_MARKER = '#EXTM3U';

type HostRule =
  | { kind: 'exact'; hostname: string }
  | { kind: 'suffix'; hostname: string };

type FetchAllowedUpstreamOptions = {
  method: 'GET' | 'HEAD';
  headers?: HeadersInit;
  signal?: AbortSignal;
  rejectHls?: boolean;
};

export class LiveStreamUpstreamError extends Error {
  readonly status: number;
  readonly code:
    | 'UPSTREAM_POLICY_CONFIGURATION'
    | 'UPSTREAM_NOT_ALLOWED'
    | 'UPSTREAM_REDIRECT'
    | 'UPSTREAM_FETCH_FAILED'
    | 'UPSTREAM_TIMEOUT'
    | 'UPSTREAM_RESPONSE_UNSUPPORTED'
    | 'HLS_PLAYBACK_UNSUPPORTED';

  constructor(
    code: LiveStreamUpstreamError['code'],
    message: string,
    status: number
  ) {
    super(message);
    this.name = 'LiveStreamUpstreamError';
    this.code = code;
    this.status = status;
  }
}

function normalizeHostname(value: string) {
  const trimmed = value.trim().toLowerCase();
  const withoutBrackets =
    trimmed.startsWith('[') && trimmed.endsWith(']')
      ? trimmed.slice(1, -1)
      : trimmed;
  return withoutBrackets.replace(/\.+$/, '');
}

function parseIpv4(hostname: string) {
  const parts = hostname.split('.');
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => Number(part));
  if (
    octets.some(
      (octet, index) =>
        !Number.isInteger(octet) ||
        octet < 0 ||
        octet > 255 ||
        String(octet) !== parts[index]
    )
  ) {
    return null;
  }
  return octets;
}

function parseIpv6(hostname: string) {
  if (!hostname.includes(':') || hostname.includes('%')) return null;

  let normalized = hostname;
  const embeddedIpv4Match = normalized.match(/(?:^|:)(\d+\.\d+\.\d+\.\d+)$/);
  if (embeddedIpv4Match) {
    const octets = parseIpv4(embeddedIpv4Match[1]);
    if (!octets) return null;
    const high = ((octets[0] << 8) | octets[1]).toString(16);
    const low = ((octets[2] << 8) | octets[3]).toString(16);
    normalized = `${normalized.slice(0, -embeddedIpv4Match[1].length)}${high}:${low}`;
  }

  if ((normalized.match(/::/g) ?? []).length > 1) return null;
  const [leftRaw, rightRaw] = normalized.split('::');
  const left = leftRaw ? leftRaw.split(':') : [];
  const right = rightRaw ? rightRaw.split(':') : [];
  const isValidWord = (word: string) => /^[a-f0-9]{1,4}$/i.test(word);
  if (!left.every(isValidWord) || !right.every(isValidWord)) return null;

  const missingWords = normalized.includes('::') ? 8 - left.length - right.length : 0;
  if (
    (!normalized.includes('::') && left.length !== 8) ||
    (normalized.includes('::') && missingWords < 1)
  ) {
    return null;
  }

  return [
    ...left.map((word) => Number.parseInt(word, 16)),
    ...Array.from({ length: missingWords }, () => 0),
    ...right.map((word) => Number.parseInt(word, 16)),
  ];
}

function isBlockedIpv4(octets: number[]) {
  const [first, second] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 192 && second === 0) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224
  );
}

function isBlockedIpLiteral(hostname: string) {
  const ipv4 = parseIpv4(hostname);
  if (ipv4) return isBlockedIpv4(ipv4);

  const ipv6 = parseIpv6(hostname);
  if (!ipv6) return false;

  const isUnspecified = ipv6.every((word) => word === 0);
  const isLoopback =
    ipv6.slice(0, 7).every((word) => word === 0) && ipv6[7] === 1;
  const isUniqueLocal = (ipv6[0] & 0xfe00) === 0xfc00;
  const isLinkLocal = (ipv6[0] & 0xffc0) === 0xfe80;
  const isDeprecatedSiteLocal = (ipv6[0] & 0xffc0) === 0xfec0;
  const isMulticast = (ipv6[0] & 0xff00) === 0xff00;
  const isDocumentation = ipv6[0] === 0x2001 && ipv6[1] === 0x0db8;
  const hasEmbeddedIpv4 =
    ipv6.slice(0, 5).every((word) => word === 0) &&
    (ipv6[5] === 0 || ipv6[5] === 0xffff);
  const embeddedIpv4 = hasEmbeddedIpv4
    ? [ipv6[6] >> 8, ipv6[6] & 0xff, ipv6[7] >> 8, ipv6[7] & 0xff]
    : null;

  return (
    isUnspecified ||
    isLoopback ||
    isUniqueLocal ||
    isLinkLocal ||
    isDeprecatedSiteLocal ||
    isMulticast ||
    isDocumentation ||
    (embeddedIpv4 ? isBlockedIpv4(embeddedIpv4) : false)
  );
}

function isBlockedLocalHostname(hostname: string) {
  return (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname === 'home.arpa' ||
    hostname.endsWith('.home.arpa') ||
    (!hostname.includes('.') && !parseIpv4(hostname) && !parseIpv6(hostname))
  );
}

function parseHostRules(rawValue = process.env.LIVE_STREAM_UPSTREAM_ALLOWED_HOSTS) {
  const entries = (rawValue ?? '')
    .split(',')
    .map((entry: string) => entry.trim())
    .filter(Boolean);

  if (!entries.length) {
    throw new LiveStreamUpstreamError(
      'UPSTREAM_POLICY_CONFIGURATION',
      'Live stream upstream access is not configured on this server.',
      503
    );
  }

  return entries.map<HostRule>((entry: string) => {
    const isSuffix = entry.startsWith('*.') || entry.startsWith('.');
    const unprefixed = entry.startsWith('*.')
      ? entry.slice(2)
      : entry.startsWith('.')
        ? entry.slice(1)
        : entry;
    const hostname = normalizeHostname(unprefixed);

    if (
      !hostname ||
      /[\s/?#@]/.test(hostname) ||
      hostname.includes('*') ||
      (hostname.includes(':') && !parseIpv6(hostname)) ||
      (isSuffix && (parseIpv4(hostname) || parseIpv6(hostname)))
    ) {
      throw new LiveStreamUpstreamError(
        'UPSTREAM_POLICY_CONFIGURATION',
        'Live stream upstream host allowlist configuration is invalid.',
        503
      );
    }

    return isSuffix
      ? { kind: 'suffix', hostname }
      : { kind: 'exact', hostname };
  });
}

function isHostnameAllowed(hostname: string, rules: HostRule[]) {
  return rules.some((rule) =>
    rule.kind === 'exact'
      ? hostname === rule.hostname
      : hostname.endsWith(`.${rule.hostname}`)
  );
}

export function isHlsPlaybackUrl(url: URL) {
  let pathname = url.pathname;
  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    // Keep the encoded path. A malformed escape is not treated as an HLS path,
    // but the URL must still pass the host and protocol policy.
  }
  return /\.m3u8(?:$|[;/])/i.test(pathname);
}

export function assertAllowedLiveStreamUpstreamUrl(
  value: string | URL,
  options: { rejectHls?: boolean; allowedHosts?: string } = {}
) {
  let url: URL;
  try {
    url = value instanceof URL ? new URL(value.toString()) : new URL(value);
  } catch {
    throw new LiveStreamUpstreamError(
      'UPSTREAM_NOT_ALLOWED',
      'Live stream upstream URL is invalid.',
      502
    );
  }

  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username ||
    url.password
  ) {
    throw new LiveStreamUpstreamError(
      'UPSTREAM_NOT_ALLOWED',
      'Live stream upstream URL is not allowed.',
      502
    );
  }

  const hostname = normalizeHostname(url.hostname);
  if (
    !hostname ||
    isBlockedIpLiteral(hostname) ||
    isBlockedLocalHostname(hostname)
  ) {
    throw new LiveStreamUpstreamError(
      'UPSTREAM_NOT_ALLOWED',
      'Live stream upstream URL is not allowed.',
      502
    );
  }

  const rules = parseHostRules(options.allowedHosts);
  if (!isHostnameAllowed(hostname, rules)) {
    throw new LiveStreamUpstreamError(
      'UPSTREAM_NOT_ALLOWED',
      'Live stream upstream host is not approved by server configuration.',
      502
    );
  }

  if (options.rejectHls && isHlsPlaybackUrl(url)) {
    throw new LiveStreamUpstreamError(
      'HLS_PLAYBACK_UNSUPPORTED',
      'External HLS listener playback is not available. Use LiveKit or an approved continuous audio endpoint.',
      415
    );
  }

  return url;
}

function isRedirectStatus(status: number) {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

export async function fetchAllowedLiveStreamUpstream(
  value: string | URL,
  options: FetchAllowedUpstreamOptions
) {
  let currentUrl = assertAllowedLiveStreamUpstreamUrl(value, {
    rejectHls: options.rejectHls,
  });

  for (let redirectCount = 0; ; redirectCount += 1) {
    let response: Response;
    try {
      response = await fetch(currentUrl, {
        method: options.method,
        headers: options.headers,
        signal: options.signal,
        redirect: 'manual',
      });
    } catch (error) {
      if (error instanceof LiveStreamUpstreamError) throw error;
      const timedOut = error instanceof Error && error.name === 'AbortError';
      throw new LiveStreamUpstreamError(
        timedOut ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_FETCH_FAILED',
        timedOut
          ? 'Live stream upstream request timed out.'
          : 'Live stream upstream could not be reached.',
        timedOut ? 504 : 502
      );
    }

    if (!isRedirectStatus(response.status)) {
      return { response, finalUrl: currentUrl };
    }

    if (redirectCount >= MAX_UPSTREAM_REDIRECTS) {
      await response.body?.cancel().catch(() => {});
      throw new LiveStreamUpstreamError(
        'UPSTREAM_REDIRECT',
        'Live stream upstream returned too many redirects.',
        502
      );
    }

    const location = response.headers.get('location');
    await response.body?.cancel().catch(() => {});
    if (!location) {
      throw new LiveStreamUpstreamError(
        'UPSTREAM_REDIRECT',
        'Live stream upstream returned an invalid redirect.',
        502
      );
    }

    let redirectedUrl: URL;
    try {
      redirectedUrl = new URL(location, currentUrl);
    } catch {
      throw new LiveStreamUpstreamError(
        'UPSTREAM_REDIRECT',
        'Live stream upstream returned an invalid redirect.',
        502
      );
    }
    currentUrl = assertAllowedLiveStreamUpstreamUrl(redirectedUrl, {
      rejectHls: options.rejectHls,
    });
  }
}

export function isHlsPlaybackContentType(contentType: string | null) {
  const mediaType = (contentType ?? '').split(';', 1)[0].trim().toLowerCase();
  return (
    mediaType === 'application/vnd.apple.mpegurl' ||
    mediaType === 'application/x-mpegurl' ||
    mediaType === 'application/mpegurl' ||
    mediaType === 'audio/mpegurl' ||
    mediaType === 'audio/x-mpegurl'
  );
}

function concatChunks(chunks: Uint8Array[], totalLength: number) {
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return combined;
}

async function readWithTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>
) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () =>
            reject(
              new LiveStreamUpstreamError(
                'UPSTREAM_TIMEOUT',
                'Live stream upstream did not start sending audio in time.',
                504
              )
            ),
          PLAYBACK_PREFIX_TIMEOUT_MS
        );
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function replayBody(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  prefixChunks: Uint8Array[]
) {
  let prefixIndex = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (prefixIndex < prefixChunks.length) {
        controller.enqueue(prefixChunks[prefixIndex]);
        prefixIndex += 1;
        return;
      }

      try {
        const next = await reader.read();
        if (next.done) {
          controller.close();
        } else {
          controller.enqueue(next.value);
        }
      } catch (error) {
        controller.error(error);
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

export async function prepareContinuousPlaybackBody(
  response: Response,
  method: 'GET' | 'HEAD'
) {
  if (response.status === 206 || response.headers.has('content-range')) {
    await response.body?.cancel().catch(() => {});
    throw new LiveStreamUpstreamError(
      'UPSTREAM_RESPONSE_UNSUPPORTED',
      'Live stream upstream returned an unsupported partial response.',
      502
    );
  }

  if (isHlsPlaybackContentType(response.headers.get('content-type'))) {
    await response.body?.cancel().catch(() => {});
    throw new LiveStreamUpstreamError(
      'HLS_PLAYBACK_UNSUPPORTED',
      'External HLS listener playback is not available. Use LiveKit or an approved continuous audio endpoint.',
      415
    );
  }

  if (method === 'HEAD' || !response.body) return null;

  const reader = response.body.getReader();
  const prefixChunks: Uint8Array[] = [];
  let totalLength = 0;

  try {
    while (totalLength < PLAYBACK_PREFIX_LIMIT_BYTES) {
      const next = await readWithTimeout(reader);
      if (next.done) break;
      prefixChunks.push(next.value);
      totalLength += next.value.byteLength;

      // Wait for enough bytes to avoid treating a split UTF-8 BOM or a
      // one-byte-at-a-time #EXTM3U marker as ordinary continuous audio.
      if (totalLength < PLAYBACK_PREFIX_MIN_DECISION_BYTES) continue;

      const prefixText = new TextDecoder()
        .decode(concatChunks(prefixChunks, totalLength))
        .replace(/^\uFEFF/, '')
        .trimStart()
        .toUpperCase();

      if (prefixText.startsWith(HLS_MARKER)) {
        throw new LiveStreamUpstreamError(
          'HLS_PLAYBACK_UNSUPPORTED',
          'External HLS listener playback is not available. Use LiveKit or an approved continuous audio endpoint.',
          415
        );
      }

      if (prefixText && !HLS_MARKER.startsWith(prefixText)) break;
    }

    const finalPrefixText = new TextDecoder()
      .decode(concatChunks(prefixChunks, totalLength))
      .replace(/^\uFEFF/, '')
      .trimStart()
      .toUpperCase();
    if (finalPrefixText.startsWith(HLS_MARKER)) {
      throw new LiveStreamUpstreamError(
        'HLS_PLAYBACK_UNSUPPORTED',
        'External HLS listener playback is not available. Use LiveKit or an approved continuous audio endpoint.',
        415
      );
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  }

  return replayBody(reader, prefixChunks);
}
