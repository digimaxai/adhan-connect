import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

type StorageLike = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const STORAGE_FILE = `${FileSystem.documentDirectory ?? ''}adhan-connect-storage.json`;

async function readFileStore(): Promise<Record<string, string>> {
  if (!FileSystem.documentDirectory) return {};
  try {
    const info = await FileSystem.getInfoAsync(STORAGE_FILE);
    if (!info.exists) return {};
    const raw = await FileSystem.readAsStringAsync(STORAGE_FILE);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

async function writeFileStore(data: Record<string, string>) {
  if (!FileSystem.documentDirectory) return;
  await FileSystem.writeAsStringAsync(STORAGE_FILE, JSON.stringify(data));
}

function createFileStorage(): StorageLike {
  return {
    async getItem(key) {
      const data = await readFileStore();
      return data[key] ?? null;
    },
    async setItem(key, value) {
      const data = await readFileStore();
      data[key] = value;
      await writeFileStore(data);
    },
    async removeItem(key) {
      const data = await readFileStore();
      delete data[key];
      await writeFileStore(data);
    },
  };
}

function createWebStorage(): StorageLike {
  return {
    async getItem(key) {
      try {
        return globalThis.localStorage?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    async setItem(key, value) {
      globalThis.localStorage?.setItem(key, value);
    },
    async removeItem(key) {
      globalThis.localStorage?.removeItem(key);
    },
  };
}

function resolveStorage(): StorageLike {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@react-native-async-storage/async-storage');
    return mod.default ?? mod;
  } catch {
    if (Platform.OS === 'web') return createWebStorage();
    return createFileStorage();
  }
}

export const persistentStorage = resolveStorage();
