import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  Globe,
  Pause,
  Play,
  Plus,
  Search,
  Server,
  Shield,
  Terminal,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { useVeilWatch } from '../context/VeilWatchContext';
import { HealthStatus, MonitoredSystem, SystemCategory } from '../types/veilwatch';

const CATEGORY_SECTIONS: {
  id: SystemCategory;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'server', title: 'Servers & Python Agents', subtitle: 'Compute hosts & live Python monitoring agents', icon: Server },
  { id: 'application', title: 'Applications', subtitle: 'Microservices & authentication gateways', icon: Activity },
  { id: 'network', title: 'Networks', subtitle: 'Ingress meshes & egress policy proxies', icon: Globe },
  { id: 'security', title: 'Security Events', subtitle: 'Privacy enforcers & anomaly correlators', icon: Shield },
];

export const InfrastructurePage: React.FC = () => {
  const {
    systems,
    addSystem,
    toggleSystemMonitoring,
    removeSystem,
    runPythonAgentSweep,
    navigateToPage,
  } = useVeilWatch();

  const [categoryTab, setCategoryTab] = useState<'all' | SystemCategory>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | HealthStatus | 'paused'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [agentRunning, setAgentRunning] = useState(false);
  const [agentOutput, setAgentOutput] = useState<string>('');

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [detailSystem, setDetailSystem] = useState<MonitoredSystem | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<MonitoredSystem | null>(null);

  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<SystemCategory>('server');
  const [formHost, setFormHost] = useState('');
  const [formRegion, setFormRegion] = useState('us-east-enclave');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const filteredSystems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return systems.filter((sys) => {
      if (categoryTab !== 'all' && sys.category !== categoryTab) return false;
      if (statusFilter === 'paused' && sys.monitoringActive) return false;
      if (statusFilter !== 'all' && statusFilter !== 'paused' && sys.status !== statusFilter) {
        return false;
      }
      if (q) {
        const hay = `${sys.name} ${sys.id} ${sys.host} ${sys.region}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [categoryTab, searchQuery, statusFilter, systems]);

  const sectionsToRender =
    categoryTab === 'all'
      ? CATEGORY_SECTIONS
      : CATEGORY_SECTIONS.filter((sec) => sec.id === categoryTab);

  const handleRunPythonAgent = async () => {
    setAgentRunning(true);
    setAgentOutput('');
    const res = await runPythonAgentSweep(false);
    setAgentRunning(false);
    setAgentOutput(res.detail || (res.ok ? 'Python agent sweep completed.' : 'Sweep failed.'));
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (formName.trim().length < 3) {
      setFormError('System name must be at least 3 characters.');
      return;
    }
    if (formHost.trim().length < 3 || /\s/.test(formHost.trim())) {
      setFormError('Host identifier must be at least 3 characters with no spaces.');
      return;
    }

    setSubmitting(true);
    const res = await addSystem({
      name: formName.trim(),
      category: formCategory,
      host: formHost.trim(),
      region: formRegion.trim(),
      notes: formNotes.trim(),
    });
    setSubmitting(false);

    if (!res.ok) {
      setFormError(res.error || 'Validation failed.');
      return;
    }
    setFormName('');
    setFormHost('');
    setFormNotes('');
    setAddModalOpen(false);
  };

  const renderStatusLabel = (sys: MonitoredSystem) => {
    if (!sys.monitoringActive) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--vw-text-muted)]">
          <Pause className="w-3.5 h-3.5" />
          Paused
        </span>
      );
    }
    if (sys.status === 'healthy') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--vw-ok)]">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Healthy
        </span>
      );
    }
    if (sys.status === 'warning') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--vw-warn)]">
          <AlertTriangle className="w-3.5 h-3.5" />
          Warning
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--vw-crit)]">
        <XCircle className="w-3.5 h-3.5" />
        Critical
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Live Python Monitoring Agent Bridge */}
      <section className="vw-glass-card vw-gradient-border rounded-2xl p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-[var(--vw-gold)]" />
              <h2 className="font-display text-base font-bold">
                Python 3 Monitoring Agent ↔ SQL & Supabase Bridge
              </h2>
            </div>
            <p className="text-xs text-[var(--vw-text-muted)] leading-relaxed">
              Executes <code className="text-[var(--vw-gold)]">agent/veilwatch_agent.py</code> to
              read real Linux host CPU, memory, network RX/TX, disk I/O, and socket latency, then
              writes precision samples to SQL & Supabase REST API with automatic threshold
              remediation.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => navigateToPage('python-agent')}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border border-[var(--vw-border)] bg-[var(--vw-surface)] hover:border-[var(--vw-gold)] text-[var(--vw-text)] cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[var(--vw-gold)]" />
              Open Python Agent Console
            </button>
            <button
              type="button"
              disabled={agentRunning}
              onClick={handleRunPythonAgent}
              className="vw-gradient-btn inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-60"
            >
              <Play className="w-3.5 h-3.5" />
              {agentRunning ? 'Sampling Python Host...' : 'Run Python Agent Sweep Now'}
            </button>
          </div>
        </div>

        {agentOutput && (
          <pre className="p-3.5 rounded-xl bg-[var(--vw-bg)] border border-[var(--vw-border)] text-[11px] font-mono overflow-x-auto max-h-48 text-[var(--vw-text)]">
            {agentOutput}
          </pre>
        )}
      </section>

      {/* Header & Add System */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-mono text-[var(--vw-gold)]">
            SQL Infrastructure Inventory · Precision 2-Decimal Telemetry
          </p>
          <p className="text-sm text-[var(--vw-text-muted)] mt-1">
            Monitor servers, Python agents, applications, networks, and security nodes.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setFormError('');
            setAddModalOpen(true);
          }}
          className="vw-gradient-btn inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap shrink-0 self-start md:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Monitored Node
        </button>
      </div>

      {/* Category & Filter Controls */}
      <div className="vw-glass-card rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[var(--vw-surface-muted)]/70 border border-[var(--vw-border)]">
          <button
            type="button"
            onClick={() => setCategoryTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              categoryTab === 'all'
                ? 'bg-[var(--vw-gold-soft)] text-[var(--vw-gold)]'
                : 'text-[var(--vw-text-muted)] hover:text-[var(--vw-text)]'
            }`}
          >
            All Sections
          </button>
          {CATEGORY_SECTIONS.map((sec) => (
            <button
              key={sec.id}
              type="button"
              onClick={() => setCategoryTab(sec.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                categoryTab === sec.id
                  ? 'bg-[var(--vw-gold-soft)] text-[var(--vw-gold)]'
                  : 'text-[var(--vw-text-muted)] hover:text-[var(--vw-text)]'
              }`}
            >
              {sec.title}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-[var(--vw-text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, ID, host..."
              aria-label="Search monitored systems"
              className="w-full sm:w-56 pl-9 pr-3 py-2 rounded-xl bg-[var(--vw-bg)] border border-[var(--vw-border)] text-xs text-[var(--vw-text)] placeholder:text-[var(--vw-text-muted)] focus:outline-none focus:border-[var(--vw-gold)]"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            aria-label="Filter by health status"
            className="px-3 py-2 rounded-xl bg-[var(--vw-bg)] border border-[var(--vw-border)] text-xs text-[var(--vw-text)] focus:outline-none focus:border-[var(--vw-gold)]"
          >
            <option value="all">All Health States</option>
            <option value="healthy">Healthy</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
            <option value="paused">Monitoring Paused</option>
          </select>
        </div>
      </div>

      {filteredSystems.length === 0 ? (
        <div className="vw-glass-card rounded-2xl p-10 text-center">
          <p className="font-display text-base font-semibold text-[var(--vw-text)] mb-1">
            No systems match your current filters
          </p>
          <button
            type="button"
            onClick={() => {
              setCategoryTab('all');
              setStatusFilter('all');
              setSearchQuery('');
            }}
            className="mt-3 px-4 py-2 rounded-xl text-xs font-semibold border border-[var(--vw-border)] bg-[var(--vw-surface-muted)] cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {sectionsToRender.map((sec) => {
            const Icon = sec.icon;
            const sectionNodes = filteredSystems.filter((s) => s.category === sec.id);
            if (sectionNodes.length === 0) return null;

            return (
              <section key={sec.id} className="space-y-3">
                <div className="flex items-center justify-between border-b border-[var(--vw-border)] pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 text-[var(--vw-gold)]" />
                    <h2 className="font-display text-base font-bold text-[var(--vw-text)]">
                      {sec.title}
                    </h2>
                    <span className="text-xs text-[var(--vw-text-muted)] hidden sm:inline">
                      · {sec.subtitle}
                    </span>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-[var(--vw-text-muted)]">
                    {sectionNodes.length} node{sectionNodes.length === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="vw-glass-card rounded-2xl overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[840px]">
                    <thead>
                      <tr className="border-b border-[var(--vw-border)] text-[11px] font-mono text-[var(--vw-text-muted)]">
                        <th className="py-3 px-4 font-medium">System & ID</th>
                        <th className="py-3 px-4 font-medium">Status</th>
                        <th className="py-3 px-4 font-medium text-right">Uptime</th>
                        <th className="py-3 px-4 font-medium text-right">CPU</th>
                        <th className="py-3 px-4 font-medium text-right">Memory</th>
                        <th className="py-3 px-4 font-medium text-right">Latency</th>
                        <th className="py-3 px-4 font-medium text-right">Last Seen</th>
                        <th className="py-3 px-4 font-medium text-right">Controls</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--vw-border)] text-xs">
                      {sectionNodes.map((sys) => (
                        <tr
                          key={sys.id}
                          className="hover:bg-[var(--vw-surface-muted)]/40 transition-colors"
                        >
                          <td className="py-3.5 px-4">
                            <p className="font-semibold text-[var(--vw-text)]">{sys.name}</p>
                            <p className="font-mono text-[11px] text-[var(--vw-text-muted)]">
                              {sys.id} · {sys.host} · {sys.region}
                            </p>
                          </td>
                          <td className="py-3.5 px-4">{renderStatusLabel(sys)}</td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                            {sys.uptimePercent.toFixed(3)}%
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                            {sys.cpuUsage.toFixed(2)}%
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                            {sys.memoryUsage.toFixed(2)}%
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                            {sys.responseTimeMs.toFixed(2)}ms
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[var(--vw-text-muted)]">
                            {new Date(sys.lastSeen).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setDetailSystem(sys)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--vw-border)] hover:border-[var(--vw-gold)]/50 text-[var(--vw-text)] cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Details
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleSystemMonitoring(sys.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--vw-border)] hover:border-[var(--vw-gold)]/50 text-[var(--vw-text)] cursor-pointer"
                              >
                                {sys.monitoringActive ? (
                                  <>
                                    <Pause className="w-3.5 h-3.5 text-[var(--vw-gold)]" />
                                    Pause
                                  </>
                                ) : (
                                  <>
                                    <Play className="w-3.5 h-3.5 text-[var(--vw-ok)]" />
                                    Start
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmRemove(sys)}
                                aria-label={`Remove ${sys.name}`}
                                className="inline-flex items-center justify-center p-1.5 rounded-lg border border-[var(--vw-border)] hover:border-[var(--vw-crit)]/60 text-[var(--vw-text-muted)] hover:text-[var(--vw-crit)] cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Add System Modal */}
      {addModalOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-md vw-glass-card rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-bold">Add Monitored Node</h2>
                <p className="text-xs text-[var(--vw-text-muted)]">Persisted in SQL & mirrored to Supabase</p>
              </div>
              <button type="button" onClick={() => setAddModalOpen(false)} className="p-1.5 rounded-lg text-[var(--vw-text-muted)] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--vw-text-muted)] mb-1.5">System Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Enclave Telemetry Relay 04"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--vw-bg)] border border-[var(--vw-border)] text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--vw-text-muted)] mb-1.5">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as SystemCategory)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[var(--vw-bg)] border border-[var(--vw-border)] text-sm"
                  >
                    <option value="server">Server</option>
                    <option value="application">Application</option>
                    <option value="network">Network</option>
                    <option value="security">Security Event</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--vw-text-muted)] mb-1.5">Environment Zone</label>
                  <input
                    type="text"
                    required
                    value={formRegion}
                    onChange={(e) => setFormRegion(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[var(--vw-bg)] border border-[var(--vw-border)] text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--vw-text-muted)] mb-1.5">Host / Endpoint Identifier</label>
                <input
                  type="text"
                  required
                  value={formHost}
                  onChange={(e) => setFormHost(e.target.value)}
                  placeholder="relay-04.internal.enclave"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--vw-bg)] border border-[var(--vw-border)] text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--vw-text-muted)] mb-1.5">Notes (Optional)</label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--vw-bg)] border border-[var(--vw-border)] text-sm"
                />
              </div>

              {formError && <p className="text-xs text-[var(--vw-crit)]">{formError}</p>}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setAddModalOpen(false)} className="px-4 py-2 rounded-xl text-xs border border-[var(--vw-border)] cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="vw-gradient-btn px-5 py-2 rounded-xl text-xs font-semibold cursor-pointer">
                  {submitting ? 'Saving...' : 'Register System'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* System Detail Modal */}
      {detailSystem && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-lg vw-glass-card rounded-2xl p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs text-[var(--vw-gold)]">{detailSystem.id} · {detailSystem.category}</p>
                <h2 className="font-display text-lg font-bold mt-1">{detailSystem.name}</h2>
                <p className="text-xs text-[var(--vw-text-muted)]">{detailSystem.host} · {detailSystem.region}</p>
              </div>
              <button type="button" onClick={() => setDetailSystem(null)} className="p-1.5 rounded-lg text-[var(--vw-text-muted)] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-[var(--vw-surface-muted)]/60 border border-[var(--vw-border)]">
                <p className="text-[11px] text-[var(--vw-text-muted)]">CPU Load</p>
                <p className="font-mono text-lg font-bold tabular-nums">{detailSystem.cpuUsage.toFixed(2)}%</p>
              </div>
              <div className="p-3 rounded-xl bg-[var(--vw-surface-muted)]/60 border border-[var(--vw-border)]">
                <p className="text-[11px] text-[var(--vw-text-muted)]">Memory</p>
                <p className="font-mono text-lg font-bold tabular-nums">{detailSystem.memoryUsage.toFixed(2)}%</p>
              </div>
              <div className="p-3 rounded-xl bg-[var(--vw-surface-muted)]/60 border border-[var(--vw-border)]">
                <p className="text-[11px] text-[var(--vw-text-muted)]">Latency</p>
                <p className="font-mono text-lg font-bold tabular-nums">{detailSystem.responseTimeMs.toFixed(2)}ms</p>
              </div>
              <div className="p-3 rounded-xl bg-[var(--vw-surface-muted)]/60 border border-[var(--vw-border)]">
                <p className="text-[11px] text-[var(--vw-text-muted)]">Uptime</p>
                <p className="font-mono text-lg font-bold tabular-nums">{detailSystem.uptimePercent.toFixed(3)}%</p>
              </div>
            </div>

            <div className="space-y-1.5 max-h-44 overflow-y-auto text-xs font-mono">
              {detailSystem.history.map((pt, i) => (
                <div key={`${pt.label}-${i}`} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[var(--vw-bg)] border border-[var(--vw-border)] tabular-nums">
                  <span className="text-[var(--vw-text-muted)]">{pt.label}</span>
                  <span>CPU {pt.cpu.toFixed(2)}%</span>
                  <span>MEM {pt.memory.toFixed(2)}%</span>
                  <span>{pt.responseMs.toFixed(2)}ms</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <button type="button" onClick={() => setDetailSystem(null)} className="px-4 py-2 rounded-xl text-xs font-semibold border border-[var(--vw-border)] cursor-pointer">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Remove */}
      {confirmRemove && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-sm vw-glass-card rounded-2xl p-6 space-y-4">
            <h2 className="font-display text-base font-bold">Remove Monitored Node?</h2>
            <p className="text-xs text-[var(--vw-text-muted)]">
              Remove <strong>{confirmRemove.name}</strong> ({confirmRemove.id}) from SQL inventory?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button type="button" onClick={() => setConfirmRemove(null)} className="px-4 py-2 rounded-xl text-xs border border-[var(--vw-border)] cursor-pointer">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  removeSystem(confirmRemove.id);
                  setConfirmRemove(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#BE123C] text-white cursor-pointer"
              >
                Confirm Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
