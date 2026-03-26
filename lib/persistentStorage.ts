import * as FileSystem from 'expo-file-system/legacy';

type StorageLike = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

async function readFileStore(): Promise<Record<string, string>> {
  if (!FileSystem.documentDirectory) return {};
  const storageFile = `${FileSystem.documentDirectory}adhan-connect-storage.json`;
  try {
    const info = await FileSystem.getInfoAsync(storageFile);
    if (!info.exists) return {};
    const raw = await FileSystem.readAsStringAsync(storageFile);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

async function writeFileStore(data: Record<string, string>) {
  if (!FileSystem.documentDirectory) return;
  const storageFile = `${FileSystem.documentDirectory}adhan-connect-storage.json`;
  await FileSystem.writeAsStringAsync(storageFile, JSON.stringify(data));
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

function resolveStorage(): StorageLike {
  return createFileStorage();
}

export const persistentStorage = resolveStorage();
