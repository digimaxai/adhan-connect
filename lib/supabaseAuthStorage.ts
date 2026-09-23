import {
  processLock,
  type LockFunc,
  type SupportedStorage,
} from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const STORAGE_VERSION = 1;
const MAX_CHUNK_BYTES = 1800;
const MAX_CHUNKS = 128;
const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

type StorageSlot = 'a' | 'b';

type StorageManifest = {
  version: typeof STORAGE_VERSION;
  slot: StorageSlot;
  chunks: number;
  length: number;
  checksum: string;
};

const manifestKey = (key: string) => `${key}.secure.manifest`;
const slotCountKey = (key: string, slot: StorageSlot) => `${key}.secure.${slot}.count`;
const chunkKey = (key: string, slot: StorageSlot, index: number) =>
  `${key}.secure.${slot}.${index}`;

function utf8Width(value: string, index: number) {
  const code = value.charCodeAt(index);
  if (code < 0x80) return { bytes: 1, codeUnits: 1 };
  if (code < 0x800) return { bytes: 2, codeUnits: 1 };
  if (code >= 0xd800 && code <= 0xdbff) {
    const next = value.charCodeAt(index + 1);
    if (next >= 0xdc00 && next <= 0xdfff) {
      return { bytes: 4, codeUnits: 2 };
    }
  }
  return { bytes: 3, codeUnits: 1 };
}

function splitIntoSecureStoreChunks(value: string) {
  if (!value) return [''];

  const chunks: string[] = [];
  let chunkStart = 0;
  let chunkBytes = 0;
  let index = 0;

  while (index < value.length) {
    const width = utf8Width(value, index);
    if (chunkBytes > 0 && chunkBytes + width.bytes > MAX_CHUNK_BYTES) {
      chunks.push(value.slice(chunkStart, index));
      chunkStart = index;
      chunkBytes = 0;
    }
    chunkBytes += width.bytes;
    index += width.codeUnits;
  }

  chunks.push(value.slice(chunkStart));
  if (chunks.length > MAX_CHUNKS) {
    throw new Error('The authentication session is too large to store securely.');
  }
  return chunks;
}

// This checksum only detects interrupted/corrupt chunk reads; it is not used
// as a cryptographic integrity control. SecureStore protects each chunk.
function checksum(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

function parseManifest(raw: string | null): StorageManifest | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StorageManifest>;
    if (
      parsed.version !== STORAGE_VERSION ||
      (parsed.slot !== 'a' && parsed.slot !== 'b') ||
      !Number.isInteger(parsed.chunks) ||
      typeof parsed.chunks !== 'number' ||
      parsed.chunks < 1 ||
      parsed.chunks > MAX_CHUNKS ||
      !Number.isInteger(parsed.length) ||
      typeof parsed.length !== 'number' ||
      parsed.length < 0 ||
      typeof parsed.checksum !== 'string'
    ) {
      return null;
    }
    return parsed as StorageManifest;
  } catch {
    return null;
  }
}

async function readSlotCount(key: string, slot: StorageSlot) {
  const raw = await SecureStore.getItemAsync(slotCountKey(key, slot), SECURE_STORE_OPTIONS);
  const count = Number(raw);
  return Number.isInteger(count) && count >= 1 && count <= MAX_CHUNKS ? count : 0;
}

async function removeChunkRange(
  key: string,
  slot: StorageSlot,
  start: number,
  end: number
) {
  let removedAll = true;
  for (let index = start; index < end; index += 1) {
    try {
      await SecureStore.deleteItemAsync(chunkKey(key, slot, index), SECURE_STORE_OPTIONS);
    } catch {
      removedAll = false;
    }
  }
  return removedAll;
}

