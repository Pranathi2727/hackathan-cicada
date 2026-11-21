import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Eye,
  Globe,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Wrench,
  XCircle,
} from 'lucide-react';
import { useVeilWatch } from '../context/VeilWatchContext';
import { GlobalCompany } from '../types/veilwatch';

export const GlobalCompaniesPage: React.FC = () => {
  const {
    companies,
    companyIncidents,
    syncGlobalCompanies,
    toggleOrAddCompany,
    reportAndResolveCompanyProblem,
  } = useVeilWatch();

  const [typeFilter, setTypeFilter] = useState<'all' | 'public' | 'private' | 'tracked'>('all');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [customCompanyName, setCustomCompanyName] = useState('');
  const [customCompanyType, setCustomCompanyType] = useState<'auto' | 'public' | 'private'>('auto');

  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingTracked, setSyncingTracked] = useState(false);
  const [addingCompany, setAddingCompany] = useState(false);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<GlobalCompany | null>(null);
  const [customError, setCustomError] = useState('');

  const regions = useMemo(() => {
    const set = new Set(companies.map((c) => c.region));
    return ['all', ...Array.from(set).sort()];
  }, [companies]);

  const filteredCompanies = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return companies.filter((c) => {
      if (typeFilter === 'public' && c.companyType !== 'public') return false;
      if (typeFilter === 'private' && c.companyType !== 'private') return false;
      if (typeFilter === 'tracked' && !c.isTracked) return false;
      if (regionFilter !== 'all' && c.region !== regionFilter) return false;
      if (q) {
        const hay = `${c.name} ${c.ticker || ''} ${c.sector} ${c.country} ${c.region}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [companies, regionFilter, searchQuery, typeFilter]);

  const summary = useMemo(() => {
    const total = companies.length;
    const pubCount = companies.filter((c) => c.companyType === 'public').length;
    const privCount = companies.filter((c) => c.companyType === 'private').length;
    const trackedCount = companies.filter((c) => c.isTracked).length;
    const degradedCount = companies.filter((c) => c.currentStatus !== 'operational').length;
    return { total, pubCount, privCount, trackedCount, degradedCount };
  }, [companies]);

  const handleSyncAll = async () => {
    setSyncingAll(true);
    await syncGlobalCompanies(false);
    setSyncingAll(false);
  };

  const handleSyncTracked = async () => {
    setSyncingTracked(true);
    await syncGlobalCompanies(true);
    setSyncingTracked(false);
  };

  const handleAddGlobalCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustomError('');
    const q = customCompanyName.trim();
    if (q.length < 2) {
      setCustomError('Enter a valid public or private company name.');
      return;
    }
    setAddingCompany(true);
    const res = await toggleOrAddCompany({
      query: q,
      companyType: customCompanyType === 'auto' ? undefined : customCompanyType,
    });
    setAddingCompany(false);
    if (!res.ok) {
      setCustomError(res.error || 'Could not analyze or add company.');
      return;
    }
    setCustomCompanyName('');
  };

  const handleToggleTrack = async (slug: string) => {
    setBusySlug(slug);
    await toggleOrAddCompany({ slug });
    setBusySlug(null);
  };

  const handleDetectAndResolve = async (comp: GlobalCompany) => {
    setBusySlug(comp.slug);
    await reportAndResolveCompanyProblem(
      comp.slug,
      `${comp.name} Regional API & Dependency Latency Spike`,
      `Detected packet loss and elevated response latency (${comp.latencyMs.toFixed(2)}ms) on ${comp.name} (${comp.companyType.toUpperCase()} · ${comp.sector}).`
    );
    setBusySlug(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Action Header: Worldwide Sync + Stats */}
      <section className="vw-glass-card vw-gradient-border rounded-2xl p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-mono text-[var(--vw-gold)] flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" />
              Worldwide Public & Private Company Intelligence · Live Open Feeds + Gemini AI
            </p>
            <h2 className="font-display text-lg sm:text-xl font-bold mt-1">
              Global Company Problem Sync & Watchlist Tracker
            </h2>
            <p className="text-xs text-[var(--vw-text-muted)] mt-1 max-w-2xl">
              Sync operational problems across all tracked and global enterprises at once, or track
              any specific public or private company worldwide with instant AI diagnosis and
              automated resolution.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              disabled={syncingTracked || syncingAll}
              onClick={handleSyncTracked}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border border-[var(--vw-border)] bg-[var(--vw-surface)] hover:border-[var(--vw-amber)] text-[var(--vw-text)] transition-all disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[var(--vw-gold)] ${syncingTracked ? 'animate-spin' : ''}`} />
              {syncingTracked ? 'Syncing Watchlist...' : `Sync Tracked (${summary.trackedCount})`}
            </button>

            <button
              type="button"
              disabled={syncingAll || syncingTracked}
              onClick={handleSyncAll}
              className="vw-gradient-btn inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold disabled:opacity-60 cursor-pointer"
            >
              <Globe className={`w-4 h-4 ${syncingAll ? 'animate-spin' : ''}`} />
              {syncingAll
                ? 'Syncing Worldwide Feeds...'
                : `Sync All Companies Worldwide (${summary.total})`}
            </button>
          </div>
        </div>

        {/* Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3.5 rounded-xl bg-[var(--vw-bg)]/75 border border-[var(--vw-border)]">
            <p className="text-[11px] text-[var(--vw-text-muted)]">Worldwide Directory</p>
            <p className="font-display text-2xl font-bold tabular-nums">{summary.total}</p>
          </div>
          <div className="p-3.5 rounded-xl bg-[var(--vw-bg)]/75 border border-[var(--vw-border)]">
            <p className="text-[11px] text-[var(--vw-text-muted)]">Public Companies</p>
            <p className="font-display text-2xl font-bold tabular-nums text-[var(--vw-gold)]">
              {summary.pubCount}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-[var(--vw-bg)]/75 border border-[var(--vw-border)]">
            <p className="text-[11px] text-[var(--vw-text-muted)]">Private Companies</p>
            <p className="font-display text-2xl font-bold tabular-nums text-[var(--vw-amber)]">
              {summary.privCount}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-[var(--vw-bg)]/75 border border-[var(--vw-border)]">
            <p className="text-[11px] text-[var(--vw-text-muted)]">Particular Tracked</p>
            <p className="font-display text-2xl font-bold tabular-nums text-[var(--vw-ok)]">
              {summary.trackedCount}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-[var(--vw-bg)]/75 border border-[var(--vw-border)]">
            <p className="text-[11px] text-[var(--vw-text-muted)]">Degraded / Incidents</p>
            <p className="font-display text-2xl font-bold tabular-nums text-[var(--vw-warn)]">
              {summary.degradedCount}
            </p>
          </div>
        </div>
      </section>

      {/* Track Any Particular Public or Private Company Worldwide */}
      <section className="vw-glass-card rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[var(--vw-gold)]" />
          <h3 className="font-display text-base font-bold">
            Track Any Particular Public or Private Company Worldwide
          </h3>
        </div>
        <p className="text-xs text-[var(--vw-text-muted)]">
          Enter any public or private company on earth (e.g., Infosys, SpaceX, Palantir, Scale AI,
          Toyota, Siemens, Ramp, Wiz). Gemini AI classifies its type, sector, region, and syncs
          its problem feed into PostgreSQL.
        </p>

        <form onSubmit={handleAddGlobalCompany} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={customCompanyName}
            onChange={(e) => setCustomCompanyName(e.target.value)}
            placeholder="Enter any public or private company worldwide..."
            aria-label="Company name to track"
            className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--vw-bg)] border border-[var(--vw-border)] text-sm text-[var(--vw-text)] focus:outline-none focus:border-[var(--vw-gold)]"
          />
          <select
            value={customCompanyType}
            onChange={(e) => setCustomCompanyType(e.target.value as 'auto' | 'public' | 'private')}
            aria-label="Company ownership type"
            className="px-3.5 py-2.5 rounded-xl bg-[var(--vw-bg)] border border-[var(--vw-border)] text-xs text-[var(--vw-text)] focus:outline-none focus:border-[var(--vw-gold)]"
          >
            <option value="auto">Auto-Detect (Public / Private)</option>
            <option value="public">Public Company</option>
            <option value="private">Private Company</option>
          </select>
          <button
            type="submit"
            disabled={addingCompany}
            className="vw-gradient-btn inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap disabled:opacity-60 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {addingCompany ? 'Analyzing & Tracking...' : 'Add & Track Company'}
          </button>
        </form>
        {customError && <p className="text-xs text-[var(--vw-crit)]">{customError}</p>}
      </section>

      {/* Filter & Search Bar */}
      <section className="vw-glass-card rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[var(--vw-surface-muted)]/70 border border-[var(--vw-border)]">
          {(
            [
              { id: 'all', label: `All (${summary.total})` },
              { id: 'public', label: `Public (${summary.pubCount})` },
              { id: 'private', label: `Private (${summary.privCount})` },
              { id: 'tracked', label: `Tracked Watchlist (${summary.trackedCount})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTypeFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                typeFilter === tab.id
                  ? 'bg-[var(--vw-gold-soft)] text-[var(--vw-gold)]'
                  : 'text-[var(--vw-text-muted)] hover:text-[var(--vw-text)]'
              }`}
            >
              {tab.label}
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
              placeholder="Search company, ticker, sector..."
              className="w-full sm:w-60 pl-9 pr-3 py-2 rounded-xl bg-[var(--vw-bg)] border border-[var(--vw-border)] text-xs text-[var(--vw-text)] focus:outline-none focus:border-[var(--vw-gold)]"
            />
          </div>

          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            aria-label="Filter by region"
            className="px-3 py-2 rounded-xl bg-[var(--vw-bg)] border border-[var(--vw-border)] text-xs text-[var(--vw-text)] focus:outline-none focus:border-[var(--vw-gold)]"
          >
            {regions.map((r) => (
              <option key={r} value={r}>
                {r === 'all' ? 'All Global Regions' : r}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Companies Directory Table */}
      <section className="vw-glass-card rounded-2xl overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[920px]">
          <thead>
            <tr className="border-b border-[var(--vw-border)] text-[11px] font-mono text-[var(--vw-text-muted)]">
              <th className="py-3 px-4 font-medium">Company & Ownership</th>
              <th className="py-3 px-4 font-medium">Sector & Country</th>
              <th className="py-3 px-4 font-medium">Live Status</th>
              <th className="py-3 px-4 font-medium text-right">Health Precision</th>
              <th className="py-3 px-4 font-medium text-right">Probe Latency</th>
              <th className="py-3 px-4 font-medium">Latest Telemetry Summary</th>
              <th className="py-3 px-4 font-medium text-right">Controls</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--vw-border)] text-xs">
            {filteredCompanies.map((comp) => {
              const isBusy = busySlug === comp.slug;
              return (
                <tr key={comp.slug} className="hover:bg-[var(--vw-surface-muted)]/40 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-[var(--vw-gold)] shrink-0" />
                      <div>
                        <p className="font-semibold text-[var(--vw-text)]">{comp.name}</p>
                        <p className="font-mono text-[11px] text-[var(--vw-text-muted)] uppercase">
                          {comp.companyType}
                          {comp.ticker ? ` · ${comp.ticker}` : ''} · {comp.feedKind}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <p className="text-[var(--vw-text)]">{comp.sector}</p>
                    <p className="text-[11px] text-[var(--vw-text-muted)]">
                      {comp.country} · {comp.region}
                    </p>
                  </td>
                  <td className="py-3.5 px-4">
                    {comp.currentStatus === 'operational' ? (
                      <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--vw-ok)]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Operational
                      </span>
                    ) : comp.currentStatus === 'outage' ? (
                      <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--vw-crit)]">
                        <XCircle className="w-3.5 h-3.5" />
                        Outage
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--vw-warn)]">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {comp.currentStatus}
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold">
                    {comp.healthScore.toFixed(2)}%
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[var(--vw-text-muted)]">
                    {comp.latencyMs.toFixed(2)}ms
                  </td>
                  <td className="py-3.5 px-4 max-w-[260px]">
                    <p className="text-[11px] text-[var(--vw-text-muted)] truncate" title={comp.latestSummary}>
                      {comp.latestSummary}
                    </p>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleToggleTrack(comp.slug)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
                          comp.isTracked
                            ? 'bg-[var(--vw-gold-soft)] border-[var(--vw-gold)]/50 text-[var(--vw-gold)]'
                            : 'border-[var(--vw-border)] text-[var(--vw-text-muted)] hover:text-[var(--vw-text)]'
                        }`}
                      >
                        <Eye className="w-3 h-3" />
                        {comp.isTracked ? 'Tracked' : 'Track'}
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleDetectAndResolve(comp)}
                        title="Detect & Auto-Resolve Problem"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--vw-border)] hover:border-[var(--vw-amber)] text-[11px] font-semibold text-[var(--vw-text)] transition-colors cursor-pointer"
                      >
                        <Wrench className="w-3 h-3 text-[var(--vw-amber)]" />
                        {isBusy ? 'Resolving...' : 'Test & Resolve'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* Live Company Problems & AI Auto-Resolution History */}
      <section className="vw-glass-card rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-base font-bold flex items-center gap-2">
              <Activity className="w-4 h-4 text-[var(--vw-gold)]" />
              Company Incidents & Automated Resolutions ({companyIncidents.length})
            </h3>
            <p className="text-xs text-[var(--vw-text-muted)]">
              Synced from live public Status APIs and Gemini AI root-cause remediation
            </p>
          </div>
          {selectedCompany && (
            <button
              type="button"
              onClick={() => setSelectedCompany(null)}
              className="text-xs text-[var(--vw-gold)] hover:underline cursor-pointer"
            >
              Show All Companies
            </button>
          )}
        </div>

        {companyIncidents.length === 0 ? (
          <p className="text-xs text-[var(--vw-text-muted)] py-6 text-center">
            No company incidents logged yet. Click &ldquo;Sync All Companies Worldwide&rdquo; or
            &ldquo;Test &amp; Resolve&rdquo; on any public/private company above.
          </p>
        ) : (
          <div className="space-y-3">
            {companyIncidents.slice(0, 12).map((inc) => (
              <article
                key={inc.id}
                className="p-4 rounded-xl border border-[var(--vw-border)] bg-[var(--vw-bg)]/60 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-[var(--vw-gold)] uppercase">
                      {inc.companyName} ({inc.companyType})
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono uppercase text-[var(--vw-warn)]">{inc.severity}</span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={`font-mono uppercase font-semibold ${
                        inc.status === 'resolved' ? 'text-[var(--vw-ok)]' : 'text-[var(--vw-crit)]'
                      }`}
                    >
                      {inc.status}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-[var(--vw-text-muted)] tabular-nums">
                    {new Date(inc.detectedAt).toLocaleString()} · Metric {inc.rawPrecisionMetric.toFixed(2)}%
                  </span>
                </div>
                <p className="text-sm font-semibold text-[var(--vw-text)]">{inc.title}</p>
                <p className="text-xs text-[var(--vw-text-muted)]">{inc.description}</p>
                {inc.aiAnalysis && (
                  <p className="text-xs text-[var(--vw-text)]">
                    <strong className="text-[var(--vw-gold)]">AI Root Cause: </strong>
                    {inc.aiAnalysis}
                  </p>
                )}
                {inc.autoResolutionAction && (
                  <p className="text-xs text-[var(--vw-ok)]">
                    <strong>Auto-Resolution Executed: </strong>
                    {inc.autoResolutionAction}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
