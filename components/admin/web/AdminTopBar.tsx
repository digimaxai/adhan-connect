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

export default function AdminTopBar({
  mosques,
  onSearch,
  onOpenCommandPalette,
  stacked = false,
  compact = false,
  isPhone = false,
}: Props) {
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

  useEffect(() => {
    if (!selectedMosqueId) return;
    if (!options.some((option) => option.value === selectedMosqueId)) {
      setSelectedMosqueId(null);
    }
  }, [options, selectedMosqueId, setSelectedMosqueId]);

  return (
    <div
      style={{
        ...styles.container,
        ...(stacked ? styles.containerStacked : null),
        ...(isPhone ? styles.containerPhone : null),
      }}
    >
      <div style={{ ...styles.left, ...(stacked ? styles.leftStacked : null) }}>
        <form
          onSubmit={handleSearch}
          style={{
            ...styles.searchForm,
            ...(compact ? styles.searchFormCompact : null),
          }}
        >
          <input
            type="text"
            placeholder="Search mosques by name/city/country or users by email"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              ...styles.searchInput,
              ...(compact ? styles.searchInputCompact : null),
            }}
          />
          <button
            type="submit"
            style={{
              ...styles.searchButton,
              ...(isPhone ? styles.searchButtonPhone : null),
            }}
          >
            Search
          </button>
        </form>
      </div>

      <div
        style={{
          ...styles.right,
          ...(stacked ? styles.rightStacked : null),
          ...(isPhone ? styles.rightPhone : null),
        }}
      >
        <button
          type="button"
          style={{
            ...styles.commandButton,
            ...(isPhone ? styles.commandButtonPhone : null),
          }}
          onClick={onOpenCommandPalette}
        >
          Quick actions
          <span style={styles.commandHint}>Ctrl K</span>
        </button>
        <div
          style={{
            ...styles.selectorWrap,
            ...(stacked ? styles.selectorWrapStacked : null),
          }}
        >
          <label htmlFor="mosque-selector" style={styles.selectorLabel}>
            Mosque Context
          </label>
          <div
            style={{
              ...styles.selectorRow,
              ...(isPhone ? styles.selectorRowPhone : null),
            }}
          >
            <select
              id="mosque-selector"
              value={selectedMosqueId ?? ''}
              onChange={handleSelect}
              style={{
                ...styles.selector,
                ...(isPhone ? styles.selectorPhone : null),
              }}
            >
              <option value="">Global Mode (no mosque selected)</option>
              {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {isMosqueMode ? (
              <button
                type="button"
                style={{
                  ...styles.exitButton,
                  ...(isPhone ? styles.exitButtonPhone : null),
                }}
                onClick={() => setSelectedMosqueId(null)}
              >
                Exit mosque mode
              </button>
            ) : null}
          </div>
          <div style={styles.selectorValue}>{selectedLabel}</div>
        </div>

        {isMosqueMode ? (
          <div
            style={{
              ...styles.badge,
              ...(compact ? styles.badgeCompact : null),
            }}
            title="Impersonation mode active"
          >
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
    gap: 18,
    padding: '16px 20px',
    boxSizing: 'border-box',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#fff',
  },
  containerStacked: {
    alignItems: 'stretch',
    flexWrap: 'wrap',
  },
  containerPhone: {
    padding: '12px',
    gap: 12,
  },
  left: {
    flex: 1,
    minWidth: 0,
  },
  leftStacked: {
    width: '100%',
    flexBasis: '100%',
  },
  searchForm: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  searchFormCompact: {
    flexWrap: 'wrap',
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    padding: '12px 14px',
    borderRadius: 12,
    border: '1px solid #cbd5e1',
    fontSize: 15,
    boxSizing: 'border-box',
  },
  searchInputCompact: {
    width: '100%',
  },
  searchButton: {
    padding: '12px 16px',
    borderRadius: 12,
    border: '1px solid #0f172a',
    backgroundColor: '#0f172a',
    color: '#fff',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    boxSizing: 'border-box',
  },
  searchButtonPhone: {
    width: '100%',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    minWidth: 360,
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
  },
  rightStacked: {
    width: '100%',
    minWidth: 0,
    justifyContent: 'flex-start',
  },
  rightPhone: {
    alignItems: 'stretch',
  },
  commandButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 14px',
    borderRadius: 14,
    border: '1px solid #dbe4ec',
    backgroundColor: '#f8fbff',
    color: '#0f172a',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    boxSizing: 'border-box',
  },
  commandButtonPhone: {
    width: '100%',
    justifyContent: 'space-between',
  },
  commandHint: {
    padding: '4px 9px',
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
    color: '#475569',
    fontSize: 12,
    fontWeight: 900,
  },
  selectorWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minWidth: 260,
  },
  selectorWrapStacked: {
    minWidth: 0,
    flex: '1 1 280px',
  },
  selectorLabel: {
    fontSize: 12,
    color: '#475569',
    fontWeight: 700,
  },
  selectorRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  selectorRowPhone: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  selector: {
    padding: '12px 14px',
    borderRadius: 12,
    border: '1px solid #cbd5e1',
    fontSize: 15,
    flex: 1,
    minWidth: 0,
    boxSizing: 'border-box',
  },
  selectorPhone: {
    width: '100%',
  },
  exitButton: {
    padding: '11px 13px',
    borderRadius: 12,
    border: '1px solid #ef4444',
    backgroundColor: '#fff1f2',
    color: '#b91c1c',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
  },
  exitButtonPhone: {
    width: '100%',
    whiteSpace: 'normal',
  },
  selectorValue: {
    fontSize: 13,
    lineHeight: 1.45,
    color: '#64748b',
  },
  badge: {
    padding: '10px 14px',
    borderRadius: 14,
    backgroundColor: '#fef9c3',
    color: '#854d0e',
    border: '1px solid #facc15',
    fontWeight: 700,
    fontSize: 14,
    lineHeight: 1.45,
    maxWidth: 380,
    boxSizing: 'border-box',
  },
  badgeCompact: {
    width: '100%',
    maxWidth: '100%',
  },
};
