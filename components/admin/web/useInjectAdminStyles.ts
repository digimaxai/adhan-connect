'use client';

import { useEffect } from 'react';

const STYLE_ID = 'adhan-admin-portal-styles';

const CSS = `
/* ── Design tokens ──────────────────────────────────────────── */
:root {
  --adm-bg:            #f4f7fb;
  --adm-surface:       #ffffff;
  --adm-border:        rgba(148, 163, 184, 0.16);
  --adm-border-md:     rgba(148, 163, 184, 0.26);
  --adm-border-strong: #e2e8f0;
  --adm-text:          #0f172a;
  --adm-text-muted:    #64748b;
  --adm-text-xmuted:   #94a3b8;
  --adm-accent:        #0d9488;
  --adm-accent-hover:  #0f766e;
  --adm-accent-light:  #f0fdfa;
  --adm-accent-ring:   rgba(13, 148, 136, 0.15);
  --adm-sidebar-bg:    #0a1628;
  --adm-radius-sm:     8px;
  --adm-radius-md:     10px;
  --adm-radius-lg:     14px;
  --adm-radius-xl:     16px;
  --adm-radius-2xl:    20px;
  --adm-shadow-xs:     0 1px 2px rgba(15,23,42,0.04);
  --adm-shadow-sm:     0 2px 8px rgba(15,23,42,0.06);
  --adm-shadow-md:     0 4px 16px rgba(15,23,42,0.08);
  --adm-shadow-lg:     0 12px 32px rgba(15,23,42,0.11);
  --adm-shadow-xl:     0 24px 48px rgba(15,23,42,0.13);
}

/* ── Global resets ──────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; }

/* ── Buttons ─────────────────────────────────────────────────── */
.adm-btn {
  transition:
    filter 0.12s ease,
    transform 0.1s ease,
    background-color 0.12s ease,
    border-color 0.12s ease,
    box-shadow 0.12s ease;
  cursor: pointer;
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.01em;
}
.adm-btn:hover:not(:disabled) {
  filter: brightness(0.9);
}
.adm-btn:active:not(:disabled) {
  filter: brightness(0.83);
  transform: scale(0.975);
}
.adm-btn:focus-visible {
  outline: 2px solid #0d9488;
  outline-offset: 2px;
}
.adm-btn:disabled {
  opacity: 0.42;
  cursor: not-allowed;
  filter: none;
  transform: none;
}
.adm-btn-danger:focus-visible  { outline-color: #b91c1c; }
.adm-btn-ghost:disabled,
.adm-btn-secondary:disabled { opacity: 0.38; }

/* ── Text inputs & selects ───────────────────────────────────── */
.adm-input,
.adm-select {
  transition: border-color 0.12s ease, box-shadow 0.12s ease;
  outline: none;
  font-family: inherit;
}
.adm-input:focus,
.adm-select:focus {
  border-color: #0d9488 !important;
  box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.13);
}
.adm-input::placeholder { color: #adb8c4; }
.adm-input:disabled,
.adm-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background-color: #f8fafc;
}

/* ── Menu items ──────────────────────────────────────────────── */
.adm-menu-item {
  transition: background-color 0.08s ease;
  font-family: inherit;
  letter-spacing: -0.01em;
}
.adm-menu-item:hover:not(:disabled) { background-color: #f8fafc !important; }
.adm-menu-item:focus-visible { outline: 2px solid #0d9488; outline-offset: -2px; }
.adm-menu-item:disabled { opacity: 0.4; cursor: not-allowed; }

/* ── Table rows ──────────────────────────────────────────────── */
.adm-tr { transition: background-color 0.08s ease; }
.adm-tr:hover { background-color: #f7fbff !important; }

/* ── Action cards (dashboard links) ─────────────────────────── */
.adm-action-card {
  transition:
    border-color 0.2s ease,
    box-shadow  0.2s ease,
    transform   0.15s ease;
}
.adm-action-card:hover {
  border-color: rgba(13, 148, 136, 0.4) !important;
  box-shadow: 0 20px 44px rgba(13, 148, 136, 0.12), 0 4px 12px rgba(13, 148, 136, 0.06) !important;
  transform: translateY(-4px);
}
.adm-action-card:focus-visible { outline: 2px solid #0d9488; outline-offset: 3px; }
.adm-action-card:active { transform: translateY(-1px); }

/* ── Metric cards ────────────────────────────────────────────── */
.adm-metric-card {
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
  text-decoration: none;
  display: flex;
  flex-direction: column;
  cursor: pointer;
}
.adm-metric-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 20px 40px rgba(15,23,42,0.09) !important;
  border-color: rgba(13, 148, 136, 0.3) !important;
}
.adm-metric-card:focus-visible { outline: 2px solid #0d9488; outline-offset: 3px; }

/* ── Tab buttons ─────────────────────────────────────────────── */
.adm-tab {
  transition: background-color 0.1s ease, border-color 0.1s ease, color 0.1s ease;
}
.adm-tab:hover:not(.adm-tab-active) {
  background-color: #f1f5f9 !important;
  border-color: #cbd5e1 !important;
}
.adm-tab:focus-visible { outline: 2px solid #0d9488; outline-offset: 2px; }

/* ── Chip remove buttons ─────────────────────────────────────── */
.adm-chip-remove {
  transition: color 0.1s ease, background-color 0.1s ease;
  border-radius: 999px;
  padding: 0 3px;
}
.adm-chip-remove:hover { color: #b91c1c !important; background-color: rgba(185,28,28,0.08); }
.adm-chip-remove:focus-visible { outline: 2px solid #b91c1c; outline-offset: 1px; }

/* ── Sidebar links ───────────────────────────────────────────── */
.adm-sidebar-link {
  transition: background-color 0.12s ease, color 0.12s ease, border-color 0.12s ease;
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  color: #8fa3bb;
  cursor: pointer;
  background: none;
  border-top: none;
  border-right: none;
  border-bottom: none;
  border-left: 2px solid transparent;
  font-family: inherit;
  width: 100%;
  box-sizing: border-box;
  text-align: left;
  letter-spacing: -0.01em;
}
.adm-sidebar-link:hover:not(.adm-sidebar-link-active) {
  background-color: rgba(255,255,255,0.065) !important;
  color: #c8d8e8 !important;
}
.adm-sidebar-link-active {
  background: linear-gradient(90deg, rgba(13,148,136,0.2) 0%, rgba(13,148,136,0.06) 100%) !important;
  color: #2dd4bf !important;
  border-left-color: #0d9488 !important;
  font-weight: 700;
}
.adm-sidebar-link:focus-visible {
  outline: 2px solid rgba(45, 212, 191, 0.72);
  outline-offset: 2px;
}

/* ── Sidebar scrollbar ───────────────────────────────────────── */
.adm-sidebar-scroll::-webkit-scrollbar { width: 3px; }
.adm-sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
.adm-sidebar-scroll::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.14);
  border-radius: 999px;
}
.adm-sidebar-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(148, 163, 184, 0.28);
}

/* ── Skeleton shimmer ────────────────────────────────────────── */
@keyframes adm-shimmer {
  0%   { background-position: -600px 0; }
  100% { background-position:  600px 0; }
}
.adm-skeleton {
  background: linear-gradient(90deg, #f1f5f9 25%, #eaeff6 50%, #f1f5f9 75%);
  background-size: 1200px 100%;
  animation: adm-shimmer 1.5s infinite linear;
  border-radius: 6px;
}

/* ── Live status pulse ───────────────────────────────────────── */
@keyframes adm-pulse {
  0%, 100% { opacity: 1;    transform: scale(1);    }
  50%       { opacity: 0.35; transform: scale(0.72); }
}
.adm-live-pulse { animation: adm-pulse 1.8s ease-in-out infinite; }

/* ── Slide-over drawer ───────────────────────────────────────── */
.adm-drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(10, 22, 40, 0.38);
  z-index: 400;
  animation: adm-fade-in 0.18s ease;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}
.adm-drawer {
  position: fixed;
  top: 0; right: 0; bottom: 0;
  width: min(520px, 96vw);
  background: #fff;
  box-shadow: -16px 0 56px rgba(10, 22, 40, 0.16);
  z-index: 401;
  display: flex;
  flex-direction: column;
  animation: adm-slide-in 0.26s cubic-bezier(0.22, 1, 0.36, 1);
  overflow: hidden;
}

/* ── Animations ──────────────────────────────────────────────── */
@keyframes adm-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes adm-slide-in {
  from { transform: translateX(100%); }
  to   { transform: translateX(0); }
}
@keyframes adm-modal-in {
  from { opacity: 0; transform: scale(0.97) translateY(6px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
.adm-modal-animate {
  animation: adm-modal-in 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}

/* ── Confirm dialog zones ────────────────────────────────────── */
.adm-confirm-zone { padding: 16px 18px; border-radius: 12px; border: 1px solid; }
.adm-confirm-zone-danger  { background-color: #fff1f2; border-color: #fecaca; }
.adm-confirm-zone-warning { background-color: #fffbeb; border-color: #fde68a; }
.adm-confirm-zone-neutral { background-color: #f8fafc; border-color: #e2e8f0; }

/* ── Breadcrumb ──────────────────────────────────────────────── */
.adm-breadcrumb-link {
  transition: color 0.1s ease;
  text-decoration: none;
  color: rgba(226, 232, 240, 0.6);
}
.adm-breadcrumb-link:hover { color: rgba(226, 232, 240, 0.9) !important; }
.adm-breadcrumb-link:focus-visible {
  outline: 2px solid rgba(99, 179, 237, 0.72);
  outline-offset: 2px;
  border-radius: 3px;
}

/* ── Context strip exit button ───────────────────────────────── */
.adm-context-exit {
  transition: background-color 0.12s ease, color 0.12s ease;
  cursor: pointer;
  font-family: inherit;
}
.adm-context-exit:hover { background-color: #fef3c7 !important; color: #78350f !important; }
.adm-context-exit:focus-visible { outline: 2px solid #b45309; outline-offset: 2px; }

/* ── TopBar search ───────────────────────────────────────────── */
.adm-topbar-search {
  transition: border-color 0.12s ease, box-shadow 0.12s ease;
  outline: none;
  font-family: inherit;
}
.adm-topbar-search:focus {
  border-color: #0d9488 !important;
  box-shadow: 0 0 0 3px rgba(13,148,136,0.12) !important;
}
.adm-topbar-search::placeholder { color: #adb8c4; }
`;

export function useInjectAdminStyles() {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.getElementById(STYLE_ID)) return;
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = CSS;
    document.head.appendChild(el);
    return () => {
      document.getElementById(STYLE_ID)?.remove();
    };
  }, []);
}
