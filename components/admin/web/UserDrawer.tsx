'use client';

import React, { useEffect, useRef } from 'react';
import { Button, Select } from './ui';
import ConfirmDialog from './ConfirmDialog';

type MosqueRow = {
  id: string;
  name: string;
  allow_multi_mosque_local_admins?: boolean | null;
};

type PolicyDecision = { allowed: boolean; message?: string };

type Props = {
  open: boolean;
  onClose: () => void;
  user: { id: string; email: string | null; role: string } | null;
  mosques: MosqueRow[];
  adminMosqueIds: string[];
  muezzinMosqueIds: string[];
  mosqueNameMap: Record<string, string>;
  onAssignAdmin: (userId: string, mosqueId: string) => Promise<void>;
  onRemoveAdmin: (userId: string, mosqueId: string) => void;
  onAssignMuezzin: (userId: string, mosqueId: string) => Promise<void>;
  onRemoveMuezzin: (userId: string, mosqueId: string) => void;
  onGrantMainAdmin: (userId: string) => void;
  onSetBaseAccount: (userId: string) => void;
  evaluateAdminPolicy: (mosqueId: string, currentAdminMosqueIds: string[]) => PolicyDecision;
  loading?: boolean;
};

function renderRoleBadge(role: string) {
  const isMainAdmin = role === 'main_admin';
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        backgroundColor: isMainAdmin ? '#0f172a' : '#e2e8f0',
        color: isMainAdmin ? '#e2e8f0' : '#0f172a',
      }}
    >
      {isMainAdmin ? 'main_admin' : 'user'}
    </span>
  );
}

