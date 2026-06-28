import { useEffect, useState } from 'react';
import { AdminMosqueSummary, getAdminMosquesForCurrentUser } from '../api/admin/adminMosques';
import { useAuth } from '../auth';

type State = {
  mosques: AdminMosqueSummary[];
  selectedMosque: AdminMosqueSummary | null;
  loading: boolean;
  error: string | null;
};

const lastSelectedMosqueIdByUser = new Map<string, string | null>();

type UseAdminMosqueOptions = {
  preferredMosqueId?: string | null;
  autoSelectFirst?: boolean;
};

export function useAdminMosque(options?: UseAdminMosqueOptions) {
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user?.id ?? null;
  const preferredMosqueId = options?.preferredMosqueId ?? null;
  const autoSelectFirst = options?.autoSelectFirst ?? true;
  const [state, setState] = useState<State>({
    mosques: [],
    selectedMosque: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    if (!userId) {
      setState({ mosques: [], selectedMosque: null, loading: authLoading, error: null });
      return () => {
        cancelled = true;
      };
    }

    const load = async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      const { mosques, error } = await getAdminMosquesForCurrentUser();
      if (cancelled) return;
      const selected = (() => {
        if (!mosques.length) return null;
        if (preferredMosqueId) {
          const preferred = mosques.find((m) => m.mosqueId === preferredMosqueId);
          if (preferred) return preferred;
        }
        if (!autoSelectFirst) return null;
        const lastSelectedMosqueId = lastSelectedMosqueIdByUser.get(userId) ?? null;
        if (lastSelectedMosqueId) {
          const found = mosques.find((m) => m.mosqueId === lastSelectedMosqueId);
          if (found) return found;
        }
        if (mosques.length === 1) return mosques[0];
        return mosques[0] ?? null;
      })();
      lastSelectedMosqueIdByUser.set(userId, selected?.mosqueId ?? null);
      setState({ mosques, selectedMosque: selected, loading: false, error });
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [authLoading, autoSelectFirst, preferredMosqueId, userId]);

  const setSelectedMosque = (mosqueId: string) => {
    setState((prev) => {
      const found = prev.mosques.find((m) => m.mosqueId === mosqueId) ?? prev.selectedMosque;
      if (userId) {
        lastSelectedMosqueIdByUser.set(userId, found?.mosqueId ?? null);
      }
      return { ...prev, selectedMosque: found ?? null };
    });
  };

  return { ...state, setSelectedMosque };
}
