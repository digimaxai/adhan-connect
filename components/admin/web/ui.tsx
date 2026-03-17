'use client';

import React, { useEffect, useRef, useState } from 'react';

export const Card: React.FC<{ style?: React.CSSProperties; children: React.ReactNode }> = ({
  style,
  children,
}) => (
  <div
    style={{
      backgroundColor: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: 12,
      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      ...style,
    }}
  >
    {children}
  </div>
);

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }
> = ({ variant = 'primary', style, children, ...rest }) => {
  const base: React.CSSProperties = {
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid transparent',
    fontWeight: 800,
    cursor: 'pointer',
    backgroundColor: '#0f172a',
    color: '#fff',
  };
  const variants: Record<ButtonVariant, React.CSSProperties> = {
    primary: { backgroundColor: '#0f172a', color: '#fff', borderColor: '#0f172a' },
    secondary: { backgroundColor: '#e2e8f0', color: '#0f172a', borderColor: '#cbd5e1' },
    danger: { backgroundColor: '#fff1f2', color: '#b91c1c', borderColor: '#ef4444' },
    ghost: { backgroundColor: 'transparent', color: '#0f172a', borderColor: '#cbd5e1' },
  };
  return (
    <button style={{ ...base, ...variants[variant], ...style }} {...rest}>
      {children}
    </button>
  );
};

export const Pill: React.FC<{ status?: string | null }> = ({ status }) => {
  const s = status ?? '-';
  const colors =
    s === 'active'
      ? { bg: '#dcfce7', fg: '#166534' }
      : s === 'pending'
      ? { bg: '#fef9c3', fg: '#854d0e' }
      : s === 'inactive'
      ? { bg: '#e2e8f0', fg: '#475569' }
      : { bg: '#fee2e2', fg: '#991b1b' };
  return (
    <span
      style={{
        padding: '4px 8px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        backgroundColor: colors.bg,
        color: colors.fg,
        textTransform: 'capitalize',
      }}
    >
      {s}
    </span>
  );
};

export const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}> = ({ open, onClose, title, children }) => {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(520px, 94vw)',
          background: '#fff',
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          boxShadow: '0 12px 30px rgba(0,0,0,0.14)',
          padding: 20,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {title ? <h3 style={{ marginTop: 0, marginBottom: 12 }}>{title}</h3> : null}
        {children}
      </div>
    </div>
  );
};

export const Menu: React.FC<{
  trigger: React.ReactNode;
  children: React.ReactNode;
}> = ({ trigger, children }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <div onClick={() => setOpen((p) => !p)} style={{ cursor: 'pointer' }}>
        {trigger}
      </div>
      {open ? (
        <div
          style={{
            position: 'absolute',
            right: 0,
            marginTop: 6,
            minWidth: 180,
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            boxShadow: '0 10px 24px rgba(0,0,0,0.12)',
            zIndex: 20,
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
};

export const MenuItem: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }
> = ({ danger, style, children, ...rest }) => (
  <button
    style={{
      width: '100%',
      textAlign: 'left',
      padding: '10px 12px',
      background: 'transparent',
      border: 'none',
      borderBottom: '1px solid #f1f5f9',
      color: danger ? '#b91c1c' : '#0f172a',
      fontWeight: 700,
      cursor: 'pointer',
      ...style,
    }}
    {...rest}
  >
    {children}
  </button>
);

export const TextInput: React.FC<
  React.InputHTMLAttributes<HTMLInputElement>
> = ({ style, ...rest }) => (
  <input
    style={{
      width: '100%',
      padding: '10px 12px',
      borderRadius: 8,
      border: '1px solid #cbd5e1',
      fontSize: 14,
      ...style,
    }}
    {...rest}
  />
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({
  style,
  children,
  ...rest
}) => (
  <select
    style={{
      width: '100%',
      padding: '10px 12px',
      borderRadius: 8,
      border: '1px solid #cbd5e1',
      fontSize: 14,
      backgroundColor: '#fff',
      ...style,
    }}
    {...rest}
  >
    {children}
  </select>
);
