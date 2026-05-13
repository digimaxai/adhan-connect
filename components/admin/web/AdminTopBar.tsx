'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
  stacked?: boolean;
  compact?: boolean;
  isPhone?: boolean;
};

const SearchIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
    style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#94a3b8' }}
  >
    <circle cx="6.5" cy="6.5" r="4.25" stroke="currentColor" strokeWidth="1.5" />
    <path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export default function AdminTopBar({
  mosques,
  onSearch,
  onOpenCommandPalette,
  stacked = false,
  compact = false,
  isPhone = false,
}: Props) {
  const { selectedMosqueId, setSelectedMosqueId } = useAdminContext();
  const [searchTerm, setSearchTerm] = useState('');

  const options = useMemo(
    () =>
      mosques.map((m) => ({
        value: m.id,
        label: `${m.name}${m.city ? ` — ${m.city}${m.country ? `, ${m.country}` : ''}` : ''}`,
        status: m.status ?? null,
      })),
    [mosques]
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSearch) return;
    onSearch(searchTerm.trim());
  };

  // Silently clear context if selected mosque disappears from list
  useEffect(() => {
    if (!selectedMosqueId) return;
    if (!options.some((o) => o.value === selectedMosqueId)) {
      setSelectedMosqueId(null);
    }
  }, [options, selectedMosqueId, setSelectedMosqueId]);

  return (
    <div
      style={{
        ...styles.bar,
        ...(stacked ? styles.barStacked : null),
        ...(isPhone ? styles.barPhone : null),
      }}
    >
      {/* Search */}
      <form
        onSubmit={handleSearch}
        style={{
          ...styles.searchForm,
          ...(isPhone ? styles.searchFormPhone : null),
          flex: 1,
          minWidth: 0,
        }}
      >
        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <SearchIcon />
          <input
            type="text"
            placeholder="Search mosques or users by email…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="adm-topbar-search"
            style={{
              ...styles.searchInput,
              ...(compact ? styles.searchInputCompact : null),
            }}
          />
        </div>
        <button type="submit" className="adm-btn" style={styles.searchBtn}>
          Search
        </button>
      </form>

      {/* Right controls */}
      <div
        style={{
          ...styles.right,
          ...(stacked ? styles.rightStacked : null),
        }}
      >
        {/* Mosque context selector */}
        <div style={styles.selectorGroup}>
          <select
            id="mosque-selector"
            aria-label="Mosque context"
            value={selectedMosqueId ?? ''}
            onChange={(e) => setSelectedMosqueId(e.target.value || null)}
            className="adm-select"
            style={styles.selector}
          >
            <option value="">Global mode</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Command palette shortcut */}
        <button
          type="button"
          className="adm-btn adm-btn-ghost"
          style={styles.kbdBtn}
          onClick={onOpenCommandPalette}
          aria-label="Open command palette"
          title="Open command palette (Ctrl K)"
        >
          <span style={styles.kbdHint}>⌘K</span>
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '11px 20px',
    boxSizing: 'border-box',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#fff',
    flexShrink: 0,
  },
  barStacked: {
    flexWrap: 'wrap',
  },
  barPhone: {
    padding: '10px 12px',
    gap: 8,
  },
  searchForm: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  searchFormPhone: {
    flexWrap: 'wrap',
    width: '100%',
    flexBasis: '100%',
  },
  searchInput: {
    width: '100%',
    padding: '9px 12px 9px 38px',
    borderRadius: 10,
    border: '1px solid #e2e8f0',
    fontSize: 14,
    backgroundColor: '#f8fafc',
    boxSizing: 'border-box',
    outline: 'none',
    color: '#0f172a',
  },
  searchInputCompact: {
    fontSize: 13,
  },
  searchBtn: {
    padding: '9px 16px',
    borderRadius: 10,
    border: '1px solid #0f172a',
    backgroundColor: '#0f172a',
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    boxSizing: 'border-box',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  rightStacked: {
    width: '100%',
  },
  selectorGroup: {
    display: 'flex',
    alignItems: 'center',
  },
  selector: {
    padding: '8px 12px',
    borderRadius: 10,
    border: '1px solid #e2e8f0',
    fontSize: 13,
    backgroundColor: '#f8fafc',
    color: '#0f172a',
    minWidth: 180,
    maxWidth: 260,
    boxSizing: 'border-box',
    outline: 'none',
    cursor: 'pointer',
  },
  kbdBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '7px 11px',
    borderRadius: 9,
    border: '1px solid #e2e8f0',
    backgroundColor: '#f8fafc',
    cursor: 'pointer',
    boxSizing: 'border-box',
    flexShrink: 0,
  },
  kbdHint: {
    fontSize: 12,
    fontWeight: 800,
    color: '#475569',
    letterSpacing: '0.02em',
  },
};
