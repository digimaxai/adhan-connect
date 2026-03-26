import { Redirect } from 'expo-router';
import React from 'react';

export default function LegacyTabsRedirect() {
  return <Redirect href="/(user)" />;
}
