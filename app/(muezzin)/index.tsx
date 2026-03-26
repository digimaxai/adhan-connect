import { Redirect } from 'expo-router';

export default function MuezzinIndexRedirect() {
  return <Redirect href={'/muezzin-home' as any} />;
}
