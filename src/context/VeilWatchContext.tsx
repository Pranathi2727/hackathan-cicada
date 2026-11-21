import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import {
  ActivityEvent,
  AgentHeartbeat,
  AlertItem,
  AlertSeverity,
  AlertStatus,
  AuthUser,
  CompanyIncident,
  ForecastSummary,
  GlobalCompany,
  IncidentFingerprint,
  MonitoredSystem,
  PageId,
  PredictiveWarning,
  PrivacyInspectionRecord,
  SimulationScenario,
  SystemCategory,
  TelemetryPoint,
  VeilWatchSettings,
} from '../types/veilwatch';
import {
  DEFAULT_SETTINGS,
  INITIAL_ACTIVITY,
  INITIAL_ALERTS,
  INITIAL_FINGERPRINTS,
  INITIAL_INSPECTIONS,
  INITIAL_SYSTEMS,
  INITIAL_TELEMETRY,
} from '../data/seedData';
import { buildNormalizedSignature, generatePrivacySafeHash } from '../utils/fingerprint';
import { analyzePredictiveWarnings, buildFutureTelemetryForecast } from '../utils/predictiveEngine';
import { inspectDataLocally } from '../utils/privacyEngine';

interface NewSystemInput {
  name: string;
  category: SystemCategory;
  host: string;
  region: string;
  notes?: string;
}

interface VeilWatchContextValue {
  viewMode: 'landing' | 'signin' | 'dashboard';
  setViewMode: (mode: 'landing' | 'signin' | 'dashboard') => void;
  activePage: PageId;
  setActivePage: (page: PageId) => void;
  navigateToPage: (page: PageId) => void;

  // Auth
  authUser: AuthUser | null;
  authLoading: boolean;
  signInWithGoogle: () => Promise<{ ok: boolean; error?: string }>;
  signInWithEmail: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  registerWithEmail: (
    email: string,
    password: string,
    displayName?: string
  ) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;

  // Core Data (PostgreSQL backed)
  systems: MonitoredSystem[];
  alerts: AlertItem[];
  inspections: PrivacyInspectionRecord[];
  fingerprints: IncidentFingerprint[];
  activity: ActivityEvent[];
  telemetry: TelemetryPoint[];
  forecast: ForecastSummary;
  settings: VeilWatchSettings;
  predictiveWarnings: PredictiveWarning[];
  companies: GlobalCompany[];
  companyIncidents: CompanyIncident[];
  agentHeartbeats: AgentHeartbeat[];
  dbSyncing: boolean;
  lastUpdated: string;
  toastMessage: {
    id: string;
    title: string;
    detail: string;
    level: 'info' | 'warning' | 'critical' | 'privacy';
  } | null;
  dismissToast: () => void;

  // Actions
  refreshFromDatabase: () => Promise<void>;
  addSystem: (input: NewSystemInput) => Promise<{ ok: boolean; error?: string }>;
  toggleSystemMonitoring: (id: string) => Promise<void>;
  removeSystem: (id: string) => Promise<void>;
  updateAlertStatus: (id: string, status: AlertStatus, useAiAutoResolve?: boolean) => Promise<void>;
  runLocalPrivacyInspection: (rawInput: string) => Promise<PrivacyInspectionRecord>;
  recordFingerprintEvent: (params: {
    category: string;
    severity: AlertSeverity;
    componentType: string;
    patternCode: string;
  }) => Promise<IncidentFingerprint>;
  triggerSimulation: (scenario: SimulationScenario) => Promise<void>;
  updateSettings: (next: VeilWatchSettings) => Promise<void>;
  requestBrowserNotifications: () => Promise<NotificationPermission | 'unsupported'>;
  browserNotificationPermission: NotificationPermission | 'unsupported';
  resetDemoData: () => void;

  // Python Agent & Global Companies
  runPythonAgentSweep: (simulateAnomaly?: boolean) => Promise<{ ok: boolean; detail?: string }>;
  syncGlobalCompanies: (onlyTracked?: boolean) => Promise<{
    ok: boolean;
    syncedCount?: number;
    incidentsDetected?: number;
    error?: string;
  }>;
  toggleOrAddCompany: (params: {
    slug?: string;
    query?: string;
    companyType?: 'public' | 'private';
  }) => Promise<{ ok: boolean; error?: string }>;
  reportAndResolveCompanyProblem: (
    companySlug: string,
    problemTitle?: string,
    problemDescription?: string
  ) => Promise<{ ok: boolean; error?: string }>;
}

