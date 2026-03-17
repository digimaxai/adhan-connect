'use client';

import React, { useEffect } from 'react';
import { useLocalSearchParams } from 'expo-router';
import PrayerTimesAdminScreen from '../../../(admin)/prayer-times';
import { RequireMainAdmin } from '../../../../components/admin/web/RequireMainAdmin';
import { AdminContextProvider, useAdminContext } from '../../../../lib/admin-web/adminContext';
import { AdminFeedbackProvider } from '../../../../lib/admin-web/adminFeedback';

export default function MosquePrayerTimesPage() {
  return (
    <RequireMainAdmin>
      <AdminContextProvider>
        <AdminFeedbackProvider>
          <MosquePrayerTimesShell />
        </AdminFeedbackProvider>
      </AdminContextProvider>
    </RequireMainAdmin>
  );
}

function MosquePrayerTimesShell() {
  const params = useLocalSearchParams<{ id?: string; onboarding?: string }>();
  const routeIdRaw = params?.id;
  const routeId = Array.isArray(routeIdRaw) ? routeIdRaw[0] : routeIdRaw;
  const onboardingRaw = params?.onboarding;
  const onboarding = (Array.isArray(onboardingRaw) ? onboardingRaw[0] : onboardingRaw) === '1';
  const { selectedMosqueId, setSelectedMosqueId } = useAdminContext();

  useEffect(() => {
    if (routeId && selectedMosqueId !== routeId) {
      setSelectedMosqueId(routeId);
    }
  }, [routeId, selectedMosqueId, setSelectedMosqueId]);

  return (
    <PrayerTimesAdminScreen
      preferredMosqueId={routeId ?? selectedMosqueId ?? null}
      prayerTimesHrefOverride={
        routeId ? `/admin/mosques/${routeId}/prayer-times` : '/admin/prayer-times'
      }
      backHrefOverride={routeId ? `/admin/mosques/${routeId}` : '/admin/prayer-times'}
      backLabelOverride={routeId ? 'Back to Mosque' : 'Back to Prayer Times Hub'}
      eyebrowOverride="Main Admin"
      allowImplicitMosqueSelection={false}
      onboardingMode={onboarding}
    />
  );
}
