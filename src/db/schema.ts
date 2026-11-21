import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull().default('Security Operator'),
  passwordHash: text('password_hash'),
  authProvider: text('auth_provider').notNull().default('google'),
  role: text('role').notNull().default('operator'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastLoginAt: timestamp('last_login_at').defaultNow().notNull(),
});

export const monitoredSystems = pgTable('monitored_systems', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(), // 'server' | 'application' | 'network' | 'security'
  host: text('host').notNull(),
  region: text('region').notNull(),
  status: text('status').notNull().default('healthy'), // 'healthy' | 'warning' | 'critical'
  monitoringActive: boolean('monitoring_active').notNull().default(true),
  uptimePercent: doublePrecision('uptime_percent').notNull().default(99.99),
  cpuUsage: doublePrecision('cpu_usage').notNull().default(35.0),
  memoryUsage: doublePrecision('memory_usage').notNull().default(48.0),
  responseTimeMs: doublePrecision('response_time_ms').notNull().default(28.0),
  lastSeen: timestamp('last_seen').defaultNow().notNull(),
  notes: text('notes').notNull().default(''),
  historyJson: jsonb('history_json')
    .$type<{ label: string; cpu: number; memory: number; responseMs: number }[]>()
    .notNull()
    .default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const rawTelemetry = pgTable('raw_telemetry', {
  id: serial('id').primaryKey(),
  systemId: text('system_id').notNull(),
  recordedAt: timestamp('recorded_at').defaultNow().notNull(),
  label: text('label').notNull(),
  cpu: doublePrecision('cpu').notNull(),
  memory: doublePrecision('memory').notNull(),
  networkInMbps: doublePrecision('network_in_mbps').notNull(),
  networkOutMbps: doublePrecision('network_out_mbps').notNull(),
  responseMs: doublePrecision('response_ms').notNull(),
  diskIoPct: doublePrecision('disk_io_pct').notNull().default(24.5),
  errorRatePct: doublePrecision('error_rate_pct').notNull().default(0.02),
  source: text('source').notNull().default('system-collector'), // 'python-agent' | 'system-collector' | 'open-feed'
});

export const alerts = pgTable('alerts', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  severity: text('severity').notNull(), // 'low' | 'medium' | 'high' | 'critical'
  status: text('status').notNull().default('active'), // 'active' | 'acknowledged' | 'resolved'
  category: text('category').notNull(), // 'server' | 'application' | 'network' | 'security' | 'privacy' | 'company'
  systemId: text('system_id').notNull(),
  systemName: text('system_name').notNull(),
  companySlug: text('company_slug'),
  companyName: text('company_name'),
  sourceType: text('source_type').notNull().default('system'), // 'python-agent' | 'open-ai-feed' | 'privacy-radar' | 'simulation' | 'system'
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  recommendedAction: text('recommended_action').notNull(),
  resolutionNotes: text('resolution_notes'),
  autoResolved: boolean('auto_resolved').notNull().default(false),
  resolvedAt: timestamp('resolved_at'),
  fingerprintId: text('fingerprint_id').notNull(),
  simulationSource: text('simulation_source'),
});

export const incidentFingerprints = pgTable('incident_fingerprints', {
  id: text('id').primaryKey(),
  hash: text('hash').notNull().unique(),
  category: text('category').notNull(),
  severity: text('severity').notNull(),
  normalizedPattern: text('normalized_pattern').notNull(),
  frequency: integer('frequency').notNull().default(1),
  firstSeen: timestamp('first_seen').defaultNow().notNull(),
  lastSeen: timestamp('last_seen').defaultNow().notNull(),
  affectedComponentType: text('affected_component_type').notNull(),
});

