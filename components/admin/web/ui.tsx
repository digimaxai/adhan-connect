'use client';

import React, { useEffect, useRef, useState } from 'react';

export const Card: React.FC<{ style?: React.CSSProperties; children: React.ReactNode }> = ({
  style,
  children,
}) => (
  <div
    style={{
      backgroundColor: '#fff',
      border: '1px solid rgba(148,163,184,0.18)',
      borderRadius: 14,
      boxShadow: '0 2px 8px rgba(15,23,42,0.05)',
      boxSizing: 'border-box',
      ...style,
    }}
  >
    {children}
  </div>
);

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }
> = ({ variant = 'primary', style, className, children, disabled, type = 'button', ...rest }) => {
  const base: React.CSSProperties = {
    padding: '10px 16px',
    borderRadius: 10,
    border: '1px solid transparent',
    fontSize: 14,
    lineHeight: 1.2,
    fontWeight: 700,
    boxSizing: 'border-box',
    userSelect: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    letterSpacing: '-0.01em',
  };
  const variants: Record<ButtonVariant, React.CSSProperties> = {
    primary: {
      background: 'linear-gradient(180deg, #18304e 0%, #0f172a 100%)',
      color: '#fff',
      borderColor: '#1a3355',
      boxShadow: '0 1px 3px rgba(15,23,42,0.2)',
    },
    secondary: {
      backgroundColor: '#f1f5f9',
      color: '#0f172a',
      borderColor: '#d1d9e3',
    },
    danger: {
      backgroundColor: '#fff1f2',
      color: '#b91c1c',
      borderColor: '#fca5a5',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: '#475569',
      borderColor: '#d1d9e3',
    },
  };
  const cls = [
    'adm-btn',
    variant === 'danger' ? 'adm-btn-danger' : '',
    variant === 'ghost' ? 'adm-btn-ghost' : '',
    variant === 'secondary' ? 'adm-btn-secondary' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={cls}
      style={{ ...base, ...variants[variant], ...style }}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
};

export const Pill: React.FC<{ status?: string | null }> = ({ status }) => {
  const s = status ?? '-';
  const config =
    s === 'active'
      ? { bg: '#dcfce7', fg: '#166534', dot: '#16a34a' }
      : s === 'pending'
      ? { bg: '#fef9c3', fg: '#854d0e', dot: '#d97706' }
      : s === 'inactive'
      ? { bg: '#f1f5f9', fg: '#475569', dot: '#94a3b8' }
      : { bg: '#fee2e2', fg: '#991b1b', dot: '#ef4444' };
  return (
    <span
      style={{
        padding: '4px 9px 4px 7px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        backgroundColor: config.bg,
        color: config.fg,
        textTransform: 'capitalize',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        letterSpacing: '0.01em',
      }}
      aria-label={`Status: ${s}`}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: config.dot,
          flexShrink: 0,
          display: 'inline-block',
        }}
      />
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
  const firstFocusRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;

    setTimeout(() => {
      firstFocusRef.current?.focus();
    }, 20);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const container = containerRef.current;
      if (!container) return;
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      prev?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10, 22, 40, 0.44)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999,
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
      onClick={onClose}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        className="adm-modal-animate"
        style={{
          width: 'min(560px, 94vw)',
          maxHeight: 'min(88vh, 960px)',
          background: '#fff',
          borderRadius: 18,
          border: '1px solid rgba(148,163,184,0.16)',
          boxShadow: '0 24px 60px rgba(10,22,40,0.22), 0 4px 16px rgba(10,22,40,0.12)',
          padding: 24,
          boxSizing: 'border-box',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: title ? 18 : 0,
          }}
        >
          {title ? (
            <h3 id="modal-title" style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>
              {title}
            </h3>
          ) : null}
          <button
            ref={firstFocusRef}
            onClick={onClose}
            aria-label="Close dialog"
            className="adm-btn adm-btn-ghost"
            style={{
              marginLeft: 'auto',
              padding: '5px 9px',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              color: '#64748b',
              fontSize: 16,
              lineHeight: 1,
              fontWeight: 700,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>
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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <div onClick={() => setOpen((p) => !p)} style={{ cursor: 'pointer' }}>
        {trigger}
      </div>
      {open ? (
        <div
          role="menu"
          style={{
            position: 'absolute',
            right: 0,
            marginTop: 6,
            minWidth: 184,
            background: '#fff',
            border: '1px solid rgba(148,163,184,0.18)',
            borderRadius: 12,
            boxShadow: '0 12px 28px rgba(10,22,40,0.14), 0 2px 8px rgba(10,22,40,0.06)',
            zIndex: 20,
            boxSizing: 'border-box',
            overflow: 'hidden',
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
    role="menuitem"
    className="adm-menu-item"
    style={{
      width: '100%',
      textAlign: 'left',
      padding: '10px 14px',
      background: 'transparent',
      border: 'none',
      borderBottom: '1px solid #f1f5f9',
      color: danger ? '#b91c1c' : '#0f172a',
      fontSize: 14,
      fontWeight: 600,
      cursor: 'pointer',
      letterSpacing: '-0.01em',
      ...style,
    }}
    {...rest}
  >
    {children}
  </button>
);

export const TextInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({
  style,
  className,
  ...rest
}) => (
  <input
    className={['adm-input', className].filter(Boolean).join(' ')}
    style={{
      width: '100%',
      padding: '11px 14px',
      borderRadius: 10,
      border: '1px solid #d1d9e3',
      fontSize: 14,
      boxSizing: 'border-box',
      outline: 'none',
      backgroundColor: '#fff',
      color: '#0f172a',
      ...style,
    }}
    {...rest}
  />
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({
  style,
  className,
  children,
  ...rest
}) => (
  <select
    className={['adm-select', className].filter(Boolean).join(' ')}
    style={{
      width: '100%',
      padding: '11px 14px',
      borderRadius: 10,
      border: '1px solid #d1d9e3',
      fontSize: 14,
      backgroundColor: '#fff',
      boxSizing: 'border-box',
      outline: 'none',
      color: '#0f172a',
      ...style,
    }}
    {...rest}
  >
    {children}
  </select>
);
