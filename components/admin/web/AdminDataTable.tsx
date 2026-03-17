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
};

export default function AdminDataTable({
  columns,
  loading,
  emptyMessage,
  rowCount,
  children,
  footer,
}: Props) {
  return (
    <div style={styles.shell}>
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
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
            {rowCount ? (
              children
            ) : (
              <tr>
                <td style={styles.emptyCell} colSpan={columns.length}>
                  {loading ? 'Loading...' : emptyMessage}
                </td>
              </tr>
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
    borderRadius: 22,
    overflow: 'hidden',
    border: '1px solid rgba(148, 163, 184, 0.18)',
    backgroundColor: '#fff',
    boxShadow: '0 14px 30px rgba(15,23,42,0.05)',
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
    padding: '14px 16px',
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: '#475569',
    backgroundColor: '#f8fbff',
    borderBottom: '1px solid #dbe4ec',
  },
  emptyCell: {
    padding: '22px 16px',
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  footer: {
    padding: '14px 16px',
    borderTop: '1px solid #eef2f7',
    backgroundColor: '#fcfdff',
  },
};
