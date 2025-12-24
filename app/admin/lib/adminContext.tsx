import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type AdminContextValue = {
  selectedMosqueId: string | null;
  setSelectedMosqueId: (mosqueId: string | null) => void;
  isGlobalMode: boolean;
  isMosqueMode: boolean;
};

const STORAGE_KEY = 'admin:selected_mosque_id';
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

function readFromStorage(): string | null {
  if (!isBrowser || !('localStorage' in window)) return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value && value.trim().length ? value : null;
  } catch {
    return null;
  }
}

function writeToStorage(value: string | null) {
  if (!isBrowser || !('localStorage' in window)) return;
  try {
    if (value) {
      window.localStorage.setItem(STORAGE_KEY, value);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
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
  const [selectedMosqueId, setSelectedMosqueIdState] = useState<string | null>(() => {
    return readFromQuery() ?? readFromStorage();
  });

  useEffect(() => {
    writeToStorage(selectedMosqueId);
    writeToQuery(selectedMosqueId);
  }, [selectedMosqueId]);

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

// Expo Router treats files under app/ as routes; provide a default
// export to satisfy the router while keeping the named exports for imports.
export default function AdminContextRouteShim() {
  return null;
}
