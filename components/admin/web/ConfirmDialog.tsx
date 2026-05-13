'use client';

import React from 'react';
import { Button, Modal } from './ui';

type Variant = 'danger' | 'warning' | 'neutral';

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  consequence?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
  loading?: boolean;
};

const zoneClass: Record<Variant, string> = {
  danger:  'adm-confirm-zone adm-confirm-zone-danger',
  warning: 'adm-confirm-zone adm-confirm-zone-warning',
  neutral: 'adm-confirm-zone adm-confirm-zone-neutral',
};

const iconMap: Record<Variant, string> = {
  danger:  '⚠',
  warning: '⚠',
  neutral: 'ℹ',
};

const iconColorMap: Record<Variant, string> = {
  danger:  '#b91c1c',
  warning: '#92400e',
  neutral: '#0369a1',
};

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  consequence,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'neutral',
  loading = false,
}: Props) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {description ? (
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: '#475569' }}>
            {description}
          </p>
        ) : null}

        {consequence ? (
          <div className={zoneClass[variant]}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span
                aria-hidden="true"
                style={{ fontSize: 16, color: iconColorMap[variant], flexShrink: 0, marginTop: 1 }}
              >
                {iconMap[variant]}
              </span>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, fontWeight: 700, color: '#0f172a' }}>
                {consequence}
              </p>
            </div>
          </div>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
          <Button variant="ghost" onClick={onClose} disabled={loading} type="button">
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            disabled={loading}
            type="button"
          >
            {loading ? 'Working…' : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
