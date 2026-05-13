'use client';

import React from 'react';

// ─── Donut Chart ──────────────────────────────────────────────────────────────

export type DonutSegment = { label: string; value: number; color: string };

export function AdminDonutChart({
  segments,
  size = 144,
  thickness = 24,
  centerLabel,
  centerSub,
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerSub?: string;
}) {
  const r = (size - thickness) / 2;
  const C = 2 * Math.PI * r;
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const cx = size / 2;
  const cy = size / 2;

  if (total === 0) {
    return (
      <div style={chartStyles.donutWrap}>
        <svg width={size} height={size}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth={thickness} />
        </svg>
        <div style={chartStyles.donutLegend}>
          <span style={chartStyles.emptyNote}>No data</span>
        </div>
      </div>
    );
  }

  let cumLen = 0;

  return (
    <div style={chartStyles.donutWrap}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <svg width={size} height={size}>
          {/* Background ring */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={thickness} />
          {segments.map((seg, i) => {
            const segLen = (seg.value / total) * C;
            const dashoffset = C / 4 - cumLen;
            cumLen += segLen;
            return (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={thickness}
                strokeDasharray={`${segLen} ${C - segLen}`}
                strokeDashoffset={dashoffset}
                strokeLinecap="butt"
              />
            );
          })}
        </svg>
        {/* Centre label */}
        {(centerLabel || centerSub) && (
          <div style={chartStyles.donutCenter}>
            {centerLabel && <div style={chartStyles.donutCenterMain}>{centerLabel}</div>}
            {centerSub && <div style={chartStyles.donutCenterSub}>{centerSub}</div>}
          </div>
        )}
      </div>
      {/* Legend */}
      <div style={chartStyles.donutLegend}>
        {segments.map((seg) => (
          <div key={seg.label} style={chartStyles.legendRow}>
            <div style={{ ...chartStyles.legendDot, backgroundColor: seg.color }} />
            <div style={chartStyles.legendText}>
              <span style={chartStyles.legendValue}>{seg.value}</span>
              <span style={chartStyles.legendLabel}> {seg.label}</span>
            </div>
          </div>
        ))}
        <div style={chartStyles.legendTotal}>
          {total} total
        </div>
      </div>
    </div>
  );
}

// ─── Bar Chart ────────────────────────────────────────────────────────────────

export type BarDatum = { label: string; value: number; color?: string };

export function AdminBarChart({
  data,
  height = 130,
  barColor = '#0d9488',
  emptyMessage = 'No data',
}: {
  data: BarDatum[];
  height?: number;
  barColor?: string;
  emptyMessage?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const labelH = 26;
  const valueH = 18;
  const barAreaH = height - labelH - valueH;
  const n = data.length;

  if (!n) {
    return (
      <div style={{ ...chartStyles.emptyChart, height }}>
        <span style={chartStyles.emptyNote}>{emptyMessage}</span>
      </div>
    );
  }

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${n * 100} ${height}`}
      preserveAspectRatio="none"
      style={{ display: 'block' }}
    >
      {data.map((d, i) => {
        const barH = max > 0 ? Math.max((d.value / max) * barAreaH, d.value > 0 ? 4 : 0) : 0;
        const slotW = 100;
        const bw = 54;
        const bx = i * slotW + (slotW - bw) / 2;
        const by = valueH + (barAreaH - barH);
        const fill = d.color ?? barColor;
        return (
          <g key={d.label}>
            {/* Bar */}
            <rect x={bx} y={by} width={bw} height={barH} rx={6} fill={fill} opacity={0.9} />
            {/* Value above bar */}
            {d.value > 0 && (
              <text
                x={i * slotW + slotW / 2}
                y={by - 5}
                textAnchor="middle"
                fontSize={12}
                fontWeight={700}
                fill="#0f172a"
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                {d.value}
              </text>
            )}
            {/* Label below bar */}
            <text
              x={i * slotW + slotW / 2}
              y={height - 6}
              textAnchor="middle"
              fontSize={11}
              fill="#64748b"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

export function AdminProgressBar({
  value,
  max,
  color = '#0d9488',
  label,
  sublabel,
  showPct = true,
}: {
  value: number;
  max: number;
  color?: string;
  label: string;
  sublabel?: string;
  showPct?: boolean;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;

  return (
    <div style={chartStyles.progressWrap}>
      <div style={chartStyles.progressHeader}>
        <span style={chartStyles.progressLabel}>{label}</span>
        {showPct && (
          <span style={{ ...chartStyles.progressPct, color }}>
            {pct}%
          </span>
        )}
      </div>
      <div style={chartStyles.progressTrack}>
        <div
          style={{
            ...chartStyles.progressFill,
            width: `${pct}%`,
            backgroundColor: color,
          }}
        />
      </div>
      {sublabel && <span style={chartStyles.progressSub}>{sublabel}</span>}
    </div>
  );
}

// ─── Inline stat row (text-based mini chart) ──────────────────────────────────

export function AdminStatRow({
  items,
}: {
  items: { label: string; value: number | string; color?: string }[];
}) {
  return (
    <div style={chartStyles.statRow}>
      {items.map((item, i) => (
        <React.Fragment key={item.label}>
          {i > 0 && <div style={chartStyles.statDivider} />}
          <div style={chartStyles.statCell}>
            <div style={{ ...chartStyles.statValue, color: item.color ?? '#0f172a' }}>
              {item.value}
            </div>
            <div style={chartStyles.statLabel}>{item.label}</div>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const chartStyles: Record<string, React.CSSProperties> = {
  donutWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 24,
    flexWrap: 'wrap',
  },
  donutCenter: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  donutCenterMain: {
    fontSize: 22,
    fontWeight: 900,
    color: '#0f172a',
    lineHeight: 1,
  },
  donutCenterSub: {
    fontSize: 11,
    fontWeight: 700,
    color: '#64748b',
    letterSpacing: '0.05em',
    marginTop: 3,
  },
  donutLegend: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  legendRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
  },
  legendText: {
    fontSize: 13,
    lineHeight: 1.3,
  },
  legendValue: {
    fontWeight: 800,
    color: '#0f172a',
  },
  legendLabel: {
    color: '#475569',
  },
  legendTotal: {
    fontSize: 12,
    fontWeight: 700,
    color: '#94a3b8',
    marginTop: 4,
    paddingTop: 8,
    borderTop: '1px solid #f1f5f9',
  },
  emptyChart: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyNote: {
    fontSize: 13,
    color: '#94a3b8',
  },
  progressWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    width: '100%',
  },
  progressHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: 700,
    color: '#0f172a',
  },
  progressPct: {
    fontSize: 13,
    fontWeight: 800,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1)',
  },
  progressSub: {
    fontSize: 12,
    color: '#94a3b8',
  },
  statRow: {
    display: 'flex',
    alignItems: 'stretch',
    gap: 0,
    width: '100%',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#f1f5f9',
    flexShrink: 0,
    margin: '0 4px',
  },
  statCell: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    padding: '12px 8px',
  },
  statValue: {
    fontSize: 22,
    fontWeight: 900,
    lineHeight: 1,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    textAlign: 'center',
  },
};