const VeilWatchContext = createContext<VeilWatchContextValue | null>(null);

function round2(n: number): number {
  return Number(n.toFixed(2));
}

export const VeilWatchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [viewMode, setViewMode] = useState<'landing' | 'signin' | 'dashboard'>('landing');
  const [activePage, setActivePage] = useState<PageId>('overview');

  // Auth state kept strictly in React memory (never localStorage)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const authTokenRef = useRef<string | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [dbSyncing, setDbSyncing] = useState<boolean>(false);

  const [systems, setSystems] = useState<MonitoredSystem[]>(INITIAL_SYSTEMS);
  const [alerts, setAlerts] = useState<AlertItem[]>(INITIAL_ALERTS);
  const [inspections, setInspections] = useState<PrivacyInspectionRecord[]>(INITIAL_INSPECTIONS);
  const [fingerprints, setFingerprints] = useState<IncidentFingerprint[]>(INITIAL_FINGERPRINTS);
  const [activity, setActivity] = useState<ActivityEvent[]>(INITIAL_ACTIVITY);
  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>(INITIAL_TELEMETRY);
  const [settings, setSettings] = useState<VeilWatchSettings>({
    ...DEFAULT_SETTINGS,
    autoResolveEnabled: true,
    globalSyncEnabled: true,
  });
  const [companies, setCompanies] = useState<GlobalCompany[]>([]);
  const [companyIncidents, setCompanyIncidents] = useState<CompanyIncident[]>([]);
  const [agentHeartbeats, setAgentHeartbeats] = useState<AgentHeartbeat[]>([]);

  const [lastUpdated, setLastUpdated] = useState<string>(() => new Date().toISOString());
  const [toastMessage, setToastMessage] = useState<VeilWatchContextValue['toastMessage']>(null);
  const [browserNotificationPermission, setBrowserNotificationPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return window.Notification.permission;
  });

  // Sync theme to document root
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [settings.theme]);

  const showToast = useCallback(
    (title: string, detail: string, level: 'info' | 'warning' | 'critical' | 'privacy' = 'info') => {
      if (!settings.notifications.inAppBanner) return;
      const id = `toast-${Date.now()}`;
      setToastMessage({ id, title, detail, level });
    },
    [settings.notifications.inAppBanner]
  );

  const dismissToast = useCallback(() => setToastMessage(null), []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const emitBrowserNotification = useCallback(
    (title: string, body: string) => {
      if (
        settings.notifications.browserNotifications &&
        typeof window !== 'undefined' &&
        'Notification' in window &&
        window.Notification.permission === 'granted'
      ) {
        try {
          new window.Notification(title, { body });
        } catch {
          // Ignore sandboxed frame errors
        }
      }
    },
    [settings.notifications.browserNotifications]
  );

  const authedFetch = useCallback(async (url: string, init?: RequestInit) => {
    const token = authTokenRef.current;
    const headers = new Headers(init?.headers || {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    if (init?.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    return fetch(url, { ...init, headers });
  }, []);

  const refreshFromDatabase = useCallback(async () => {
    if (!authTokenRef.current) return;
    setDbSyncing(true);
    try {
      const res = await authedFetch('/api/dashboard/state');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.systems)) setSystems(data.systems);
      if (Array.isArray(data.telemetry)) setTelemetry(data.telemetry);
      if (Array.isArray(data.alerts)) setAlerts(data.alerts);
      if (Array.isArray(data.fingerprints)) setFingerprints(data.fingerprints);
      if (Array.isArray(data.inspections)) setInspections(data.inspections);
      if (Array.isArray(data.activity)) setActivity(data.activity);
      if (data.settings) setSettings(data.settings);
      if (Array.isArray(data.companies)) setCompanies(data.companies);
      if (Array.isArray(data.companyIncidents)) setCompanyIncidents(data.companyIncidents);
      if (Array.isArray(data.agentHeartbeats)) setAgentHeartbeats(data.agentHeartbeats);
      setLastUpdated(new Date().toISOString());
    } catch (err) {
      console.error('Failed to hydrate state from PostgreSQL:', err);
    } finally {
      setDbSyncing(false);
    }
  }, [authedFetch]);

  // Listen for Firebase Google Auth session restoration on page load
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const idToken = await fbUser.getIdToken();
          authTokenRef.current = idToken;
          const res = await fetch('/api/auth/google', {
            method: 'POST',
            headers: { Authorization: `Bearer ${idToken}` },
          });
          if (res.ok) {
            const data = (await res.json()) as { user: AuthUser };
            setAuthUser(data.user);
            await refreshFromDatabase();
          }
        } catch (err) {
          console.error('Failed to restore Google session:', err);
        }
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, [refreshFromDatabase]);

  const signInWithGoogle = useCallback(async () => {
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await cred.user.getIdToken();
      authTokenRef.current = idToken;
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (!res.ok || !data.user) {
        return { ok: false, error: data.error || 'Failed to verify Google Sign-In.' };
      }
      setAuthUser(data.user);
      setViewMode('dashboard');
      await refreshFromDatabase();
      showToast('Signed in with Google', `Welcome ${data.user.displayName}`, 'info');
      return { ok: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google Sign-In cancelled or failed.';
      return { ok: false, error: msg };
    }
  }, [refreshFromDatabase, showToast]);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      try {
        const res = await fetch('/api/auth/email/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok || !data.token || !data.user) {
          return { ok: false, error: data.error || 'Invalid email or password.' };
        }
        authTokenRef.current = data.token;
        setAuthUser(data.user);
        setViewMode('dashboard');
        await refreshFromDatabase();
        showToast('Signed In', `Session active for ${data.user.email}`, 'info');
        return { ok: true };
      } catch {
        return { ok: false, error: 'Unable to reach authentication server.' };
      }
    },
    [refreshFromDatabase, showToast]
  );

  const registerWithEmail = useCallback(
    async (email: string, password: string, displayName?: string) => {
      try {
        const res = await fetch('/api/auth/email/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, displayName }),
        });
        const data = await res.json();
        if (!res.ok || !data.token || !data.user) {
          return { ok: false, error: data.error || 'Registration failed.' };
        }
        authTokenRef.current = data.token;
        setAuthUser(data.user);
        setViewMode('dashboard');
        await refreshFromDatabase();
        showToast('Account Created', `Signed in as ${data.user.email}`, 'info');
        return { ok: true };
      } catch {
        return { ok: false, error: 'Unable to reach registration server.' };
      }
    },
    [refreshFromDatabase, showToast]
  );

  const signOut = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
    } catch {
      // Ignore if signed in via password
    }
    authTokenRef.current = null;
    setAuthUser(null);
    setViewMode('signin');
  }, []);

  const navigateToPage = useCallback(
    (page: PageId) => {
      setActivePage(page);
      if (!authUser) {
        setViewMode('signin');
      } else {
        setViewMode('dashboard');
      }
    },
    [authUser]
  );

  const appendActivity = useCallback(
    (title: string, detail: string, level: ActivityEvent['level']) => {
      const entry: ActivityEvent = {
        id: `act-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
        timestamp: new Date().toISOString(),
        title,
        detail,
        level,
      };
      setActivity((prev) => [entry, ...prev].slice(0, 40));
    },
    []
  );

  const recordFingerprintEvent = useCallback(
    async (params: {
      category: string;
      severity: AlertSeverity;
      componentType: string;
      patternCode: string;
    }): Promise<IncidentFingerprint> => {
      const normalizedPattern = buildNormalizedSignature(params);
      const hash = await generatePrivacySafeHash(normalizedPattern);
      const id = `VW-FP-${hash.slice(0, 8)}`;
      const now = new Date().toISOString();

      let matchedOrCreated: IncidentFingerprint = {
        id,
        hash,
        category: params.category,
        severity: params.severity,
        normalizedPattern,
        frequency: 1,
        firstSeen: now,
        lastSeen: now,
        affectedComponentType: params.componentType,
      };

      setFingerprints((prev) => {
        const existingIndex = prev.findIndex((f) => f.hash === hash);
        if (existingIndex >= 0) {
          const updated = [...prev];
          const existing = updated[existingIndex];
          matchedOrCreated = {
            ...existing,
            frequency: existing.frequency + 1,
            lastSeen: now,
            severity: params.severity,
          };
          updated[existingIndex] = matchedOrCreated;
          return updated;
        }
        return [matchedOrCreated, ...prev];
      });

      return matchedOrCreated;
    },
    []
  );

  // Live precision telemetry sampling loop (persists to PostgreSQL when authenticated)
  useEffect(() => {
    if (!authUser || viewMode !== 'dashboard') return;

    const intervalMs = settings.monitoringIntervalSec * 1000;
    const timer = window.setInterval(() => {
      const now = new Date();
      const label = now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      setSystems((prevSystems) => {
        const nextSystems = prevSystems.map((sys) => {
          if (!sys.monitoringActive) return sys;

          const jitterCpu = (Math.random() - 0.48) * 3.4;
          const jitterMem = (Math.random() - 0.48) * 2.1;
          const jitterRt = (Math.random() - 0.48) * 9.5;

          const cpu = round2(Math.max(8, Math.min(99, sys.cpuUsage + jitterCpu)));
          const memory = round2(Math.max(15, Math.min(98, sys.memoryUsage + jitterMem)));
          const responseTimeMs = round2(Math.max(10, Math.min(600, sys.responseTimeMs + jitterRt)));

          let status: MonitoredSystem['status'] = 'healthy';
          if (
            cpu >= settings.thresholds.cpuCritical ||
            memory >= settings.thresholds.memoryCritical ||
            responseTimeMs >= settings.thresholds.responseCriticalMs
          ) {
            status = 'critical';
          } else if (
            cpu >= settings.thresholds.cpuWarning ||
            memory >= settings.thresholds.memoryWarning ||
            responseTimeMs >= settings.thresholds.responseWarningMs
          ) {
            status = 'warning';
          }

          const nextHistory = [
            ...sys.history.slice(-11),
            { label, cpu, memory, responseMs: responseTimeMs },
          ];

          return {
            ...sys,
            cpuUsage: cpu,
            memoryUsage: memory,
            responseTimeMs,
            status,
            lastSeen: now.toISOString(),
            history: nextHistory,
          };
        });

        const activeNodes = nextSystems.filter((s) => s.monitoringActive);
        if (activeNodes.length > 0) {
          const avgCpu = round2(
            activeNodes.reduce((acc, s) => acc + s.cpuUsage, 0) / activeNodes.length
          );
          const avgMem = round2(
            activeNodes.reduce((acc, s) => acc + s.memoryUsage, 0) / activeNodes.length
          );
          const avgRt = round2(
            activeNodes.reduce((acc, s) => acc + s.responseTimeMs, 0) / activeNodes.length
          );
          const netIn = round2(Math.max(95, 224.4 + (Math.random() - 0.4) * 62.5));
          const netOut = round2(Math.max(60, 141.8 + (Math.random() - 0.4) * 41.2));

          const point: TelemetryPoint = {
            systemId: 'CLUSTER-AGG',
            timestamp: now.toISOString(),
            label,
            cpu: avgCpu,
            memory: avgMem,
            networkInMbps: netIn,
            networkOutMbps: netOut,
            responseMs: avgRt,
            diskIoPct: round2(23.5 + Math.random() * 8.4),
            errorRatePct: round2(avgRt > 180 ? 0.14 : 0.02),
            source: 'system-collector',
          };

          setTelemetry((prevTel) => [...prevTel.slice(-47), point]);

          // Persist raw point to PostgreSQL asynchronously
          if (authTokenRef.current) {
            void authedFetch('/api/telemetry/sample', {
              method: 'POST',
              body: JSON.stringify(point),
            });
          }
        }

        return nextSystems;
      });

      setLastUpdated(now.toISOString());
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [authUser, authedFetch, settings.monitoringIntervalSec, settings.thresholds, viewMode]);

  const addSystem = useCallback(
    async (input: NewSystemInput): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await authedFetch('/api/systems', {
          method: 'POST',
          body: JSON.stringify(input),
        });
        const data = await res.json();
        if (!res.ok || !data.system) {
          return { ok: false, error: data.error || 'Unable to register system.' };
        }
        await refreshFromDatabase();
        showToast('System Registered in SQL', `${data.system.name} is now active.`, 'info');
        return { ok: true };
      } catch {
        return { ok: false, error: 'Unable to communicate with backend server.' };
      }
    },
    [authedFetch, refreshFromDatabase, showToast]
  );

  const toggleSystemMonitoring = useCallback(
    async (id: string) => {
      try {
        const res = await authedFetch(`/api/systems/${encodeURIComponent(id)}/toggle`, {
          method: 'POST',
        });
        if (res.ok) {
          await refreshFromDatabase();
        }
      } catch (err) {
        console.error('Toggle failed:', err);
      }
    },
    [authedFetch, refreshFromDatabase]
  );

  const removeSystem = useCallback(
    async (id: string) => {
      try {
        const res = await authedFetch(`/api/systems/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          await refreshFromDatabase();
        }
      } catch (err) {
        console.error('Remove failed:', err);
      }
    },
    [authedFetch, refreshFromDatabase]
  );

  const updateAlertStatus = useCallback(
    async (id: string, status: AlertStatus, useAiAutoResolve = false) => {
      try {
        const res = await authedFetch(`/api/alerts/${encodeURIComponent(id)}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status, useAiAutoResolve }),
        });
        if (res.ok) {
          await refreshFromDatabase();
          showToast(
            useAiAutoResolve ? 'AI Auto-Resolved Incident' : `Alert ${id} Updated`,
            `Marked as ${status}.`,
            'info'
          );
        }
      } catch (err) {
        console.error('Update alert status failed:', err);
      }
    },
    [authedFetch, refreshFromDatabase, showToast]
  );

  const runLocalPrivacyInspection = useCallback(
    async (rawInput: string): Promise<PrivacyInspectionRecord> => {
      // Strictly local in-browser inspection; rawInput is NEVER sent to backend
      const result = inspectDataLocally(rawInput, settings.exportPolicy);
      setInspections((prev) => [result, ...prev].slice(0, 50));

      if (authTokenRef.current) {
        void authedFetch('/api/privacy/inspect-log', {
          method: 'POST',
          body: JSON.stringify(result),
        });
      }

      if (result.decision === 'blocked') {
        const fp = await recordFingerprintEvent({
          category: 'privacy',
          severity: 'high',
          componentType: 'Privacy Leak Radar',
          patternCode: `blocked_${result.classification.replace(/\s+/g, '_')}`,
        });

        if (authTokenRef.current) {
          await authedFetch('/api/alerts', {
            method: 'POST',
            body: JSON.stringify({
              title: `Blocked Sensitive Export (${result.classification})`,
              description: `Privacy Leak Radar intercepted ${result.flaggedFields.reduce(
                (s, f) => s + f.count,
                0
              )} flagged field(s) locally. Raw input discarded immediately.`,
              severity: 'high',
              category: 'privacy',
              systemId: 'SEC-DLP-01',
              systemName: 'Edge Privacy Policy Enforcer',
              componentType: 'Privacy Leak Radar',
              patternCode: `blocked_${result.classification.replace(/\s+/g, '_')}`,
              recommendedAction:
                'Review export policy rules and use sanitized telemetry schema before forwarding logs.',
              sourceType: 'privacy-radar',
              autoResolve: Boolean(settings.autoResolveEnabled),
            }),
          });
          await refreshFromDatabase();
        }
        appendActivity(
          'Privacy Leak Radar blocked sensitive payload',
          `${result.classification} intercepted locally (${fp.id}).`,
          'privacy'
        );
        showToast('Sensitive Export Blocked', result.ruleApplied, 'privacy');
        emitBrowserNotification('VEILWATCH Privacy Alert', result.ruleApplied);
      } else {
        appendActivity(
          'Privacy Leak Radar approved sanitized summary',
          `Classification: ${result.classification} · Score ${result.privacyScore}/100.`,
          'info'
        );
        showToast(
          'Sanitized Summary Ready',
          `Privacy score ${result.privacyScore}/100 · Approved for export.`,
          'info'
        );
      }

      return result;
    },
    [
      appendActivity,
      authedFetch,
      emitBrowserNotification,
      recordFingerprintEvent,
      refreshFromDatabase,
      settings.autoResolveEnabled,
      settings.exportPolicy,
      showToast,
    ]
  );

  const triggerSimulation = useCallback(
    async (scenario: SimulationScenario) => {
      const now = new Date();
      const label = now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const autoResolve = Boolean(settings.autoResolveEnabled);

      if (scenario === 'sensitive_export') {
        const syntheticPayload = JSON.stringify({
          event: 'diagnostic_export_attempt',
          operator_email: 'auditor.demo@example.invalid',
          contact_phone: '555-019-4821',
          api_key: 'sk_test_synthetic99887766',
          node_ip: '10.24.88.14',
        });
        await runLocalPrivacyInspection(syntheticPayload);
        return;
      }

      if (scenario === 'normal') {
        await authedFetch('/api/alerts', {
          method: 'POST',
          body: JSON.stringify({
            title: 'Cluster Baseline Verified: Nominal Operation',
            description:
              'Automated sweep verified balanced CPU, memory, and response latency across PostgreSQL-tracked nodes.',
            severity: 'low',
            category: 'server',
            systemId: 'SRV-CORE-01',
            systemName: 'Core Telemetry Collector 01',
            componentType: 'Telemetry Cluster',
            patternCode: 'nominal_baseline_verified',
            recommendedAction: 'Continue routine observation.',
            sourceType: 'simulation',
            autoResolve: true,
            simulationSource: 'Simulation Panel',
          }),
        });
        await refreshFromDatabase();
        showToast('Baseline Verified', 'Cluster metrics normalized in PostgreSQL.', 'info');
        return;
      }

      if (scenario === 'performance_anomaly') {
        await authedFetch('/api/systems/SRV-VAULT-02/metrics', {
          method: 'POST',
          body: JSON.stringify({
            status: autoResolve ? 'healthy' : 'critical',
            cpuUsage: autoResolve ? 48.25 : 92.4,
            memoryUsage: autoResolve ? 59.1 : 89.8,
            responseTimeMs: autoResolve ? 64.5 : 284.2,
          }),
        });
        await authedFetch('/api/alerts', {
          method: 'POST',
          body: JSON.stringify({
            title: 'Performance Anomaly on Local Redaction Worker 02',
            description:
              'CPU and memory climbed past threshold baselines with elevated queue wait latency.',
            severity: 'high',
            category: 'server',
            systemId: 'SRV-VAULT-02',
            systemName: 'Local Redaction Worker 02',
            componentType: 'Worker Compute Node',
            patternCode: 'cpu_memory_anomaly_spike',
            recommendedAction:
              'Rebalance worker concurrency and flush queued redaction buffers.',
            sourceType: 'simulation',
            autoResolve,
            simulationSource: 'Simulation Panel',
          }),
        });
        await refreshFromDatabase();
        showToast(
          autoResolve ? 'Problem Occurred & Auto-Resolved' : 'Performance Anomaly Generated',
          'Worker 02 anomaly recorded in PostgreSQL.',
          autoResolve ? 'info' : 'warning'
        );
        return;
      }

      if (scenario === 'suspicious_access') {
        await authedFetch('/api/alerts', {
          method: 'POST',
          body: JSON.stringify({
            title: 'Suspicious Access Pattern Detected at Identity Gateway',
            description:
              'Burst of repeated failed token assertions detected without exposing user PII.',
            severity: 'critical',
            category: 'security',
            systemId: 'APP-AUTH-01',
            systemName: 'Zero-Trust Identity Gateway',
            componentType: 'Identity Gateway',
            patternCode: 'unusual_token_probe_burst',
            recommendedAction: 'Apply temporary ASN rate limit and rotate session keys.',
            sourceType: 'simulation',
            autoResolve,
            simulationSource: 'Simulation Panel',
          }),
        });
        await refreshFromDatabase();
        showToast(
          autoResolve ? 'Access Anomaly Occurred & Auto-Resolved' : 'Critical Security Alert',
          'Incident persisted and fingerprinted.',
          autoResolve ? 'info' : 'critical'
        );
        return;
      }

      if (scenario === 'app_downtime') {
        await authedFetch('/api/systems/APP-BILL-02/metrics', {
          method: 'POST',
          body: JSON.stringify({
            status: autoResolve ? 'healthy' : 'critical',
            cpuUsage: autoResolve ? 41.2 : 94.1,
            memoryUsage: autoResolve ? 56.4 : 88.9,
            responseTimeMs: autoResolve ? 54.0 : 542.8,
            history: [
              { label, cpu: autoResolve ? 41.2 : 94.1, memory: autoResolve ? 56.4 : 88.9, responseMs: autoResolve ? 54.0 : 542.8 },
            ],
          }),
        });
        await authedFetch('/api/alerts', {
          method: 'POST',
          body: JSON.stringify({
            title: 'Application Downtime: Billing Ledger Microservice',
            description: 'Health probe detected HTTP 503 timeout (542.8ms) on ledger-api.app.demo.',
            severity: 'critical',
            category: 'application',
            systemId: 'APP-BILL-02',
            systemName: 'Billing Ledger Microservice',
            componentType: 'Application Microservice',
            patternCode: 'service_healthcheck_timeout',
            recommendedAction: 'Failover to standby enclave replica and verify health check.',
            sourceType: 'simulation',
            autoResolve,
            simulationSource: 'Simulation Panel',
          }),
        });
        await refreshFromDatabase();
        showToast(
          autoResolve ? 'Downtime Occurred & Auto-Resolved' : 'Application Downtime Alert',
          'Billing Ledger incident persisted to PostgreSQL.',
          autoResolve ? 'info' : 'critical'
        );
      }
    },
    [authedFetch, refreshFromDatabase, runLocalPrivacyInspection, settings.autoResolveEnabled, showToast]
  );

  const updateSettings = useCallback(
    async (next: VeilWatchSettings) => {
      setSettings(next);
      if (authTokenRef.current) {
        await authedFetch('/api/settings', {
          method: 'PUT',
          body: JSON.stringify(next),
        });
        await refreshFromDatabase();
      }
      showToast('Settings Saved to SQL', `Organization: ${next.organizationName}`, 'info');
    },
    [authedFetch, refreshFromDatabase, showToast]
  );

  const requestBrowserNotifications = useCallback(async (): Promise<
    NotificationPermission | 'unsupported'
  > => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setBrowserNotificationPermission('unsupported');
      return 'unsupported';
    }
    const perm = await window.Notification.requestPermission();
    setBrowserNotificationPermission(perm);
    if (perm === 'granted') {
      const next = {
        ...settings,
        notifications: { ...settings.notifications, browserNotifications: true },
      };
      await updateSettings(next);
    } else {
      showToast('Permission Not Granted', `Browser notification status: ${perm}.`, 'warning');
    }
    return perm;
  }, [settings, showToast, updateSettings]);

  const resetDemoData = useCallback(() => {
    void refreshFromDatabase();
    showToast('Database Synced', 'Reloaded live PostgreSQL workspace state.', 'info');
  }, [refreshFromDatabase, showToast]);

  const runPythonAgentSweep = useCallback(
    async (simulateAnomaly = false) => {
      try {
        const res = await authedFetch('/api/agent/run', {
          method: 'POST',
          body: JSON.stringify({ simulateAnomaly }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast('Python Agent Error', data.error || 'Sweep failed.', 'critical');
          return { ok: false, detail: data.error };
        }
        await refreshFromDatabase();
        const snap = data.snapshot;
        const resolvedMsg = data.ingested?.autoResolved
          ? 'Anomaly occurred and was auto-resolved via AI!'
          : `CPU ${snap.cpuPct}% · Mem ${snap.memoryPct}% · ${snap.activeProcesses} processes`;
        showToast('Python Agent Sweep Complete', resolvedMsg, snap.anomalyDetected ? 'warning' : 'info');
        return { ok: true, detail: resolvedMsg };
      } catch {
        return { ok: false, detail: 'Unable to invoke Python agent endpoint.' };
      }
    },
    [authedFetch, refreshFromDatabase, showToast]
  );

  const syncGlobalCompanies = useCallback(
    async (onlyTracked = false) => {
      try {
        const res = await authedFetch('/api/companies/sync-all', {
          method: 'POST',
          body: JSON.stringify({
            onlyTracked,
            autoResolve: Boolean(settings.autoResolveEnabled),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { ok: false, error: data.error || 'Global sync failed.' };
        }
        await refreshFromDatabase();
        showToast(
          onlyTracked ? 'Tracked Companies Synced' : 'Worldwide Companies Synced',
          `Checked ${data.syncedCount} companies (${data.liveFeedsReachable} live open APIs · ${data.incidentsDetected} incident(s)).`,
          data.incidentsDetected > 0 ? 'warning' : 'info'
        );
        return {
          ok: true,
          syncedCount: data.syncedCount,
          incidentsDetected: data.incidentsDetected,
        };
      } catch {
        return { ok: false, error: 'Network error during worldwide company sync.' };
      }
    },
    [authedFetch, refreshFromDatabase, settings.autoResolveEnabled, showToast]
  );

  const toggleOrAddCompany = useCallback(
    async (params: { slug?: string; query?: string; companyType?: 'public' | 'private' }) => {
      try {
        const res = await authedFetch('/api/companies/track', {
          method: 'POST',
          body: JSON.stringify({
            ...params,
            autoResolve: Boolean(settings.autoResolveEnabled),
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.company) {
          return { ok: false, error: data.error || 'Failed to update tracked company.' };
        }
        await refreshFromDatabase();
        showToast(
          data.created ? 'Global Company Added & Tracked' : 'Watchlist Updated',
          `${data.company.name} (${data.company.companyType.toUpperCase()})`,
          'info'
        );
        return { ok: true };
      } catch {
        return { ok: false, error: 'Unable to contact company intelligence service.' };
      }
    },
    [authedFetch, refreshFromDatabase, settings.autoResolveEnabled, showToast]
  );

  const reportAndResolveCompanyProblem = useCallback(
    async (
      companySlug: string,
      problemTitle?: string,
      problemDescription?: string
    ) => {
      try {
        const res = await authedFetch(
          `/api/companies/${encodeURIComponent(companySlug)}/report-problem`,
          {
            method: 'POST',
            body: JSON.stringify({
              problemTitle,
              problemDescription,
              autoResolve: Boolean(settings.autoResolveEnabled),
            }),
          }
        );
        const data = await res.json();
        if (!res.ok) {
          return { ok: false, error: data.error || 'Failed to detect & resolve problem.' };
        }
        await refreshFromDatabase();
        showToast(
          settings.autoResolveEnabled
            ? 'Company Problem Detected & Auto-Resolved'
            : 'Company Problem Logged',
          data.incident?.title || 'Incident processed in PostgreSQL.',
          settings.autoResolveEnabled ? 'info' : 'warning'
        );
        return { ok: true };
      } catch {
        return { ok: false, error: 'Failed to trigger company problem workflow.' };
      }
    },
    [authedFetch, refreshFromDatabase, settings.autoResolveEnabled, showToast]
  );

  const predictiveWarnings = useMemo(
    () => analyzePredictiveWarnings(systems, settings.thresholds),
    [systems, settings.thresholds]
  );

  const forecast = useMemo(
    () => buildFutureTelemetryForecast(telemetry, 6, 5),
    [telemetry]
  );

  const value: VeilWatchContextValue = {
    viewMode,
    setViewMode,
    activePage,
    setActivePage,
    navigateToPage,
    authUser,
    authLoading,
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    signOut,
    systems,
    alerts,
    inspections,
    fingerprints,
    activity,
    telemetry,
    forecast,
    settings,
    predictiveWarnings,
    companies,
    companyIncidents,
    agentHeartbeats,
    dbSyncing,
    lastUpdated,
    toastMessage,
    dismissToast,
    refreshFromDatabase,
    addSystem,
    toggleSystemMonitoring,
    removeSystem,
    updateAlertStatus,
    runLocalPrivacyInspection,
    recordFingerprintEvent,
    triggerSimulation,
    updateSettings,
    requestBrowserNotifications,
    browserNotificationPermission,
    resetDemoData,
    runPythonAgentSweep,
    syncGlobalCompanies,
    toggleOrAddCompany,
    reportAndResolveCompanyProblem,
  };

  return <VeilWatchContext.Provider value={value}>{children}</VeilWatchContext.Provider>;
};

export function useVeilWatch(): VeilWatchContextValue {
  const ctx = useContext(VeilWatchContext);
  if (!ctx) throw new Error('useVeilWatch must be used inside VeilWatchProvider');
  return ctx;
}
