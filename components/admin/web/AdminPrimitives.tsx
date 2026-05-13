'use client';

import React from 'react';
import { Link } from 'expo-router';

// ─── Metric Card ──────────────────────────────────────────────────────────────

type MetricTone = 'default' | 'success' | 'warning' | 'danger' | 'info';

const accentColors: Record<MetricTone, string> = {
  default: '#0d9488',
  success: '#16a34a',
  warning: '#d97706',
  danger:  '#dc2626',
  info:    '#0369a1',
};

const valueFgColors: Record<MetricTone, string> = {
  default: '#0f172a',
  success: '#15803d',
  warning: '#b45309',
  danger:  '#b91c1c',
  info:    '#0369a1',
};

export function AdminMetricCard({
  label,
  value,
  detail,
  href,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  detail?: string;
  href?: string;
  tone?: MetricTone;
}) {
  const accent = accentColors[tone];
  const card = (
    <div style={{ ...styles.metricCard, boxShadow: `inset 4px 0 0 ${accent}, 0 2px 8px rgba(15,23,42,0.05)` }}>
      <div style={styles.metricLabel}>{label}</div>
      <div style={{ ...styles.metricValue, color: valueFgColors[tone] }}>
        {value}
      </div>
      {detail ? <div style={styles.metricDetail}>{detail}</div> : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href as any} className="adm-metric-card" style={{ textDecoration: 'none', display: 'block', width: '100%' } as any}>
        {card}
      </Link>
    );
  }
  return <div className="adm-metric-card" style={{ width: '100%' }}>{card}</div>;
}

// ─── Panel ────────────────────────────────────────────────────────────────────

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

// ─── Section divider ──────────────────────────────────────────────────────────

export function AdminSectionLabel({ label }: { label: string }) {
  return <div style={styles.sectionLabel}>{label}</div>;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  metricCard: {
    borderRadius: 16,
    border: '1px solid rgba(148, 163, 184, 0.18)',
    background: '#ffffff',
    padding: '20px 22px',
    width: '100%',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    minHeight: 122,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#64748b',
  },
  metricValue: {
    fontSize: 'clamp(1.85rem, 1.6rem + 0.5vw, 2.5rem)',
    lineHeight: 1,
    fontWeight: 900,
    color: '#0f172a',
    letterSpacing: '-0.025em',
  },
  metricDetail: {
    fontSize: 13,
    lineHeight: 1.5,
    color: '#64748b',
    marginTop: 'auto',
  },
  panel: {
    borderRadius: 16,
    border: '1px solid rgba(148, 163, 184, 0.18)',
    background: '#ffffff',
    boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
    padding: '22px 24px',
    width: '100%',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
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
    gap: 3,
  },
  panelTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: '#0f172a',
    letterSpacing: '-0.02em',
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
    flexShrink: 0,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.09em',
    textTransform: 'uppercase',
    color: '#94a3b8',
    padding: '0 2px',
  },
};
