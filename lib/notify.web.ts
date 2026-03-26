export async function ensureAndroidChannel() {
  return;
}

export async function ensureNotificationPermissions() {
  return false;
}

export async function scheduleLocal(_title: string, _body: string, _when: Date) {
  return '';
}

export async function scheduleReminders(_target: Date, _offsetsMins: number[], _label: string) {
  return [] as string[];
}
