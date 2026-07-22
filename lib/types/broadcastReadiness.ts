export type BroadcastOnboardingStage =
  | 'setup_pending'
  | 'ready_for_test'
  | 'test_passed'
  | 'live';

export type BroadcastReadinessCheckStatus = 'pass' | 'blocker' | 'warning';
export type BroadcastReadinessRequirement = 'test' | 'launch' | 'advisory';
export type BroadcastReadinessActionTarget =
  | 'profile'
  | 'live_stream'
  | 'admins'
  | 'muezzins'
  | 'prayer_times'
  | 'operator';

export type BroadcastReadinessCheck = {
  key: string;
  label: string;
  status: BroadcastReadinessCheckStatus;
  detail: string;
  requiredFor: BroadcastReadinessRequirement;
  action?: BroadcastReadinessActionTarget | null;
};

export type BroadcastRolloutState = 'off' | 'partial' | 'enabled';

export type BroadcastReadinessAuditEvent = {
  id: string;
  eventType: string;
  fromStage: BroadcastOnboardingStage | null;
  toStage: BroadcastOnboardingStage | null;
  notes: string | null;
  createdAt: string;
};

export type BroadcastReadinessPayload = {
  mosqueId: string;
  stage: BroadcastOnboardingStage;
  stageLabel: string;
  checks: BroadcastReadinessCheck[];
  requiredComplete: number;
  requiredTotal: number;
  testReady: boolean;
  launchReady: boolean;
  stream: {
    count: number;
    id: string | null;
    isLive: boolean;
  };
  rollout: {
    startTransactional: boolean;
    endTransactional: boolean;
    state: BroadcastRolloutState;
    managedExternally: true;
  };
  actions: {
    canProvision: boolean;
    canConfirmReadiness: boolean;
    canRecordTestPassed: boolean;
    canMarkLive: boolean;
    canReset: boolean;
  };
  auditEvents: BroadcastReadinessAuditEvent[];
};

export type BroadcastReadinessPostAction =
  | 'provision_stream'
  | 'confirm_readiness'
  | 'record_test_passed'
  | 'mark_live'
  | 'reset_onboarding';
