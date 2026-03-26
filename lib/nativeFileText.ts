import * as FileSystem from 'expo-file-system/legacy';

export async function readNativeFileAsText(uri: string) {
  return await FileSystem.readAsStringAsync(uri);
}
