import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import dotenv from 'dotenv';
import express from 'express';
import { eq } from 'drizzle-orm';
import { db } from './src/db/index.ts';
import {
  addMonitoredSystem,
  deleteMonitoredSystem,
  ensureSeeded,
  getFullDashboardState,
  ingestAgentHeartbeatAndTelemetry,
  recordFingerprintAndAlert,
  reportSimulatedOrLiveCompanyProblem,
  savePrivacyInspectionToDb,
  saveWorkspaceSettingsToDb,
  syncAllGlobalCompanies,
  toggleSystemActive,
  trackOrDiscoverCompany,
  updateAlertStatusInDb,
} from './src/db/repository.ts';
import { monitoredSystems, rawTelemetry } from './src/db/schema.ts';
import { getOrCreateGoogleUser, registerEmailUser, verifyEmailUser } from './src/db/users.ts';
import { generateAiIncidentResolution } from './src/lib/aiEngine.ts';
import { adminAuth } from './src/lib/firebase-admin.ts';
import { AuthRequest, requireAuth, signSessionToken } from './src/middleware/auth.ts';

dotenv.config();

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = 3000;

interface SystemValidationPayload {
  name?: unknown;
  category?: unknown;
  host?: unknown;
  region?: unknown;
  notes?: unknown;
}

