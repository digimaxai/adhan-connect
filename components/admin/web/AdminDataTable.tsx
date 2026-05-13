'use client';

import React from 'react';

type Column = {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  width?: string | number;
};

type Props = {
  columns: Column[];
  loading?: boolean;
  emptyMessage: string;
  rowCount: number;
  children: React.ReactNode;
  footer?: React.ReactNode;
  skeletonRows?: number;
};

function SkeletonRow({ columns }: { columns: Column[] }) {
  return (
    <tr>
      {columns.map((col) => (
        <td key={col.key} style={styles.td}>
          <div className="adm-skeleton" style={{ height: 15, width: col.key === 'actions' ? 56 : '68%', borderRadius: 6 }} />
          {col.key === 'email' || col.key === 'name' ? (
            <div className="adm-skeleton" style={{ height: 10, width: '38%', borderRadius: 4, marginTop: 7 }} />
          ) : null}
        </td>
      ))}
    </tr>
  );
}

const EmptyIcon = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true" style={{ opacity: 0.32 }}>
    <rect x="6" y="10" width="28" height="22" rx="3" stroke="#94a3b8" strokeWidth="1.8" />
    <path d="M6 17h28" stroke="#94a3b8" strokeWidth="1.8" />
    <path d="M14 14h3M19 14h3" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M13 24h14M13 28h8" stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export default function AdminDataTable({
  columns,
  loading,
  emptyMessage,
  rowCount,
  children,
  footer,
  skeletonRows = 5,
}: Props) {
  const showSkeleton = loading && rowCount === 0;
  const showEmpty = !loading && rowCount === 0;

  return (
    <div style={styles.shell}>
      <div style={styles.tableWrap}>
        <table style={styles.table} aria-busy={loading}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  style={{
                    ...styles.th,
                    textAlign: column.align ?? 'left',
                    width: column.width,
                  }}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {showSkeleton ? (
              Array.from({ length: skeletonRows }).map((_, i) => (
                <SkeletonRow key={i} columns={columns} />
              ))
            ) : showEmpty ? (
              <tr>
                <td style={styles.emptyCell} colSpan={columns.length}>
                  <div style={styles.emptyInner}>
                    <EmptyIcon />
                    <span style={styles.emptyText}>{emptyMessage}</span>
                  </div>
                </td>
              </tr>
            ) : (
              children
            )}
          </tbody>
        </table>
      </div>
      {footer ? <div style={styles.footer}>{footer}</div> : null}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    borderRadius: 16,
    overflow: 'hidden',
    border: '1px solid rgba(148, 163, 184, 0.18)',
    backgroundColor: '#fff',
    boxShadow: '0 2px 12px rgba(15,23,42,0.05)',
  },
  tableWrap: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: 0,
  },
  th: {
    position: 'sticky',
    top: 0,
    zIndex: 1,
    padding: '13px 16px',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
    color: '#64748b',
    background: 'linear-gradient(180deg, #f8fafc 0%, #f4f7fb 100%)',
    borderBottom: '1px solid #e8eef6',
  },
  td: {
    padding: '13px 16px',
    fontSize: 14,
    color: '#0f172a',
    borderBottom: '1px solid #f1f5f9',
    verticalAlign: 'middle',
    letterSpacing: '-0.01em',
  },
  emptyCell: {
    padding: '48px 16px',
    verticalAlign: 'middle',
  },
  emptyInner: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: 600,
  },
  footer: {
    padding: '13px 16px',
    borderTop: '1px solid #eef2f7',
    background: 'linear-gradient(180deg, #fcfdff 0%, #f8fafc 100%)',
  },
};
