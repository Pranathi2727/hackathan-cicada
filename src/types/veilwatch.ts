export type PageId =
  | 'overview'
  | 'infrastructure'
  | 'global-companies'
  | 'python-agent'
  | 'privacy-radar'
  | 'smart-alerts'
  | 'predictive-health'
  | 'fingerprints'
  | 'audit-reports'
  | 'settings';

export type SystemCategory = 'server' | 'application' | 'network' | 'security';
export type HealthStatus = 'healthy' | 'warning' | 'critical';
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved';
export type TimeRange = '15m' | '1h' | '6h' | '24h';

export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
  authProvider: 'google' | 'password';
  role: string;
}

export interface TelemetryPoint {
  id?: number;
  systemId?: string;
  timestamp: string;
  label: string;
  cpu: number;
  memory: number;
  networkInMbps: number;
  networkOutMbps: number;
  responseMs: number;
  diskIoPct?: number;
  errorRatePct?: number;
  source?: string;
}

export interface ForecastPoint {
  label: string;
  cpu: number;
  memory: number;
  networkInMbps: number;
  networkOutMbps: number;
  responseMs: number;
  cpuLow: number;
  cpuHigh: number;
}

export interface ForecastSummary {
  horizonMinutes: number;
  futurePoints: ForecastPoint[];
  rSquaredCpu: number;
  maeCpu: number;
  accuracyPct: number;
  cpuSlopePerStep: number;
  memorySlopePerStep: number;
  latencySlopePerStep: number;
  projectedRiskLevel: 'nominal' | 'elevated' | 'critical';
}

export interface MonitoredSystem {
  id: string;
  name: string;
  category: SystemCategory;
  host: string;
  region: string;
  status: HealthStatus;
  monitoringActive: boolean;
  uptimePercent: number;
  cpuUsage: number;
  memoryUsage: number;
  responseTimeMs: number;
  lastSeen: string;
  history: { label: string; cpu: number; memory: number; responseMs: number }[];
  notes: string;
}

export interface AlertItem {
  id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  status: AlertStatus;
  category: SystemCategory | 'privacy' | 'company';
  systemId: string;
  systemName: string;
  companySlug?: string | null;
  companyName?: string | null;
  sourceType?: string;
  timestamp: string;
  recommendedAction: string;
  resolutionNotes?: string | null;
  autoResolved?: boolean;
  resolvedAt?: string | null;
  fingerprintId: string;
  simulationSource?: string | null;
}

export interface ActivityEvent {
  id: string;
  timestamp: string;
  title: string;
  detail: string;
  level: 'info' | 'warning' | 'critical' | 'privacy';
}

export interface ExportPolicyRules {
  blockOnCredentials: boolean;
  blockOnPII: boolean;
  redactEmails: boolean;
  redactPhones: boolean;
  redactInternalIps: boolean;
  allowSanitizedSummaryExport: boolean;
}

export interface FlaggedFieldSummary {
  fieldType: string;
  category: 'Credential' | 'PII' | 'Financial' | 'Network';
  count: number;
  maskedPreview: string;
  actionTaken: 'Redacted' | 'Blocked' | 'Masked';
  weightPenalty: number;
}

export type DataClassification =
  | 'Public Operational'
  | 'Internal Telemetry'
  | 'Confidential PII'
  | 'Restricted Credentials';

export interface PrivacyInspectionRecord {
  id: string;
  timestamp: string;
  classification: DataClassification;
  decision: 'approved' | 'blocked';
  privacyScore: number;
  scoreBreakdown: string;
  explanation: string;
  flaggedFields: FlaggedFieldSummary[];
  redactedSummary: string;
  ruleApplied: string;
  byteLength: number;
}

export interface IncidentFingerprint {
  id: string;
  hash: string;
  category: string;
  severity: AlertSeverity;
  normalizedPattern: string;
  frequency: number;
  firstSeen: string;
  lastSeen: string;
  affectedComponentType: string;
}

export interface PredictiveWarning {
  id: string;
  systemId: string;
  systemName: string;
  category: SystemCategory;
  severity: 'warning' | 'critical';
  metric: 'CPU' | 'Memory' | 'Response Time';
  currentValue: number;
  threshold: number;
  trendDelta: number;
  ruleTriggered: string;
  explanation: string;
  recommendedMaintenance: string;
  detectedAt: string;
}

export interface VeilWatchSettings {
  organizationName: string;
  monitoringIntervalSec: 3 | 5 | 10 | 30;
  thresholds: {
    cpuWarning: number;
    cpuCritical: number;
    memoryWarning: number;
    memoryCritical: number;
    responseWarningMs: number;
    responseCriticalMs: number;
  };
  exportPolicy: ExportPolicyRules;
  notifications: {
    inAppBanner: boolean;
    browserNotifications: boolean;
  };
  theme: 'dark' | 'light';
  autoResolveEnabled?: boolean;
  globalSyncEnabled?: boolean;
}

export interface GlobalCompany {
  slug: string;
  name: string;
  companyType: 'public' | 'private';
  ticker: string | null;
  sector: string;
  region: string;
  country: string;
  statusPageUrl: string | null;
  feedKind: string;
  currentStatus: 'operational' | 'degraded' | 'outage' | 'maintenance';
  healthScore: number;
  latencyMs: number;
  isTracked: boolean;
  activeIncidentCount: number;
  latestSummary: string;
  lastSyncedAt: string;
}

export interface CompanyIncident {
  id: string;
  companySlug: string;
  companyName: string;
  companyType: 'public' | 'private';
  sector: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  sourceName: string;
  sourceUrl: string | null;
  detectedAt: string;
  resolvedAt: string | null;
  aiAnalysis: string;
  autoResolutionAction: string;
  rawPrecisionMetric: number;
}

export interface AgentHeartbeat {
  id: number;
  agentId: string;
  hostname: string;
  pythonVersion: string;
  osPlatform: string;
  cpuPct: number;
  memoryPct: number;
  diskPct: number;
  netInMbps: number;
  netOutMbps: number;
  latencyMs: number;
  activeProcesses: number;
  anomalyDetected: boolean;
  autoRemediationLog: string;
  recordedAt: string;
}

export type SimulationScenario =
  | 'normal'
  | 'performance_anomaly'
  | 'suspicious_access'
  | 'sensitive_export'
  | 'app_downtime';
