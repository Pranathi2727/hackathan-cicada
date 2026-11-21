import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Play,
  Terminal,
  Zap,
} from 'lucide-react';
import { useVeilWatch } from '../context/VeilWatchContext';

export const PythonAgentPage: React.FC = () => {
  const { agentHeartbeats, runPythonAgentSweep } = useVeilWatch();
  const [runningNormal, setRunningNormal] = useState(false);
  const [runningAnomaly, setRunningAnomaly] = useState(false);
  const [lastOutput, setLastOutput] = useState<string>('');

  const handleRun = async (simulateAnomaly: boolean) => {
    if (simulateAnomaly) setRunningAnomaly(true);
    else setRunningNormal(true);
    const res = await runPythonAgentSweep(simulateAnomaly);
    setLastOutput(res.detail || '');
    setRunningNormal(false);
    setRunningAnomaly(false);
  };

  const latest = agentHeartbeats[0] || null;

  return (
    <div className="space-y-6">
      {/* Python Agent Header & Execution Panel */}
      <section className="vw-glass-card vw-gradient-border rounded-2xl p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-mono text-[var(--vw-gold)] flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5" />
              Python 3 Monitoring Agent · Connected to PostgreSQL & Open Status Feeds
            </p>
            <h2 className="font-display text-lg sm:text-xl font-bold mt-1">
              Python Host Telemetry & Auto-Remediation Agent
            </h2>
            <p className="text-xs text-[var(--vw-text-muted)] mt-1 max-w-2xl">
              Executes <code className="font-mono text-[var(--vw-gold)]">agent/veilwatch_agent.py</code>{' '}
              to capture 2-decimal precision Linux CPU, memory, disk, network, and process metrics,
              probe open-source status endpoints, and automatically resolve problems in PostgreSQL.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              disabled={runningNormal || runningAnomaly}
              onClick={() => handleRun(false)}
              className="vw-gradient-btn inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold disabled:opacity-60 cursor-pointer"
            >
              <Play className="w-4 h-4" />
              {runningNormal ? 'Running Python Sweep...' : 'Run Live Python Sweep'}
            </button>

            <button
              type="button"
              disabled={runningNormal || runningAnomaly}
              onClick={() => handleRun(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border border-[var(--vw-amber)]/60 bg-[var(--vw-surface)] hover:bg-[var(--vw-gold-soft)] text-[var(--vw-text)] transition-colors disabled:opacity-60 cursor-pointer"
            >
              <Zap className="w-4 h-4 text-[var(--vw-amber)]" />
              {runningAnomaly ? 'Detecting & Resolving...' : 'Simulate Anomaly & Auto-Resolve'}
            </button>
          </div>
        </div>

        {lastOutput && (
          <div className="p-3.5 rounded-xl bg-[var(--vw-surface-muted)]/70 border border-[var(--vw-border)] text-xs font-mono text-[var(--vw-text)]">
            Last Python Sweep: {lastOutput}
          </div>
        )}

        {/* Latest Precision Telemetry Cards */}
        {latest && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3.5 rounded-xl bg-[var(--vw-bg)]/75 border border-[var(--vw-border)]">
              <p className="text-[11px] text-[var(--vw-text-muted)]">Agent CPU</p>
              <p className="font-mono text-xl font-bold tabular-nums">{latest.cpuPct.toFixed(2)}%</p>
            </div>
            <div className="p-3.5 rounded-xl bg-[var(--vw-bg)]/75 border border-[var(--vw-border)]">
              <p className="text-[11px] text-[var(--vw-text-muted)]">Agent Memory</p>
              <p className="font-mono text-xl font-bold tabular-nums">{latest.memoryPct.toFixed(2)}%</p>
            </div>
            <div className="p-3.5 rounded-xl bg-[var(--vw-bg)]/75 border border-[var(--vw-border)]">
              <p className="text-[11px] text-[var(--vw-text-muted)]">Disk Usage</p>
              <p className="font-mono text-xl font-bold tabular-nums">{latest.diskPct.toFixed(2)}%</p>
            </div>
            <div className="p-3.5 rounded-xl bg-[var(--vw-bg)]/75 border border-[var(--vw-border)]">
              <p className="text-[11px] text-[var(--vw-text-muted)]">Probe Latency</p>
              <p className="font-mono text-xl font-bold tabular-nums">{latest.latencyMs.toFixed(2)}ms</p>
            </div>
            <div className="p-3.5 rounded-xl bg-[var(--vw-bg)]/75 border border-[var(--vw-border)]">
              <p className="text-[11px] text-[var(--vw-text-muted)]">Active Procs</p>
              <p className="font-mono text-xl font-bold tabular-nums">{latest.activeProcesses}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-[var(--vw-bg)]/75 border border-[var(--vw-border)]">
              <p className="text-[11px] text-[var(--vw-text-muted)]">Python Runtime</p>
              <p className="font-mono text-lg font-bold tabular-nums text-[var(--vw-gold)]">
                v{latest.pythonVersion}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Raw Python Heartbeats SQL Log */}
      <section className="vw-glass-card rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-base font-bold flex items-center gap-2">
              <Activity className="w-4 h-4 text-[var(--vw-gold)]" />
              Raw Python Agent Heartbeats (PostgreSQL)
            </h3>
            <p className="text-xs text-[var(--vw-text-muted)]">
              Exact 2-decimal precision telemetry rows persisted in <code className="font-mono">agent_heartbeats</code>
            </p>
          </div>
        </div>

        {agentHeartbeats.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <Cpu className="w-8 h-8 text-[var(--vw-gold)] mx-auto" />
            <p className="text-sm font-semibold">No Python agent heartbeats recorded yet</p>
            <p className="text-xs text-[var(--vw-text-muted)]">
              Click &ldquo;Run Live Python Sweep&rdquo; above to collect live OS metrics and open-source
              status checks into PostgreSQL.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[880px] text-xs">
              <thead>
                <tr className="border-b border-[var(--vw-border)] text-[11px] font-mono text-[var(--vw-text-muted)]">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Agent & Host</th>
                  <th className="py-2.5 px-3 text-right">CPU %</th>
                  <th className="py-2.5 px-3 text-right">Mem %</th>
                  <th className="py-2.5 px-3 text-right">Disk %</th>
                  <th className="py-2.5 px-3 text-right">Net In/Out</th>
                  <th className="py-2.5 px-3 text-right">Latency</th>
                  <th className="py-2.5 px-3">Status & Auto-Remediation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--vw-border)]">
                {agentHeartbeats.map((hb) => (
                  <tr key={hb.id} className="hover:bg-[var(--vw-surface-muted)]/35">
                    <td className="py-3 px-3 font-mono tabular-nums text-[var(--vw-text-muted)]">
                      {new Date(hb.recordedAt).toLocaleTimeString()}
                    </td>
                    <td className="py-3 px-3">
                      <p className="font-semibold text-[var(--vw-text)]">{hb.agentId}</p>
                      <p className="font-mono text-[11px] text-[var(--vw-text-muted)]">
                        {hb.osPlatform} · Py {hb.pythonVersion}
                      </p>
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">{hb.cpuPct.toFixed(2)}%</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">{hb.memoryPct.toFixed(2)}%</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">{hb.diskPct.toFixed(2)}%</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      {hb.netInMbps.toFixed(2)} / {hb.netOutMbps.toFixed(2)}M
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">{hb.latencyMs.toFixed(2)}ms</td>
                    <td className="py-3 px-3">
                      {hb.anomalyDetected ? (
                        <span className="inline-flex items-center gap-1 text-[var(--vw-warn)] font-semibold mr-2">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Anomaly
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[var(--vw-ok)] font-semibold mr-2">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Nominal
                        </span>
                      )}
                      <span className="text-[11px] text-[var(--vw-text-muted)]">
                        {hb.autoRemediationLog}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* External Agent CLI Guide */}
      <section className="vw-glass-card rounded-2xl p-6 space-y-3">
        <h3 className="font-display text-sm font-bold">Connect Remote Python Nodes to PostgreSQL / Backend</h3>
        <pre className="p-4 rounded-xl bg-[#1D1710] text-[#F5C542] text-xs font-mono overflow-x-auto leading-relaxed">
{`# Install optional psutil & psycopg2 dependencies
pip install -r agent/requirements.txt

# Mode A: Continuous HTTP push to VEILWATCH backend
VEILWATCH_SERVER_URL="http://localhost:3000" VEILWATCH_AGENT_TOKEN="<session_bearer_token>" \\
  python3 agent/veilwatch_agent.py --interval 10

# Mode B: Direct PostgreSQL (Cloud SQL) write
python3 agent/veilwatch_agent.py --once --direct-sql`}
        </pre>
      </section>
    </div>
  );
};
