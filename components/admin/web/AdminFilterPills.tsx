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
          <span style={styles.sep} aria-hidden="true">·</span>
          <span style={styles.value}>{item.value}</span>
          {onClear ? (
            <button
              type="button"
              className="adm-chip-remove"
              style={styles.clearButton}
              onClick={() => onClear(item.key)}
              aria-label={`Clear ${item.label} filter`}
            >
              ×
            </button>
          ) : null}
        </div>
      ))}
      {onClearAll ? (
        <button type="button" className="adm-btn adm-btn-ghost" style={styles.reset} onClick={onClearAll}>
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
    gap: 6,
    alignItems: 'center',
  },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    padding: '6px 10px 6px 12px',
    backgroundColor: '#f0fdfa',
    border: '1px solid #99f6e4',
    color: '#0f172a',
  },
  label: {
    fontSize: 11,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#0d9488',
  },
  sep: {
    fontSize: 12,
    color: '#5eead4',
  },
  value: {
    fontSize: 13,
    fontWeight: 700,
    color: '#134e4a',
    letterSpacing: '-0.01em',
  },
  clearButton: {
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 16,
    lineHeight: 1,
    color: '#5eead4',
    padding: '0 1px',
    marginLeft: 2,
  },
  reset: {
    border: '1px solid #d1d9e3',
    background: 'transparent',
    color: '#475569',
    fontWeight: 700,
    fontSize: 12,
    cursor: 'pointer',
    padding: '6px 12px',
    borderRadius: 999,
    letterSpacing: '-0.01em',
  },
};