export default function UserDrawer({
  open,
  onClose,
  user,
  mosques,
  adminMosqueIds,
  muezzinMosqueIds,
  mosqueNameMap,
  onAssignAdmin,
  onRemoveAdmin,
  onAssignMuezzin,
  onRemoveMuezzin,
  onGrantMainAdmin,
  onSetBaseAccount,
  evaluateAdminPolicy,
  loading = false,
}: Props) {
  const [selectedAdminMosque, setSelectedAdminMosque] = React.useState('');
  const [selectedMuezzinMosque, setSelectedMuezzinMosque] = React.useState('');
  const [confirmState, setConfirmState] = React.useState<{
    open: boolean;
    title: string;
    description: string;
    consequence: string;
    variant: 'danger' | 'warning' | 'neutral';
    onConfirm: () => void;
  }>({ open: false, title: '', description: '', consequence: '', variant: 'neutral', onConfirm: () => {} });

  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    setSelectedAdminMosque('');
    setSelectedMuezzinMosque('');
    setTimeout(() => closeButtonRef.current?.focus(), 40);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !user) return null;

  const isMainAdmin = user.role === 'main_admin';
  const availableAdminMosques = mosques.filter((m) => !adminMosqueIds.includes(m.id));
  const availableMuezzinMosques = mosques.filter((m) => !muezzinMosqueIds.includes(m.id));

  const adminPolicyDecision = selectedAdminMosque
    ? evaluateAdminPolicy(selectedAdminMosque, adminMosqueIds)
    : { allowed: true };

  const confirm = (opts: Omit<typeof confirmState, 'open'>) =>
    setConfirmState({ open: true, ...opts });

  const closeConfirm = () => setConfirmState((s) => ({ ...s, open: false }));

  return (
    <>
      <div
        className="adm-drawer-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="adm-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`User: ${user.email ?? user.id}`}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            padding: '20px 20px 0',
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#64748b' }}>
              User account
            </div>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#0f172a', wordBreak: 'break-all' }}>
              {user.email ?? user.id}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {renderRoleBadge(user.role)}
              <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>
                ID: {user.id.slice(0, 12)}…
              </span>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close user drawer"
            className="adm-btn adm-btn-ghost"
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              background: 'transparent',
              color: '#64748b',
              fontSize: 18,
              fontWeight: 700,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* ── Global role ──────────────────────────── */}
            <section>
              <div style={sectionTitle}>Global role</div>
              <div style={sectionSubtitle}>
                Main admin grants network-wide access. Use sparingly.
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                <Button
                  variant="primary"
                  disabled={isMainAdmin || loading}
                  onClick={() =>
                    confirm({
                      title: 'Grant main-admin access',
                      description: `${user.email ?? user.id} will have network-wide main-admin access across all mosques.`,
                      consequence: 'This grants full operational access to every mosque on the platform.',
                      variant: 'warning',
                      onConfirm: () => {
                        closeConfirm();
                        onGrantMainAdmin(user.id);
                      },
                    })
                  }
                >
                  Grant main admin
                </Button>
                <Button
                  variant="ghost"
                  disabled={(user.role === 'user') || loading}
                  onClick={() =>
                    confirm({
                      title: 'Set base account',
                      description: `${user.email ?? user.id} will be demoted to the base user role. Mosque-scoped assignments remain intact.`,
                      consequence: 'Main-admin access will be revoked immediately.',
                      variant: 'danger',
                      onConfirm: () => {
                        closeConfirm();
                        onSetBaseAccount(user.id);
                      },
                    })
                  }
                >
                  Set base account
                </Button>
              </div>
            </section>

            <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: 0 }} />

            {/* ── Local admin assignments ───────────────── */}
            <section>
              <div style={sectionTitle}>Local admin of</div>
              <div style={sectionSubtitle}>
                Assign this user as a local admin for specific mosques.
              </div>

              {adminMosqueIds.length ? (
                <div style={chipRow}>
                  {adminMosqueIds.map((mid) => (
                    <span key={mid} style={chip}>
                      {mosqueNameMap[mid] ?? mid}
                      <button
                        type="button"
                        className="adm-chip-remove"
                        style={chipRemove}
                        onClick={() =>
                          confirm({
                            title: 'Remove local admin assignment',
                            description: `Remove local-admin access to "${mosqueNameMap[mid] ?? mid}" for ${user.email ?? user.id}?`,
                            consequence: 'They will lose mosque admin access immediately.',
                            variant: 'danger',
                            onConfirm: () => {
                              closeConfirm();
                              onRemoveAdmin(user.id, mid);
                            },
                          })
                        }
                        aria-label={`Remove local admin assignment for ${mosqueNameMap[mid] ?? mid}`}
                        disabled={loading}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <div style={emptyText}>No local-admin assignments</div>
              )}

              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap', marginTop: 12 }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <Select
                    value={selectedAdminMosque}
                    onChange={(e) => setSelectedAdminMosque(e.target.value)}
                    disabled={isMainAdmin || loading}
                    style={{ fontSize: 14, padding: '10px 12px' }}
                    aria-label="Select mosque for local admin assignment"
                  >
                    <option value="">Select mosque…</option>
                    {availableAdminMosques.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}{m.allow_multi_mosque_local_admins ? ' (shared)' : ' (exclusive)'}
                      </option>
                    ))}
                  </Select>
                  {selectedAdminMosque && !adminPolicyDecision.allowed ? (
                    <div style={{ marginTop: 6, fontSize: 12, color: '#b45309', fontWeight: 700 }}>
                      {adminPolicyDecision.message}
                    </div>
                  ) : null}
                </div>
                <Button
                  variant="secondary"
                  disabled={!selectedAdminMosque || !adminPolicyDecision.allowed || isMainAdmin || loading}
                  onClick={async () => {
                    if (!selectedAdminMosque) return;
                    await onAssignAdmin(user.id, selectedAdminMosque);
                    setSelectedAdminMosque('');
                  }}
                >
                  Assign
                </Button>
              </div>

              {isMainAdmin ? (
                <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>
                  Main admins do not need local-admin assignments.
                </div>
              ) : null}
            </section>

            <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: 0 }} />

            {/* ── Muezzin assignments ───────────────────── */}
            <section>
              <div style={sectionTitle}>Muezzin of</div>
              <div style={sectionSubtitle}>
                Assign this user as a muezzin for specific mosques.
              </div>

              {muezzinMosqueIds.length ? (
                <div style={chipRow}>
                  {muezzinMosqueIds.map((mid) => (
                    <span key={mid} style={chipGreen}>
                      {mosqueNameMap[mid] ?? mid}
                      <button
                        type="button"
                        className="adm-chip-remove"
                        style={chipRemove}
                        onClick={() =>
                          confirm({
                            title: 'Remove muezzin assignment',
                            description: `Remove muezzin access to "${mosqueNameMap[mid] ?? mid}" for ${user.email ?? user.id}?`,
                            consequence: 'They will lose muezzin access and cannot start broadcasts for this mosque.',
                            variant: 'danger',
                            onConfirm: () => {
                              closeConfirm();
                              onRemoveMuezzin(user.id, mid);
                            },
                          })
                        }
                        aria-label={`Remove muezzin assignment for ${mosqueNameMap[mid] ?? mid}`}
                        disabled={loading}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <div style={emptyText}>No muezzin assignments</div>
              )}

              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap', marginTop: 12 }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <Select
                    value={selectedMuezzinMosque}
                    onChange={(e) => setSelectedMuezzinMosque(e.target.value)}
                    disabled={isMainAdmin || loading}
                    style={{ fontSize: 14, padding: '10px 12px' }}
                    aria-label="Select mosque for muezzin assignment"
                  >
                    <option value="">Select mosque…</option>
                    {availableMuezzinMosques.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button
                  variant="secondary"
                  disabled={!selectedMuezzinMosque || isMainAdmin || loading}
                  onClick={async () => {
                    if (!selectedMuezzinMosque) return;
                    await onAssignMuezzin(user.id, selectedMuezzinMosque);
                    setSelectedMuezzinMosque('');
                  }}
                >
                  Assign
                </Button>
              </div>

              {isMainAdmin ? (
                <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>
                  Main admins should not hold mosque-scoped muezzin assignments.
                </div>
              ) : null}
            </section>

          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmState.open}
        onClose={closeConfirm}
        onConfirm={confirmState.onConfirm}
        title={confirmState.title}
        description={confirmState.description}
        consequence={confirmState.consequence}
        variant={confirmState.variant}
        loading={loading}
      />
    </>
  );
}

const sectionTitle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  color: '#0f172a',
  marginBottom: 4,
};

const sectionSubtitle: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.55,
  color: '#64748b',
};

const chipRow: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  marginTop: 10,
};

const chip: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 10px',
  borderRadius: 999,
  backgroundColor: '#e2e8f0',
  color: '#0f172a',
  fontWeight: 700,
  fontSize: 13,
};

const chipGreen: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 10px',
  borderRadius: 999,
  backgroundColor: '#dcfce7',
  color: '#166534',
  fontWeight: 700,
  fontSize: 13,
};

const chipRemove: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  fontWeight: 800,
  fontSize: 12,
  color: 'inherit',
  padding: '1px 3px',
  lineHeight: 1,
};

const emptyText: React.CSSProperties = {
  fontSize: 13,
  color: '#94a3b8',
  fontWeight: 600,
  marginTop: 8,
};
