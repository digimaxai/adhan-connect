'use client';

import React from 'react';

export function AdminMetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <div style={styles.metricCard}>
      <div style={styles.metricLabel}>{label}</div>
      <div style={styles.metricValue}>{value}</div>
      {detail ? <div style={styles.metricDetail}>{detail}</div> : null}
    </div>
  );
}

export function AdminPanel({
  title,
  subtitle,
  action,
  children,
}: {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section style={styles.panel}>
      {title || subtitle || action ? (
        <div style={styles.panelHeader}>
          <div style={styles.panelCopy}>
            {title ? <div style={styles.panelTitle}>{title}</div> : null}
            {subtitle ? <div style={styles.panelSubtitle}>{subtitle}</div> : null}
          </div>
          {action ? <div style={styles.panelAction}>{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  metricCard: {
    borderRadius: 22,
    border: '1px solid rgba(148, 163, 184, 0.18)',
    background:
      'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(248,250,252,0.94) 100%)',
    padding: '18px 20px',
    boxShadow: '0 12px 30px rgba(15,23,42,0.06)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    minHeight: 128,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#64748b',
  },
  metricValue: {
    fontSize: 34,
    lineHeight: 1,
    fontWeight: 900,
    color: '#0f172a',
  },
  metricDetail: {
    fontSize: 13,
    lineHeight: 1.5,
    color: '#475569',
  },
  panel: {
    borderRadius: 24,
    border: '1px solid rgba(148, 163, 184, 0.18)',
    background: 'rgba(255,255,255,0.96)',
    boxShadow: '0 14px 30px rgba(15,23,42,0.05)',
    padding: 18,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  panelCopy: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: 900,
    color: '#0f172a',
  },
  panelSubtitle: {
    fontSize: 13,
    lineHeight: 1.5,
    color: '#64748b',
  },
  panelAction: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
};
