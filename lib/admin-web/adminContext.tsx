import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth';

type AdminContextValue = {
  selectedMosqueId: string | null;
  setSelectedMosqueId: (mosqueId: string | null) => void;
  isGlobalMode: boolean;
  isMosqueMode: boolean;
};

const QUERY_KEY = 'mosqueId';

const AdminContext = createContext<AdminContextValue | undefined>(undefined);

const isBrowser = typeof window !== 'undefined';

function readFromQuery(): string | null {
  if (!isBrowser) return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const value = params.get(QUERY_KEY);
    return value && value.trim().length ? value : null;
  } catch {
    return null;
  }
}

function getStorageKey(userId: string | null) {
  return `admin:selected_mosque_id:${userId ?? 'anonymous'}`;
}

function readFromStorage(userId: string | null): string | null {
  if (!isBrowser || !('localStorage' in window)) return null;
  try {
    const value = window.localStorage.getItem(getStorageKey(userId));
    return value && value.trim().length ? value : null;
  } catch {
    return null;
  }
}

function writeToStorage(userId: string | null, value: string | null) {
  if (!isBrowser || !('localStorage' in window)) return;
  try {
    const key = getStorageKey(userId);
    if (value) {
      window.localStorage.setItem(key, value);
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // ignore storage errors
  }
}

function writeToQuery(value: string | null) {
  if (!isBrowser || !('history' in window)) return;
  if (!window.location.pathname.startsWith('/admin')) return;
  try {
    const url = new URL(window.location.href);
    if (value) {
      url.searchParams.set(QUERY_KEY, value);
    } else {
      url.searchParams.delete(QUERY_KEY);
    }
    window.history.replaceState(window.history.state, '', url.toString());
  } catch {
    // ignore URL errors
  }
}

export function AdminContextProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [selectedMosqueId, setSelectedMosqueIdState] = useState<string | null>(() => {
    return readFromQuery() ?? readFromStorage(userId);
  });

  useEffect(() => {
    writeToStorage(userId, selectedMosqueId);
    writeToQuery(selectedMosqueId);
  }, [selectedMosqueId, userId]);

  useEffect(() => {
    setSelectedMosqueIdState(readFromStorage(userId) ?? readFromQuery());
  }, [userId]);

  useEffect(() => {
    if (!isBrowser) return;
    const handler = () => {
      const fromQuery = readFromQuery();
      setSelectedMosqueIdState((prev) => {
        if (fromQuery === prev) return prev;
        return fromQuery ?? null;
      });
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  const value = useMemo<AdminContextValue>(() => {
    const isMosqueMode = !!selectedMosqueId;
    return {
      selectedMosqueId,
      setSelectedMosqueId: setSelectedMosqueIdState,
      isGlobalMode: !isMosqueMode,
      isMosqueMode,
    };
  }, [selectedMosqueId]);

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdminContext(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) {
    throw new Error('useAdminContext must be used within an AdminContextProvider');
  }
  return ctx;
}
