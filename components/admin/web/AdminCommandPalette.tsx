'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

export type AdminCommandAction = {
  key: string;
  label: string;
  description?: string;
  keywords?: string[];
  onSelect: () => void;
};

type Props = {
  open: boolean;
  onClose: () => void;
  actions: AdminCommandAction[];
};

export default function AdminCommandPalette({ open, onClose, actions }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const filteredActions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const source = actions.filter((action, index, all) => all.findIndex((item) => item.key === action.key) === index);
    if (!normalized) return source.slice(0, 14);

    return source
      .filter((action) => {
        const haystack = [action.label, action.description, ...(action.keywords ?? [])]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(normalized);
      })
      .slice(0, 14);
  }, [actions, query]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    const timeout = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex((current) => Math.min(current, Math.max(filteredActions.length - 1, 0)));
  }, [filteredActions.length, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((current) => {
          if (!filteredActions.length) return 0;
          return (current + 1) % filteredActions.length;
        });
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((current) => {
          if (!filteredActions.length) return 0;
          return current <= 0 ? filteredActions.length - 1 : current - 1;
        });
      }
      if (event.key === 'Enter') {
        const selected = filteredActions[activeIndex];
        if (!selected) return;
        event.preventDefault();
        selected.onSelect();
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeIndex, filteredActions, onClose, open]);

  if (!open) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.panel} onClick={(event) => event.stopPropagation()}>
        <div style={styles.header}>
          <div>
            <div style={styles.eyebrow}>Command palette</div>
            <div style={styles.title}>Search pages, actions, and mosque workspaces</div>
          </div>
          <div style={styles.shortcut}>Esc</div>
        </div>

        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search commands, mosques, and quick actions"
          style={styles.input}
        />

        <div style={styles.list}>
          {filteredActions.length ? (
            filteredActions.map((action, index) => (
              <button
                key={action.key}
                type="button"
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => {
                  action.onSelect();
                  onClose();
                }}
                style={{
                  ...styles.item,
                  ...(index === activeIndex ? styles.itemActive : null),
                }}
              >
                <div style={styles.itemLabel}>{action.label}</div>
                {action.description ? <div style={styles.itemDescription}>{action.description}</div> : null}
              </button>
            ))
          ) : (
            <div style={styles.empty}>No commands match this query.</div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1100,
    background: 'rgba(15, 23, 42, 0.42)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    padding: '8vh 18px 18px',
  },
  panel: {
    width: 'min(720px, 100%)',
    borderRadius: 24,
    border: '1px solid rgba(148, 163, 184, 0.28)',
    backgroundColor: '#ffffff',
    boxShadow: '0 32px 70px rgba(15,23,42,0.24)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
    padding: '18px 20px 12px',
    borderBottom: '1px solid #eef2f7',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#64748b',
  },
  title: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: 900,
    color: '#0f172a',
  },
  shortcut: {
    padding: '6px 10px',
    borderRadius: 999,
    backgroundColor: '#f8fafc',
    border: '1px solid #dbe4ec',
    color: '#475569',
    fontSize: 12,
    fontWeight: 800,
  },
  input: {
    width: 'calc(100% - 40px)',
    margin: '16px 20px 14px',
    padding: '14px 16px',
    borderRadius: 16,
    border: '1px solid #cbd5e1',
    fontSize: 15,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '55vh',
    overflowY: 'auto',
    padding: '0 10px 12px',
  },
  item: {
    border: 'none',
    background: 'transparent',
    borderRadius: 18,
    padding: '14px 14px',
    textAlign: 'left',
    cursor: 'pointer',
  },
  itemActive: {
    backgroundColor: '#eff6ff',
  },
  itemLabel: {
    fontSize: 15,
    fontWeight: 800,
    color: '#0f172a',
  },
  itemDescription: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 1.5,
    color: '#64748b',
  },
  empty: {
    padding: '20px 14px',
    fontSize: 14,
    color: '#64748b',
  },
};