export const supabaseAuthStorage: SupportedStorage = {
  async getItem(key) {
    const rawManifest = await SecureStore.getItemAsync(manifestKey(key), SECURE_STORE_OPTIONS);
    const manifest = parseManifest(rawManifest);

    // Supports a legacy unchunked SecureStore value if the adapter format
    // changes or a previous build wrote directly to the Supabase key.
    if (!manifest) {
      return SecureStore.getItemAsync(key, SECURE_STORE_OPTIONS);
    }

    const chunks: string[] = [];
    for (let index = 0; index < manifest.chunks; index += 1) {
      const chunk = await SecureStore.getItemAsync(
        chunkKey(key, manifest.slot, index),
        SECURE_STORE_OPTIONS
      );
      if (chunk === null) return null;
      chunks.push(chunk);
    }

    const value = chunks.join('');
    if (value.length !== manifest.length || checksum(value) !== manifest.checksum) {
      return null;
    }
    return value;
  },

  async setItem(key, value) {
    const rawManifest = await SecureStore.getItemAsync(manifestKey(key), SECURE_STORE_OPTIONS);
    const currentManifest = parseManifest(rawManifest);
    const targetSlot: StorageSlot = currentManifest?.slot === 'a' ? 'b' : 'a';
    const previousTargetCount = await readSlotCount(key, targetSlot);
    const previousActiveCount = currentManifest
      ? Math.max(
          currentManifest.chunks,
          await readSlotCount(key, currentManifest.slot)
        )
      : 0;
    const chunks = splitIntoSecureStoreChunks(value);
    const trackedTargetCount = Math.max(previousTargetCount, chunks.length);

    // The inactive slot is populated before the manifest switches to it. A
    // terminated write therefore leaves the last complete session readable.
    await SecureStore.setItemAsync(
      slotCountKey(key, targetSlot),
      String(trackedTargetCount),
      SECURE_STORE_OPTIONS
    );
    for (let index = 0; index < chunks.length; index += 1) {
      await SecureStore.setItemAsync(
        chunkKey(key, targetSlot, index),
        chunks[index],
        SECURE_STORE_OPTIONS
      );
    }

    const nextManifest: StorageManifest = {
      version: STORAGE_VERSION,
      slot: targetSlot,
      chunks: chunks.length,
      length: value.length,
      checksum: checksum(value),
    };
    await SecureStore.setItemAsync(
      manifestKey(key),
      JSON.stringify(nextManifest),
      SECURE_STORE_OPTIONS
    );

    const removedTargetRemainder = await removeChunkRange(
      key,
      targetSlot,
      chunks.length,
      previousTargetCount
    );
    if (removedTargetRemainder) {
      try {
        await SecureStore.setItemAsync(
          slotCountKey(key, targetSlot),
          String(chunks.length),
          SECURE_STORE_OPTIONS
        );
      } catch {
        // A larger tracked count only causes harmless extra cleanup attempts.
      }
    }
    if (currentManifest) {
      const removedPreviousSlot = await removeChunkRange(
        key,
        currentManifest.slot,
        0,
        previousActiveCount
      );
      if (removedPreviousSlot) {
        try {
          await SecureStore.deleteItemAsync(
            slotCountKey(key, currentManifest.slot),
            SECURE_STORE_OPTIONS
          );
        } catch {
          // The old slot is no longer referenced by the committed manifest.
        }
      }
    }
    try {
      await SecureStore.deleteItemAsync(key, SECURE_STORE_OPTIONS);
    } catch {
      // The committed chunked value is authoritative; legacy cleanup is best effort.
    }
  },

  async removeItem(key) {
    const [rawManifest, ...storedCounts] = await Promise.all([
      SecureStore.getItemAsync(manifestKey(key), SECURE_STORE_OPTIONS),
      readSlotCount(key, 'a'),
      readSlotCount(key, 'b'),
    ]);
    const manifest = parseManifest(rawManifest);
    const counts = [...storedCounts];
    if (manifest) {
      const activeSlotIndex = manifest.slot === 'a' ? 0 : 1;
      counts[activeSlotIndex] = Math.max(
        counts[activeSlotIndex],
        manifest.chunks
      );
    }

    const removed = await Promise.all([
      removeChunkRange(key, 'a', 0, counts[0]),
      removeChunkRange(key, 'b', 0, counts[1]),
    ]);
    const cleanup = [
      SecureStore.deleteItemAsync(manifestKey(key), SECURE_STORE_OPTIONS),
      SecureStore.deleteItemAsync(key, SECURE_STORE_OPTIONS),
    ];
    if (removed[0]) {
      cleanup.push(
        SecureStore.deleteItemAsync(slotCountKey(key, 'a'), SECURE_STORE_OPTIONS)
      );
    }
    if (removed[1]) {
      cleanup.push(
        SecureStore.deleteItemAsync(slotCountKey(key, 'b'), SECURE_STORE_OPTIONS)
      );
    }
    await Promise.all(cleanup);
  },
};

export const supabaseAuthLock: LockFunc = processLock;
export const detectSupabaseSessionInUrl = false;
