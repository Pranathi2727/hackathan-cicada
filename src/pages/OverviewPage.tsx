import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Database,
  Globe,
  ShieldCheck,
  Terminal,
  XCircle,
} from 'lucide-react';
import { CpuMemoryChart, NetworkTrafficChart } from '../components/Charts';
import { InfoTooltip } from '../components/InfoTooltip';
import { useVeilWatch } from '../context/VeilWatchContext';
import { TimeRange } from '../types/veilwatch';

const TIME_RANGES: { id: TimeRange; label: string; sliceCount: number }[] = [
  { id: '15m', label: '15m', sliceCount: 8 },
  { id: '1h', label: '1h', sliceCount: 16 },
  { id: '6h', label: '6h', sliceCount: 24 },
  { id: '24h', label: '24h', sliceCount: 36 },
];

export const OverviewPage: React.FC = () => {
  const {
    systems,
    alerts,
    inspections,
    activity,
    telemetry,
    forecast,
    companies,
    agentHeartbeats,
    lastUpdated,
    settings,
    navigateToPage,
  } = useVeilWatch();

  const [timeRange, setTimeRange] = useState<TimeRange>('1h');

  const stats = useMemo(() => {
    const total = systems.length;
    const healthy = systems.filter((s) => s.status === 'healthy').length;
    const warning = systems.filter((s) => s.status === 'warning').length;
    const critical = systems.filter((s) => s.status === 'critical').length;

    const healthScore =
      total === 0
        ? 100
        : Number(
            Math.max(
              0,
              ((healthy * 100 + warning * 62 + critical * 22) / (total * 100)) * 100
            ).toFixed(2)
          );

    const avgInspectionScore =
      inspections.length === 0
        ? 95
        : inspections.reduce((acc, item) => acc + item.privacyScore, 0) / inspections.length;

    const enabledRulesCount = Object.values(settings.exportPolicy).filter(Boolean).length;
    const policyBonus = (enabledRulesCount / 6) * 8;
    const privacyProtectionScore = Math.min(100, Math.round(avgInspectionScore * 0.92 + policyBonus));

    const trackedCompanies = companies.filter((c) => c.isTracked).length;

    return {
      total,
      healthy,
      warning,
      critical,
      healthScore,
      privacyProtectionScore,
      trackedCompanies,
    };
  }, [companies, inspections, settings.exportPolicy, systems]);

  const rangedTelemetry = useMemo(() => {
    const cfg = TIME_RANGES.find((t) => t.id === timeRange) || TIME_RANGES[1];
    return telemetry.slice(-cfg.sliceCount);
  }, [telemetry, timeRange]);

  const recentIncidents = useMemo(() => alerts.slice(0, 4), [alerts]);
  const rawRows = useMemo(() => [...telemetry].reverse().slice(0, 8), [telemetry]);

  return (
    <div className="space-y-6">
      {/* Top Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-mono text-[var(--vw-gold)]">
            PostgreSQL Raw Telemetry · Present + Upcoming {forecast.horizonMinutes}m Forecast (Accuracy{' '}
            {forecast.accuracyPct.toFixed(2)}% · R²={forecast.rSquaredCpu.toFixed(2)})
          </p>
          <div className="flex items-center gap-2 mt-1 text-xs text-[var(--vw-text-muted)]">
            <Clock className="w-3.5 h-3.5" />
            <span>
              Last updated:{' '}
              <span className="font-mono tabular-nums text-[var(--vw-text)]">
                {new Date(lastUpdated).toLocaleTimeString()}
              </span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--vw-surface)] border border-[var(--vw-border)] self-start sm:self-auto">
          {TIME_RANGES.map((range) => (
            <button
              key={range.id}
              type="button"
              onClick={() => setTimeRange(range.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                timeRange === range.id
                  ? 'bg-[var(--vw-gold-soft)] text-[var(--vw-gold)] border border-[var(--vw-gold)]/30'
                  : 'text-[var(--vw-text-muted)] hover:text-[var(--vw-text)]'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Primary KPI Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="vw-glass-card rounded-2xl p-5">
          <p className="text-xs text-[var(--vw-text-muted)] mb-2">Total Monitored</p>
          <p className="font-display text-3xl font-bold tabular-nums text-[var(--vw-text)]">
            {stats.total}
          </p>
          <p className="text-xs text-[var(--vw-text-muted)] mt-1">PostgreSQL nodes</p>
        </div>

        <div className="vw-glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-[var(--vw-text-muted)]">Healthy Systems</p>
            <CheckCircle2 className="w-4 h-4 text-[var(--vw-ok)]" />
          </div>
          <p className="font-display text-3xl font-bold tabular-nums text-[var(--vw-ok)]">
            {stats.healthy}
          </p>
          <p className="text-xs text-[var(--vw-text-muted)] mt-1">Within nominal range</p>
        </div>

        <div className="vw-glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-[var(--vw-text-muted)]">Warning Systems</p>
            <AlertTriangle className="w-4 h-4 text-[var(--vw-warn)]" />
          </div>
          <p className="font-display text-3xl font-bold tabular-nums text-[var(--vw-warn)]">
            {stats.warning}
          </p>
          <p className="text-xs text-[var(--vw-text-muted)] mt-1">Approaching threshold</p>
        </div>

        <div className="vw-glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-[var(--vw-text-muted)]">Critical Systems</p>
            <XCircle className="w-4 h-4 text-[var(--vw-crit)]" />
          </div>
          <p className="font-display text-3xl font-bold tabular-nums text-[var(--vw-crit)]">
            {stats.critical}
          </p>
          <p className="text-xs text-[var(--vw-text-muted)] mt-1">Immediate triage needed</p>
        </div>

        <div className="vw-glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="inline-flex items-center gap-1.5 text-xs text-[var(--vw-text-muted)]">
              Infra Health
              <InfoTooltip
                label="Infrastructure Health"
                explanation="High-precision weighted fleet composite across Healthy, Warning, and Critical nodes."
              />
            </span>
            <Activity className="w-4 h-4 text-[var(--vw-amber)]" />
          </div>
          <p className="font-display text-3xl font-bold tabular-nums text-[var(--vw-gold)]">
            {stats.healthScore.toFixed(2)}%
          </p>
          <p className="text-xs text-[var(--vw-text-muted)] mt-1">Precision composite</p>
        </div>

        <div className="vw-glass-card vw-gradient-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="inline-flex items-center gap-1.5 text-xs text-[var(--vw-text-muted)]">
              Privacy Score
              <InfoTooltip
                label="Privacy Protection Score"
                explanation="Derived from local Privacy Leak Radar inspection outcomes (92%) and active export policy safeguards (8%)."
              />
            </span>
            <ShieldCheck className="w-4 h-4 text-[var(--vw-gold)]" />
          </div>
          <p className="font-display text-3xl font-bold tabular-nums text-[var(--vw-gold)]">
            {stats.privacyProtectionScore}
            <span className="text-sm font-normal text-[var(--vw-text-muted)]">/100</span>
          </p>
          <p className="text-xs text-[var(--vw-text-muted)] mt-1">Local policy posture</p>
        </div>
      </section>

      {/* Quick Operational Links: Global Companies + Python Agent */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => navigateToPage('global-companies')}
          className="vw-glass-card rounded-2xl p-5 text-left hover:border-[var(--vw-amber)] transition-all flex items-center justify-between gap-4 cursor-pointer"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[var(--vw-gold-soft)] flex items-center justify-center shrink-0">
              <Globe className="w-5 h-5 text-[var(--vw-gold)]" />
            </div>
            <div>
              <p className="font-display text-sm font-bold">
                Worldwide Public &amp; Private Companies ({companies.length})
              </p>
              <p className="text-xs text-[var(--vw-text-muted)]">
                {stats.trackedCompanies} tracked on watchlist · Sync open status APIs &amp; Gemini AI
              </p>
            </div>
          </div>
          <ArrowUpRight className="w-4 h-4 text-[var(--vw-gold)] shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => navigateToPage('python-agent')}
          className="vw-glass-card rounded-2xl p-5 text-left hover:border-[var(--vw-amber)] transition-all flex items-center justify-between gap-4 cursor-pointer"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[var(--vw-gold-soft)] flex items-center justify-center shrink-0">
              <Terminal className="w-5 h-5 text-[var(--vw-gold)]" />
            </div>
            <div>
              <p className="font-display text-sm font-bold">
                Python Monitoring Agent ({agentHeartbeats.length} heartbeats)
              </p>
              <p className="text-xs text-[var(--vw-text-muted)]">
                Live host metrics, open-source feed polling &amp; automated incident resolution
              </p>
            </div>
          </div>
          <ArrowUpRight className="w-4 h-4 text-[var(--vw-gold)] shrink-0" />
        </button>
      </section>

      {/* Present + Future Forecast Telemetry Charts */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="vw-glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-base font-bold text-[var(--vw-text)]">
                CPU &amp; Memory Utilization (Present + Upcoming +{forecast.horizonMinutes}m)
              </h2>
              <p className="text-xs text-[var(--vw-text-muted)]">
                Solid: Observed Raw SQL · Dashed: Linear Forecast (MAE {forecast.maeCpu.toFixed(2)}%)
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigateToPage('predictive-health')}
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--vw-gold)] hover:underline cursor-pointer"
            >
              Forecast Details <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="h-64">
            <CpuMemoryChart
              data={rangedTelemetry}
              forecast={forecast.futurePoints}
              theme={settings.theme}
            />
          </div>
        </div>

        <div className="vw-glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-base font-bold text-[var(--vw-text)]">
                Network Traffic &amp; Projected Bandwidth (+{forecast.horizonMinutes}m)
              </h2>
              <p className="text-xs text-[var(--vw-text-muted)]">
                2-decimal precision ingress vs sanitized egress · Window: {timeRange}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigateToPage('infrastructure')}
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--vw-gold)] hover:underline cursor-pointer"
            >
              Inspect Nodes <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="h-64">
            <NetworkTrafficChart
              data={rangedTelemetry}
              forecast={forecast.futurePoints}
              theme={settings.theme}
            />
          </div>
        </div>
      </section>

      {/* High-Precision Raw SQL Telemetry Stream */}
      <section className="vw-glass-card rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-bold text-[var(--vw-text)] flex items-center gap-2">
              <Database className="w-4 h-4 text-[var(--vw-gold)]" />
              Raw High-Precision SQL Telemetry Rows
            </h2>
            <p className="text-xs text-[var(--vw-text-muted)]">
              Unrounded 2-decimal precision metrics persisted in <code className="font-mono">raw_telemetry</code>
            </p>
          </div>
          <span className="font-mono text-xs text-[var(--vw-gold)]">
            Projected Next Risk: {forecast.projectedRiskLevel.toUpperCase()}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[780px] text-xs">
            <thead>
              <tr className="border-b border-[var(--vw-border)] text-[11px] font-mono text-[var(--vw-text-muted)]">
                <th className="py-2 px-3">Recorded At</th>
                <th className="py-2 px-3">Source</th>
                <th className="py-2 px-3 text-right">CPU %</th>
                <th className="py-2 px-3 text-right">Memory %</th>
                <th className="py-2 px-3 text-right">Net In (Mbps)</th>
                <th className="py-2 px-3 text-right">Net Out (Mbps)</th>
                <th className="py-2 px-3 text-right">Latency (ms)</th>
                <th className="py-2 px-3 text-right">Disk I/O %</th>
                <th className="py-2 px-3 text-right">Err Rate %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--vw-border)] font-mono tabular-nums">
              {rawRows.map((row, idx) => (
                <tr key={`${row.timestamp}-${idx}`} className="hover:bg-[var(--vw-surface-muted)]/35">
                  <td className="py-2.5 px-3 text-[var(--vw-text-muted)]">{row.label}</td>
                  <td className="py-2.5 px-3 text-[var(--vw-gold)]">{row.source || 'system-collector'}</td>
                  <td className="py-2.5 px-3 text-right">{row.cpu.toFixed(2)}%</td>
                  <td className="py-2.5 px-3 text-right">{row.memory.toFixed(2)}%</td>
                  <td className="py-2.5 px-3 text-right">{row.networkInMbps.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-right">{row.networkOutMbps.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-right">{row.responseMs.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-right">{(row.diskIoPct ?? 24.5).toFixed(2)}%</td>
                  <td className="py-2.5 px-3 text-right">{(row.errorRatePct ?? 0.02).toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent Incidents & Live Activity Feed */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Recent Incidents */}
        <div className="vw-glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-base font-bold text-[var(--vw-text)]">
                Recent Incidents
              </h2>
              <p className="text-xs text-[var(--vw-text-muted)]">
                Latest PostgreSQL alerts with SHA-256 non-PII fingerprints &amp; AI resolution
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigateToPage('smart-alerts')}
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--vw-gold)] hover:underline cursor-pointer"
            >
              Manage Alerts <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentIncidents.length === 0 ? (
            <p className="text-sm text-[var(--vw-text-muted)] py-8 text-center">
              No recent incidents recorded.
            </p>
          ) : (
            <div className="divide-y divide-[var(--vw-border)]">
              {recentIncidents.map((alert) => (
                <div
                  key={alert.id}
                  className="py-3.5 flex items-start justify-between gap-4 first:pt-1 last:pb-1"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-[var(--vw-text-muted)] mb-1">
                      <span
                        className={`font-mono uppercase font-semibold ${
                          alert.severity === 'critical'
                            ? 'text-[var(--vw-crit)]'
                            : alert.severity === 'high'
                              ? 'text-[var(--vw-warn)]'
                              : alert.severity === 'medium'
                                ? 'text-[var(--vw-gold)]'
                                : 'text-[var(--vw-text-muted)]'
                        }`}
                      >
                        {alert.severity}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{alert.systemName}</span>
                      <span aria-hidden="true">·</span>
                      <span className="capitalize">
                        {alert.autoResolved ? 'auto-resolved' : alert.status}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-[var(--vw-text)] truncate">
                      {alert.title}
                    </p>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-[var(--vw-text-muted)] shrink-0">
                    {new Date(alert.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live Activity Feed */}
        <div className="vw-glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-base font-bold text-[var(--vw-text)]">
                Live Activity Feed
              </h2>
              <p className="text-xs text-[var(--vw-text-muted)]">
                Real-time PostgreSQL sweep events, Python agent logs &amp; privacy gate decisions
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigateToPage('privacy-radar')}
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--vw-gold)] hover:underline cursor-pointer"
            >
              Test Privacy Radar <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-[var(--vw-border)] max-h-72 overflow-y-auto pr-1">
            {activity.slice(0, 7).map((item) => (
              <div key={item.id} className="py-3 flex items-start justify-between gap-4 first:pt-1">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--vw-text)]">{item.title}</p>
                  <p className="text-xs text-[var(--vw-text-muted)] mt-0.5">{item.detail}</p>
                </div>
                <span className="text-xs font-mono tabular-nums text-[var(--vw-text-muted)] shrink-0">
                  {new Date(item.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
