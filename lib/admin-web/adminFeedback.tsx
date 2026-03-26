import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

type AdminToastTone = 'success' | 'error' | 'info';

type AdminToast = {
  id: number;
  tone: AdminToastTone;
  title: string;
  description?: string;
};

type AdminFeedbackContextValue = {
  toasts: AdminToast[];
  dismissToast: (id: number) => void;
  notifySuccess: (title: string, description?: string) => void;
  notifyError: (title: string, description?: string) => void;
  notifyInfo: (title: string, description?: string) => void;
};

const AdminFeedbackContext = createContext<AdminFeedbackContextValue | undefined>(undefined);

export function AdminFeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<AdminToast[]>([]);
  const nextIdRef = useRef(1);
  const timeoutMapRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismissToast = useCallback((id: number) => {
    const timeout = timeoutMapRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutMapRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const enqueueToast = useCallback(
    (tone: AdminToastTone, title: string, description?: string) => {
      const id = nextIdRef.current++;
      setToasts((prev) => [...prev.slice(-3), { id, tone, title, description }]);
      const timeout = setTimeout(() => dismissToast(id), 3600);
      timeoutMapRef.current.set(id, timeout);
    },
    [dismissToast]
  );

  useEffect(() => {
    const timeouts = timeoutMapRef.current;
    return () => {
      timeouts.forEach((timeout) => clearTimeout(timeout));
      timeouts.clear();
    };
  }, []);

  const value = useMemo<AdminFeedbackContextValue>(
    () => ({
      toasts,
      dismissToast,
      notifySuccess: (title: string, description?: string) => enqueueToast('success', title, description),
      notifyError: (title: string, description?: string) => enqueueToast('error', title, description),
      notifyInfo: (title: string, description?: string) => enqueueToast('info', title, description),
    }),
    [dismissToast, enqueueToast, toasts]
  );

  return <AdminFeedbackContext.Provider value={value}>{children}</AdminFeedbackContext.Provider>;
}

export function useAdminFeedback() {
  const ctx = useContext(AdminFeedbackContext);
  if (!ctx) {
    throw new Error('useAdminFeedback must be used within an AdminFeedbackProvider');
  }
  return ctx;
}

export function AdminToastViewport() {
  const { toasts, dismissToast } = useAdminFeedback();

  if (!toasts.length) return null;

  return (
    <div style={styles.viewport} aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          onClick={() => dismissToast(toast.id)}
          style={{
            ...styles.toast,
            ...(toast.tone === 'success'
              ? styles.success
              : toast.tone === 'error'
              ? styles.error
              : styles.info),
          }}
        >
          <div style={styles.toastTitle}>{toast.title}</div>
          {toast.description ? <div style={styles.toastDescription}>{toast.description}</div> : null}
        </button>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  viewport: {
    position: 'fixed',
    top: 18,
    right: 18,
    zIndex: 1200,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    width: 'min(360px, calc(100vw - 24px))',
    boxSizing: 'border-box',
  },
  toast: {
    borderRadius: 18,
    padding: '14px 16px',
    border: '1px solid transparent',
    boxShadow: '0 18px 40px rgba(15,23,42,0.16)',
    textAlign: 'left',
    cursor: 'pointer',
    backgroundColor: '#fff',
    boxSizing: 'border-box',
  },
  success: {
    borderColor: '#86efac',
    backgroundColor: '#f0fdf4',
    color: '#166534',
  },
  error: {
    borderColor: '#fdba74',
    backgroundColor: '#fff7ed',
    color: '#9a3412',
  },
  info: {
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
    color: '#1d4ed8',
  },
  toastTitle: {
    fontSize: 14,
    fontWeight: 900,
  },
  toastDescription: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 1.5,
  },
};
