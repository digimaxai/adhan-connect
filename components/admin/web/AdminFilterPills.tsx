'use client';

import React from 'react';

type FilterItem = {
  key: string;
  label: string;
  value: string;
};

type Props = {
  items: FilterItem[];
  onClear?: (key: string) => void;
  onClearAll?: () => void;
};

export default function AdminFilterPills({ items, onClear, onClearAll }: Props) {
  if (!items.length) return null;

  return (
    <div style={styles.row}>
      {items.map((item) => (
        <div key={item.key} style={styles.pill}>
          <span style={styles.label}>{item.label}</span>
          <span style={styles.value}>{item.value}</span>
          {onClear ? (
            <button type="button" style={styles.clearButton} onClick={() => onClear(item.key)}>
              x
            </button>
          ) : null}
        </div>
      ))}
      {onClearAll ? (
        <button type="button" style={styles.reset} onClick={onClearAll}>
          Clear all
        </button>
      ) : null}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    padding: '8px 12px',
    backgroundColor: '#eff6ff',
    border: '1px solid #bfdbfe',
    color: '#0f172a',
  },
  label: {
    fontSize: 12,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: '#0369a1',
  },
  value: {
    fontSize: 13,
    fontWeight: 700,
    color: '#0f172a',
  },
  clearButton: {
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontWeight: 900,
    color: '#334155',
  },
  reset: {
    border: 'none',
    background: 'transparent',
    color: '#0369a1',
    fontWeight: 800,
    cursor: 'pointer',
    padding: '8px 6px',
  },
};