export const privacyInspections = pgTable('privacy_inspections', {
  id: text('id').primaryKey(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  classification: text('classification').notNull(),
  decision: text('decision').notNull(), // 'approved' | 'blocked'
  privacyScore: integer('privacy_score').notNull(),
  scoreBreakdown: text('score_breakdown').notNull(),
  explanation: text('explanation').notNull(),
  flaggedFieldsJson: jsonb('flagged_fields_json')
    .$type<
      {
        fieldType: string;
        category: 'Credential' | 'PII' | 'Financial' | 'Network';
        count: number;
        maskedPreview: string;
        actionTaken: 'Redacted' | 'Blocked' | 'Masked';
        weightPenalty: number;
      }[]
    >()
    .notNull()
    .default([]),
  redactedSummary: text('redacted_summary').notNull(),
  ruleApplied: text('rule_applied').notNull(),
  byteLength: integer('byte_length').notNull(),
});

export const activityEvents = pgTable('activity_events', {
  id: text('id').primaryKey(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  title: text('title').notNull(),
  detail: text('detail').notNull(),
  level: text('level').notNull().default('info'), // 'info' | 'warning' | 'critical' | 'privacy'
});

export const workspaceSettings = pgTable('workspace_settings', {
  id: text('id').primaryKey(),
  organizationName: text('organization_name').notNull().default('Aurelia Vault Systems'),
  monitoringIntervalSec: integer('monitoring_interval_sec').notNull().default(5),
  thresholdsJson: jsonb('thresholds_json')
    .$type<{
      cpuWarning: number;
      cpuCritical: number;
      memoryWarning: number;
      memoryCritical: number;
      responseWarningMs: number;
      responseCriticalMs: number;
    }>()
    .notNull(),
  exportPolicyJson: jsonb('export_policy_json')
    .$type<{
      blockOnCredentials: boolean;
      blockOnPII: boolean;
      redactEmails: boolean;
      redactPhones: boolean;
      redactInternalIps: boolean;
      allowSanitizedSummaryExport: boolean;
    }>()
    .notNull(),
  notificationsJson: jsonb('notifications_json')
    .$type<{
      inAppBanner: boolean;
      browserNotifications: boolean;
    }>()
    .notNull(),
  theme: text('theme').notNull().default('light'),
  autoResolveEnabled: boolean('auto_resolve_enabled').notNull().default(true),
  globalSyncEnabled: boolean('global_sync_enabled').notNull().default(true),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const companies = pgTable('companies', {
  slug: text('slug').primaryKey(),
  name: text('name').notNull(),
  companyType: text('company_type').notNull(), // 'public' | 'private'
  ticker: text('ticker'),
  sector: text('sector').notNull(),
  region: text('region').notNull(),
  country: text('country').notNull(),
  statusPageUrl: text('status_page_url'),
  feedKind: text('feed_kind').notNull().default('ai-osint'), // 'statuspage-api' | 'ai-osint'
  currentStatus: text('current_status').notNull().default('operational'), // 'operational' | 'degraded' | 'outage' | 'maintenance'
  healthScore: doublePrecision('health_score').notNull().default(99.95),
  latencyMs: doublePrecision('latency_ms').notNull().default(42.5),
  isTracked: boolean('is_tracked').notNull().default(false),
  activeIncidentCount: integer('active_incident_count').notNull().default(0),
  latestSummary: text('latest_summary').notNull().default('All core services operating nominally.'),
  lastSyncedAt: timestamp('last_synced_at').defaultNow().notNull(),
});

export const companyIncidents = pgTable('company_incidents', {
  id: text('id').primaryKey(),
  companySlug: text('company_slug').notNull(),
  companyName: text('company_name').notNull(),
  companyType: text('company_type').notNull(),
  sector: text('sector').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  severity: text('severity').notNull(), // 'low' | 'medium' | 'high' | 'critical'
  status: text('status').notNull().default('investigating'), // 'investigating' | 'identified' | 'monitoring' | 'resolved'
  sourceName: text('source_name').notNull(),
  sourceUrl: text('source_url'),
  detectedAt: timestamp('detected_at').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at'),
  aiAnalysis: text('ai_analysis').notNull().default(''),
  autoResolutionAction: text('auto_resolution_action').notNull().default(''),
  rawPrecisionMetric: doublePrecision('raw_precision_metric').notNull().default(99.9),
});

export const agentHeartbeats = pgTable('agent_heartbeats', {
  id: serial('id').primaryKey(),
  agentId: text('agent_id').notNull(),
  hostname: text('hostname').notNull(),
  pythonVersion: text('python_version').notNull(),
  osPlatform: text('os_platform').notNull(),
  cpuPct: doublePrecision('cpu_pct').notNull(),
  memoryPct: doublePrecision('memory_pct').notNull(),
  diskPct: doublePrecision('disk_pct').notNull(),
  netInMbps: doublePrecision('net_in_mbps').notNull(),
  netOutMbps: doublePrecision('net_out_mbps').notNull(),
  latencyMs: doublePrecision('latency_ms').notNull(),
  activeProcesses: integer('active_processes').notNull(),
  anomalyDetected: boolean('anomaly_detected').notNull().default(false),
  autoRemediationLog: text('auto_remediation_log').notNull().default(''),
  recordedAt: timestamp('recorded_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, () => ({}));
export const companiesRelations = relations(companies, ({ many }) => ({
  incidents: many(companyIncidents),
}));
export const companyIncidentsRelations = relations(companyIncidents, ({ one }) => ({
  company: one(companies, {
    fields: [companyIncidents.companySlug],
    references: [companies.slug],
  }),
}));
