// Notifications temporarily disabled — expo-notifications removed during Android build troubleshooting
export async function ensureAndroidChannel() {
  // stub
}

export async function ensureNotificationPermissions() {
  return true;
}

export async function scheduleLocal(title: string, body: string, when: Date) {
  return '';
}

export async function scheduleReminders(
  target: Date,
  offsetsMins: number[],
  label: string
) {
  return [];
}
