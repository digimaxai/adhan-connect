/**
 * Quick sanity check for required Expo env vars.
 * Prints whether the variables are set and their lengths (no secrets echoed).
 */
const required = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'];

const report = required.map((key) => {
  const value = process.env[key];
  return {
    key,
    present: !!value,
    length: value ? value.length : 0,
    preview: value ? `${value.slice(0, 8)}…` : null,
  };
});

console.log('Env sanity check:');
report.forEach((item) => {
  console.log(
    `${item.key}: ${item.present ? 'SET' : 'MISSING'}${item.present ? ` (len=${item.length}, preview=${item.preview})` : ''}`
  );
});

const missing = report.filter((r) => !r.present);
if (missing.length) {
  console.error('\nMissing required env vars. Ensure .env is loaded or set in your shell.');
  process.exitCode = 1;
}
