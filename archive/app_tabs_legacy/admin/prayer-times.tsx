import { Redirect } from 'expo-router';

export default function LegacyPrayerTimesRedirect() {
  return <Redirect href="/(admin)/prayer-times" />;
}
