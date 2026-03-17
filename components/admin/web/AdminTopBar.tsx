'use client';

import React, { useMemo, useState } from 'react';
import { useAdminContext } from '../../../lib/admin-web/adminContext';

export type MosqueOption = {
  id: string;
  name: string;
  city?: string | null;
  country?: string | null;
  status?: string | null;
};

type Props = {
  mosques: MosqueOption[];
  onSearch?: (term: string) => void;
  onOpenCommandPalette?: () => void;
};

export default function AdminTopBar({ mosques, onSearch, onOpenCommandPalette }: Props) {
  const { selectedMosqueId, setSelectedMosqueId, isMosqueMode } = useAdminContext();
  const [searchTerm, setSearchTerm] = useState('');

  const options = useMemo(
    () =>
      mosques.map((m) => ({
        value: m.id,
        label: `${m.name}${m.city ? ` - ${m.city}${m.country ? `, ${m.country}` : ''}` : ''}`,
        status: m.status ?? null,
      })),
    [mosques]
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSearch) return;
    onSearch(searchTerm.trim());
  };

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value || null;
    if (selectedMosqueId && selectedMosqueId !== val) {
      const confirmed =
        typeof window !== 'undefined'
          ? window.confirm('You are switching mosque context. All actions will now affect a different mosque. Continue?')
          : true;
      if (!confirmed) return;
    }
    setSelectedMosqueId(val);
  };

  const selectedLabel =
    options.find((o) => o.value === selectedMosqueId)?.label ?? 'Global Mode (no mosque selected)';

  return (
    <div style={styles.container}>
      <div style={styles.left}>
        <form onSubmit={handleSearch} style={styles.searchForm}>
          <input
            type="text"
            placeholder="Search mosques by name/city/country or users by email"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
          <button type="submit" style={styles.searchButton}>
            Search
          </button>
        </form>
      </div>

      <div style={styles.right}>
        <button type="button" style={styles.commandButton} onClick={onOpenCommandPalette}>
          Quick actions
          <span style={styles.commandHint}>Ctrl K</span>
        </button>
        <div style={styles.selectorWrap}>
          <label htmlFor="mosque-selector" style={styles.selectorLabel}>
            Mosque Context
          </label>
          <div style={styles.selectorRow}>
            <select
              id="mosque-selector"
              value={selectedMosqueId ?? ''}
              onChange={handleSelect}
              style={styles.selector}
            >
              <option value="">Global Mode (no mosque selected)</option>
              {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {isMosqueMode ? (
              <button type="button" style={styles.exitButton} onClick={() => setSelectedMosqueId(null)}>
                Exit mosque mode
              </button>
            ) : null}
          </div>
          <div style={styles.selectorValue}>{selectedLabel}</div>
        </div>

        {isMosqueMode ? (
          <div style={styles.badge} title="Impersonation mode active">
            Viewing as Local Admin - {selectedLabel}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: '12px 16px',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#fff',
  },
  left: {
    flex: 1,
  },
  searchForm: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    fontSize: 14,
  },
  searchButton: {
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid #0f172a',
    backgroundColor: '#0f172a',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    minWidth: 320,
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
  },
  commandButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid #dbe4ec',
    backgroundColor: '#f8fbff',
    color: '#0f172a',
    fontWeight: 800,
    cursor: 'pointer',
  },
  commandHint: {
    padding: '4px 8px',
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
    color: '#475569',
    fontSize: 11,
    fontWeight: 900,
  },
  selectorWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minWidth: 260,
  },
  selectorLabel: {
    fontSize: 12,
    color: '#475569',
    fontWeight: 600,
  },
  selectorRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  selector: {
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    fontSize: 14,
    flex: 1,
  },
  exitButton: {
    padding: '9px 12px',
    borderRadius: 8,
    border: '1px solid #ef4444',
    backgroundColor: '#fff1f2',
    color: '#b91c1c',
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  selectorValue: {
    fontSize: 12,
    color: '#64748b',
  },
  badge: {
    padding: '8px 12px',
    borderRadius: 12,
    backgroundColor: '#fef9c3',
    color: '#854d0e',
    border: '1px solid #facc15',
    fontWeight: 700,
    fontSize: 13,
    maxWidth: 320,
  },
};
