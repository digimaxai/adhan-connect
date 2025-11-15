// app/index.tsx
import { Redirect } from 'expo-router';

export default function Index() {
  // Redirect to the tab group's root route (auto-resolves to /index inside (tabs))
  return <Redirect href="/(tabs)" />;
}