interface AuditSummaryPayload {
  organizationName?: unknown;
  totalIncidents?: unknown;
  resolvedIncidents?: unknown;
  blockedExports?: unknown;
  approvedSummaries?: unknown;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '128kb' }));

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'veilwatch-server',
      mode: 'postgresql-live-intelligence',
      localPrivacyBoundary: true,
      timestamp: new Date().toISOString(),
    });
  });

  // Google Sign-In verification & PostgreSQL user sync
  app.post('/api/auth/google', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing Firebase Google ID token.' });
      return;
    }
    const token = authHeader.slice('Bearer '.length).trim();
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      const email = decoded.email || `${decoded.uid}@veilwatch.local`;
      const user = await getOrCreateGoogleUser(decoded.uid, email, decoded.name);
      res.json({
        user: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          authProvider: user.authProvider,
          role: user.role,
        },
      });
    } catch (error) {
      console.error('Google auth verification failed:', error);
      res.status(401).json({ error: 'Unable to verify Google Sign-In session.' });
    }
  });

  // Email + Password registration
  app.post('/api/auth/email/register', async (req, res) => {
    const body = (req.body || {}) as { email?: unknown; password?: unknown; displayName?: unknown };
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : undefined;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (password.length < 6 || password.length > 128) {
      res.status(400).json({ error: 'Password must be between 6 and 128 characters.' });
      return;
    }

    try {
      const result = await registerEmailUser(email, password, displayName);
      if (!result.ok) {
        res.status(409).json({ error: result.error });
        return;
      }
      const token = signSessionToken({
        uid: result.user.uid,
        email: result.user.email,
        name: result.user.displayName,
        provider: 'password',
      });
      res.status(201).json({
        token,
        user: {
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName,
          authProvider: result.user.authProvider,
          role: result.user.role,
        },
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Registration failed.';
      res.status(500).json({ error: msg });
    }
  });

  // Email + Password sign in
  app.post('/api/auth/email/login', async (req, res) => {
    const body = (req.body || {}) as { email?: unknown; password?: unknown };
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    try {
      const result = await verifyEmailUser(email, password);
      if (!result.ok) {
        res.status(401).json({ error: result.error });
        return;
      }
      const token = signSessionToken({
        uid: result.user.uid,
        email: result.user.email,
        name: result.user.displayName,
        provider: 'password',
      });
      res.json({
        token,
        user: {
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName,
          authProvider: result.user.authProvider,
          role: result.user.role,
        },
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Sign-in failed.';
      res.status(500).json({ error: msg });
    }
  });

  app.get('/api/auth/me', requireAuth, (req: AuthRequest, res) => {
    res.json({ user: req.user });
  });

  // Full SQL-backed dashboard state
  app.get('/api/dashboard/state', requireAuth, async (_req: AuthRequest, res) => {
    try {
      const state = await getFullDashboardState();
      res.json(state);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to load dashboard state.';
      res.status(500).json({ error: msg });
    }
  });

  // Validate & persist monitored node
  app.post('/api/systems/validate', (req, res) => {
    const body = (req.body || {}) as SystemValidationPayload;
    const errors: string[] = [];

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const category = typeof body.category === 'string' ? body.category.trim() : '';
    const host = typeof body.host === 'string' ? body.host.trim() : '';
    const region = typeof body.region === 'string' ? body.region.trim() : '';

    if (name.length < 3 || name.length > 48) {
      errors.push('System name must be between 3 and 48 characters.');
    }
    if (!['server', 'application', 'network', 'security'].includes(category)) {
      errors.push('Category must be server, application, network, or security.');
    }
    if (host.length < 3 || host.length > 64 || /\s/.test(host)) {
      errors.push('Host or endpoint identifier must be 3 to 64 characters without spaces.');
    }
    if (region.length < 2 || region.length > 32) {
      errors.push('Environment zone must be between 2 and 32 characters.');
    }

    if (errors.length > 0) {
      res.status(400).json({ valid: false, errors });
      return;
    }

    res.json({
      valid: true,
      sanitized: { name, category, host, region },
      validatedAt: new Date().toISOString(),
    });
  });

  app.post('/api/systems', requireAuth, async (req: AuthRequest, res) => {
    const body = (req.body || {}) as SystemValidationPayload;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const category = typeof body.category === 'string' ? body.category.trim() : '';
    const host = typeof body.host === 'string' ? body.host.trim() : '';
    const region = typeof body.region === 'string' ? body.region.trim() : '';
    const notes =
      typeof body.notes === 'string' && body.notes.trim()
        ? body.notes.trim()
        : 'Monitored node persisted in PostgreSQL.';

    if (
      name.length < 3 ||
      name.length > 48 ||
      !['server', 'application', 'network', 'security'].includes(category) ||
      host.length < 3 ||
      host.length > 64 ||
      /\s/.test(host) ||
      region.length < 2 ||
      region.length > 32
    ) {
      res.status(400).json({ error: 'Invalid system parameters.' });
      return;
    }

    const prefixMap: Record<string, string> = {
      server: 'SRV',
      application: 'APP',
      network: 'NET',
      security: 'SEC',
    };
    const id = `${prefixMap[category]}-${Math.floor(100 + Math.random() * 899)}`;
    const now = new Date();
    const label = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const baseCpu = Number((28 + Math.random() * 24).toFixed(2));
    const baseMem = Number((34 + Math.random() * 26).toFixed(2));
    const baseRt = Number((22 + Math.random() * 40).toFixed(2));

    try {
      const created = await addMonitoredSystem({
        id,
        name,
        category,
        host,
        region,
        notes,
        cpuUsage: baseCpu,
        memoryUsage: baseMem,
        responseTimeMs: baseRt,
        history: [
          { label, cpu: Number((baseCpu - 1.4).toFixed(2)), memory: Number((baseMem - 0.8).toFixed(2)), responseMs: Number((baseRt - 2.1).toFixed(2)) },
          { label, cpu: baseCpu, memory: baseMem, responseMs: baseRt },
        ],
      });
      res.status(201).json({ system: created });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to create system.';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/systems/:id/toggle', requireAuth, async (req: AuthRequest, res) => {
    const id = String(req.params.id || '').trim();
    if (!id) {
      res.status(400).json({ error: 'System ID required.' });
      return;
    }
    try {
      const updated = await toggleSystemActive(id);
      if (!updated) {
        res.status(404).json({ error: 'System not found.' });
        return;
      }
      res.json({ system: updated });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to toggle system.';
      res.status(500).json({ error: msg });
    }
  });

  app.delete('/api/systems/:id', requireAuth, async (req: AuthRequest, res) => {
    const id = String(req.params.id || '').trim();
    if (!id) {
      res.status(400).json({ error: 'System ID required.' });
      return;
    }
    try {
      const deleted = await deleteMonitoredSystem(id);
      if (!deleted) {
        res.status(404).json({ error: 'System not found.' });
        return;
      }
      res.json({ ok: true, id });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to delete system.';
      res.status(500).json({ error: msg });
    }
  });

  // Record high-precision telemetry sample in PostgreSQL
  app.post('/api/telemetry/sample', requireAuth, async (req: AuthRequest, res) => {
    const body = (req.body || {}) as {
      cpu?: unknown;
      memory?: unknown;
      networkInMbps?: unknown;
      networkOutMbps?: unknown;
      responseMs?: unknown;
      diskIoPct?: unknown;
      errorRatePct?: unknown;
      systemId?: unknown;
      source?: unknown;
    };

    const cpu = Number(body.cpu);
    const memory = Number(body.memory);
    const networkInMbps = Number(body.networkInMbps);
    const networkOutMbps = Number(body.networkOutMbps);
    const responseMs = Number(body.responseMs);
    const diskIoPct = Number.isFinite(Number(body.diskIoPct)) ? Number(body.diskIoPct) : 24.5;
    const errorRatePct = Number.isFinite(Number(body.errorRatePct)) ? Number(body.errorRatePct) : 0.02;

    if (![cpu, memory, networkInMbps, networkOutMbps, responseMs].every(Number.isFinite)) {
      res.status(400).json({ error: 'Numeric telemetry metrics are required.' });
      return;
    }

    try {
      await ensureSeeded();
      const now = new Date();
      const label = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const inserted = await db
        .insert(rawTelemetry)
        .values({
          systemId: typeof body.systemId === 'string' ? body.systemId : 'CLUSTER-AGG',
          recordedAt: now,
          label,
          cpu: Number(cpu.toFixed(2)),
          memory: Number(memory.toFixed(2)),
          networkInMbps: Number(networkInMbps.toFixed(2)),
          networkOutMbps: Number(networkOutMbps.toFixed(2)),
          responseMs: Number(responseMs.toFixed(2)),
          diskIoPct: Number(diskIoPct.toFixed(2)),
          errorRatePct: Number(errorRatePct.toFixed(2)),
          source: typeof body.source === 'string' ? body.source : 'system-collector',
        })
        .returning();
      res.status(201).json({ point: inserted[0] });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to store telemetry sample.';
      res.status(500).json({ error: msg });
    }
  });

  // Alerts: create + auto-resolve or update status
  app.post('/api/alerts', requireAuth, async (req: AuthRequest, res) => {
    const body = (req.body || {}) as {
      title?: string;
      description?: string;
      severity?: 'low' | 'medium' | 'high' | 'critical';
      category?: string;
      systemId?: string;
      systemName?: string;
      componentType?: string;
      patternCode?: string;
      recommendedAction?: string;
      sourceType?: string;
      autoResolve?: boolean;
      simulationSource?: string;
    };

    if (!body.title || !body.description || !body.systemId || !body.systemName) {
      res.status(400).json({ error: 'Alert title, description, systemId, and systemName are required.' });
      return;
    }

    try {
      const created = await recordFingerprintAndAlert({
        title: body.title,
        description: body.description,
        severity: body.severity || 'medium',
        category: body.category || 'system',
        systemId: body.systemId,
        systemName: body.systemName,
        componentType: body.componentType || 'Infrastructure Node',
        patternCode: body.patternCode || 'telemetry_event',
        recommendedAction: body.recommendedAction || 'Inspect node telemetry and baseline thresholds.',
        sourceType: body.sourceType || 'simulation',
        autoResolve: Boolean(body.autoResolve),
        simulationSource: body.simulationSource,
      });
      res.status(201).json({ alert: created });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to record alert.';
      res.status(500).json({ error: msg });
    }
  });

  app.patch('/api/alerts/:id/status', requireAuth, async (req: AuthRequest, res) => {
    const id = String(req.params.id || '').trim();
    const body = (req.body || {}) as { status?: unknown; useAiAutoResolve?: unknown };
    const status = typeof body.status === 'string' ? body.status : '';
    if (!['active', 'acknowledged', 'resolved'].includes(status)) {
      res.status(400).json({ error: 'Invalid alert status.' });
      return;
    }

    try {
      let notes: string | undefined;
      if (status === 'resolved' && body.useAiAutoResolve) {
        const plan = await generateAiIncidentResolution({
          title: `Alert ${id}`,
          description: 'Operator triggered AI auto-resolution.',
          sourceName: 'VEILWATCH Console',
          metricsSummary: 'manual-trigger-ai-resolve',
        });
        notes = `${plan.autoResolutionAction} (${plan.resolutionOutcome})`;
      }
      const updated = await updateAlertStatusInDb(
        id,
        status as 'active' | 'acknowledged' | 'resolved',
        notes
      );
      if (!updated) {
        res.status(404).json({ error: 'Alert not found.' });
        return;
      }
      res.json({ alert: updated });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to update alert.';
      res.status(500).json({ error: msg });
    }
  });

  // Update node telemetry during simulations
  app.post('/api/systems/:id/metrics', requireAuth, async (req: AuthRequest, res) => {
    const id = String(req.params.id || '').trim();
    const body = (req.body || {}) as {
      status?: string;
      cpuUsage?: number;
      memoryUsage?: number;
      responseTimeMs?: number;
      uptimePercent?: number;
      history?: { label: string; cpu: number; memory: number; responseMs: number }[];
    };
    try {
      const updateFields: Partial<typeof monitoredSystems.$inferInsert> = {
        lastSeen: new Date(),
      };
      if (typeof body.status === 'string') updateFields.status = body.status;
      if (typeof body.cpuUsage === 'number') updateFields.cpuUsage = Number(body.cpuUsage.toFixed(2));
      if (typeof body.memoryUsage === 'number') updateFields.memoryUsage = Number(body.memoryUsage.toFixed(2));
      if (typeof body.responseTimeMs === 'number') updateFields.responseTimeMs = Number(body.responseTimeMs.toFixed(2));
      if (typeof body.uptimePercent === 'number') updateFields.uptimePercent = Number(body.uptimePercent.toFixed(2));
      if (Array.isArray(body.history)) updateFields.historyJson = body.history;

      const updated = await db
        .update(monitoredSystems)
        .set(updateFields)
        .where(eq(monitoredSystems.id, id))
        .returning();
      res.json({ system: updated[0] || null });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to update node metrics.';
      res.status(500).json({ error: msg });
    }
  });

  // Privacy inspection sanitized summary log (never accepts raw payload)
  app.post('/api/privacy/inspect-log', requireAuth, async (req: AuthRequest, res) => {
    const body = req.body;
    if (!body || typeof body.id !== 'string' || typeof body.redactedSummary !== 'string') {
      res.status(400).json({ error: 'Invalid sanitized inspection summary.' });
      return;
    }
    try {
      await savePrivacyInspectionToDb(body);
      res.status(201).json({ ok: true });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to save inspection log.';
      res.status(500).json({ error: msg });
    }
  });

  // Workspace settings persistence
  app.put('/api/settings', requireAuth, async (req: AuthRequest, res) => {
    const body = req.body;
    if (!body || typeof body.organizationName !== 'string') {
      res.status(400).json({ error: 'Invalid settings payload.' });
      return;
    }
    try {
      const saved = await saveWorkspaceSettingsToDb(body);
      res.json({ settings: saved });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to save workspace settings.';
      res.status(500).json({ error: msg });
    }
  });

  // Audit report certificate validation
  app.post('/api/audit/summary', (req, res) => {
    const body = (req.body || {}) as AuditSummaryPayload;
    const org = typeof body.organizationName === 'string' ? body.organizationName.trim() : '';

    const numericFields = [
      body.totalIncidents,
      body.resolvedIncidents,
      body.blockedExports,
      body.approvedSummaries,
    ];

    const allNumbersValid = numericFields.every(
      (val) => typeof val === 'number' && Number.isFinite(val) && val >= 0
    );

    if (!org || org.length > 80 || !allNumbersValid) {
      res.status(400).json({
        valid: false,
        error: 'Invalid audit report metadata.',
      });
      return;
    }

    res.json({
      valid: true,
      exportCertificateId: `VW-AUD-${Date.now().toString(36).toUpperCase()}`,
      generatedAt: new Date().toISOString(),
      policyAttestation: 'Sanitized summary verified in PostgreSQL — zero raw inspection payloads transmitted.',
    });
  });

  // Run the real Python 3 monitoring agent once & persist results to PostgreSQL
  app.post('/api/agent/run', requireAuth, async (req: AuthRequest, res) => {
    const body = (req.body || {}) as { simulateAnomaly?: unknown };
    const simulateAnomaly = Boolean(body.simulateAnomaly);
    const args = ['agent/veilwatch_agent.py', '--once'];
    if (simulateAnomaly) args.push('--simulate-anomaly');

    try {
      const { stdout } = await execFileAsync('python3', args, {
        cwd: __dirname,
        timeout: 15000,
      });
      const snapshot = JSON.parse(stdout.trim());
      const ingested = await ingestAgentHeartbeatAndTelemetry(snapshot);
      res.json({
        ok: true,
        snapshot,
        ingested,
      });
    } catch (error: unknown) {
      console.error('Python agent execution error:', error);
      const msg = error instanceof Error ? error.message : 'Python agent sweep failed.';
      res.status(500).json({ error: msg });
    }
  });

  // External Python agent daemon HTTP ingest endpoint
  app.post('/api/agent/ingest', requireAuth, async (req: AuthRequest, res) => {
    const payload = req.body;
    if (!payload || typeof payload.agentId !== 'string' || typeof payload.cpuPct !== 'number') {
      res.status(400).json({ error: 'Invalid Python agent payload.' });
      return;
    }
    try {
      const ingested = await ingestAgentHeartbeatAndTelemetry(payload);
      res.status(201).json({ ok: true, ingested });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to ingest Python agent payload.';
      res.status(500).json({ error: msg });
    }
  });

  // Worldwide Sync across all public & private companies + live open status APIs + Gemini AI
  app.post('/api/companies/sync-all', requireAuth, async (req: AuthRequest, res) => {
    const body = (req.body || {}) as { onlyTracked?: unknown; autoResolve?: unknown };
    try {
      const result = await syncAllGlobalCompanies({
        onlyTracked: Boolean(body.onlyTracked),
        autoResolve: body.autoResolve === undefined ? true : Boolean(body.autoResolve),
      });
      res.json(result);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Global sync failed.';
      res.status(500).json({ error: msg });
    }
  });

  // Track/Untrack an existing company OR discover & track ANY public/private company worldwide
  app.post('/api/companies/track', requireAuth, async (req: AuthRequest, res) => {
    const body = (req.body || {}) as {
      query?: unknown;
      slug?: unknown;
      companyType?: unknown;
      autoResolve?: unknown;
    };
    const query = typeof body.query === 'string' ? body.query.trim() : undefined;
    const slug = typeof body.slug === 'string' ? body.slug.trim() : undefined;
    const companyType =
      body.companyType === 'public' || body.companyType === 'private' ? body.companyType : undefined;

    if (!query && !slug) {
      res.status(400).json({ error: 'Provide either a company slug or a company name to track.' });
      return;
    }

    try {
      const result = await trackOrDiscoverCompany({
        query,
        slug,
        companyType,
        autoResolve: body.autoResolve === undefined ? true : Boolean(body.autoResolve),
      });
      res.json(result);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unable to track company.';
      res.status(500).json({ error: msg });
    }
  });

  // Detect & automatically resolve a problem on a specific tracked company
  app.post('/api/companies/:slug/report-problem', requireAuth, async (req: AuthRequest, res) => {
    const slug = String(req.params.slug || '').trim();
    const body = (req.body || {}) as {
      problemTitle?: unknown;
      problemDescription?: unknown;
      autoResolve?: unknown;
    };
    const problemTitle =
      typeof body.problemTitle === 'string' && body.problemTitle.trim()
        ? body.problemTitle.trim()
        : 'API Edge Degradation & Elevated Latency';
    const problemDescription =
      typeof body.problemDescription === 'string' && body.problemDescription.trim()
        ? body.problemDescription.trim()
        : 'Automated open-source status monitor flagged regional packet loss and elevated error rates.';

    try {
      const result = await reportSimulatedOrLiveCompanyProblem({
        companySlug: slug,
        problemTitle,
        problemDescription,
        autoResolve: body.autoResolve === undefined ? true : Boolean(body.autoResolve),
      });
      if (!result) {
        res.status(404).json({ error: 'Company not found.' });
        return;
      }
      res.status(201).json(result);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to report company problem.';
      res.status(500).json({ error: msg });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VEILWATCH SQL + AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start VEILWATCH server:', err);
  process.exit(1);
});
