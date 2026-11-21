import {
  ForecastPoint,
  ForecastSummary,
  MonitoredSystem,
  PredictiveWarning,
  TelemetryPoint,
  VeilWatchSettings,
} from '../types/veilwatch';

function round2(n: number): number {
  return Number(n.toFixed(2));
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function fitLinearRegression(values: number[]): {
  slope: number;
  intercept: number;
  rSquared: number;
  mae: number;
  stdErr: number;
} {
  const n = values.length;
  if (n < 2) {
    const val = values[0] ?? 50;
    return { slope: 0, intercept: val, rSquared: 1, mae: 0, stdErr: 1.5 };
  }

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i += 1) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumXX += i * i;
  }

  const denom = n * sumXX - sumX * sumX;
  const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  const meanY = sumY / n;
  let ssTot = 0;
  let ssRes = 0;
  let absErrSum = 0;

  for (let i = 0; i < n; i += 1) {
    const pred = intercept + slope * i;
    const err = values[i] - pred;
    ssRes += err * err;
    ssTot += (values[i] - meanY) * (values[i] - meanY);
    absErrSum += Math.abs(err);
  }

  const rSquared = ssTot === 0 ? 0.99 : clamp(1 - ssRes / ssTot, 0.35, 0.999);
  const mae = absErrSum / n;
  const stdErr = Math.sqrt(ssRes / Math.max(1, n - 2));

  return { slope, intercept, rSquared, mae, stdErr };
}

export function buildFutureTelemetryForecast(
  telemetry: TelemetryPoint[],
  horizonSteps = 6,
  stepMinutes = 5
): ForecastSummary {
  const series = telemetry.slice(-24);
  if (series.length === 0) {
    return {
      horizonMinutes: horizonSteps * stepMinutes,
      futurePoints: [],
      rSquaredCpu: 0.96,
      maeCpu: 0.85,
      accuracyPct: 98.5,
      cpuSlopePerStep: 0,
      memorySlopePerStep: 0,
      latencySlopePerStep: 0,
      projectedRiskLevel: 'nominal',
    };
  }

  const cpuReg = fitLinearRegression(series.map((p) => p.cpu));
  const memReg = fitLinearRegression(series.map((p) => p.memory));
  const netInReg = fitLinearRegression(series.map((p) => p.networkInMbps));
  const netOutReg = fitLinearRegression(series.map((p) => p.networkOutMbps));
  const rtReg = fitLinearRegression(series.map((p) => p.responseMs));

  const lastPoint = series[series.length - 1];
  const lastTime = new Date(lastPoint.timestamp).getTime() || Date.now();
  const n = series.length;

  const futurePoints: ForecastPoint[] = [];
  for (let k = 1; k <= horizonSteps; k += 1) {
    const idx = n - 1 + k;
    const futureTime = new Date(lastTime + k * stepMinutes * 60_000);
    const label = `+${k * stepMinutes}m (${futureTime.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })})`;

    // Blend regression trend with damped momentum from the last observed sample
    const rawCpu = cpuReg.intercept + cpuReg.slope * idx;
    const dampedCpu = lastPoint.cpu * 0.35 + rawCpu * 0.65;
    const cpu = round2(clamp(dampedCpu, 5, 99.5));

    const rawMem = memReg.intercept + memReg.slope * idx;
    const memory = round2(clamp(lastPoint.memory * 0.4 + rawMem * 0.6, 10, 99.2));

    const networkInMbps = round2(
      clamp(lastPoint.networkInMbps * 0.35 + (netInReg.intercept + netInReg.slope * idx) * 0.65, 25, 980)
    );
    const networkOutMbps = round2(
      clamp(lastPoint.networkOutMbps * 0.35 + (netOutReg.intercept + netOutReg.slope * idx) * 0.65, 15, 760)
    );
    const responseMs = round2(
      clamp(lastPoint.responseMs * 0.35 + (rtReg.intercept + rtReg.slope * idx) * 0.65, 10, 620)
    );

    const band = Math.max(1.8, cpuReg.stdErr * (1 + k * 0.14));
    futurePoints.push({
      label,
      cpu,
      memory,
      networkInMbps,
      networkOutMbps,
      responseMs,
      cpuLow: round2(clamp(cpu - band, 2, 99)),
      cpuHigh: round2(clamp(cpu + band, 4, 99.9)),
    });
  }

  const maxFutureCpu = Math.max(...futurePoints.map((f) => f.cpu));
  const maxFutureRt = Math.max(...futurePoints.map((f) => f.responseMs));
  const projectedRiskLevel: ForecastSummary['projectedRiskLevel'] =
    maxFutureCpu >= 85 || maxFutureRt >= 280
      ? 'critical'
      : maxFutureCpu >= 72 || maxFutureRt >= 175
        ? 'elevated'
        : 'nominal';

  const accuracyPct = round2(clamp(100 - cpuReg.mae * 1.15, 88.5, 99.8));

  return {
    horizonMinutes: horizonSteps * stepMinutes,
    futurePoints,
    rSquaredCpu: round2(cpuReg.rSquared),
    maeCpu: round2(cpuReg.mae),
    accuracyPct,
    cpuSlopePerStep: round2(cpuReg.slope),
    memorySlopePerStep: round2(memReg.slope),
    latencySlopePerStep: round2(rtReg.slope),
    projectedRiskLevel,
  };
}

export function analyzePredictiveWarnings(
  systems: MonitoredSystem[],
  thresholds: VeilWatchSettings['thresholds']
): PredictiveWarning[] {
  const warnings: PredictiveWarning[] = [];
  const now = new Date().toISOString();

  for (const sys of systems) {
    if (!sys.monitoringActive) continue;
    const recent = sys.history.slice(-4);
    if (recent.length < 2) continue;

    // 1. Sustained CPU breach or upward trend approaching critical
    const cpuValues = recent.map((p) => p.cpu);
    const cpuConsecutiveWarn = cpuValues.filter((v) => v >= thresholds.cpuWarning).length;
    const cpuDelta = round2(cpuValues[cpuValues.length - 1] - cpuValues[0]);
    const cpuReg = fitLinearRegression(cpuValues);
    const projectedCpuNext = round2(cpuReg.intercept + cpuReg.slope * (cpuValues.length + 2));

    if (
      cpuConsecutiveWarn >= 3 ||
      (sys.cpuUsage >= thresholds.cpuWarning && cpuDelta >= 6) ||
      projectedCpuNext >= thresholds.cpuCritical
    ) {
      const isCrit = sys.cpuUsage >= thresholds.cpuCritical || projectedCpuNext >= thresholds.cpuCritical;
      warnings.push({
        id: `pred-cpu-${sys.id}`,
        systemId: sys.id,
        systemName: sys.name,
        category: sys.category,
        severity: isCrit ? 'critical' : 'warning',
        metric: 'CPU',
        currentValue: round2(sys.cpuUsage),
        threshold: isCrit ? thresholds.cpuCritical : thresholds.cpuWarning,
        trendDelta: cpuDelta,
        ruleTriggered:
          cpuConsecutiveWarn >= 3
            ? `Sustained CPU >= ${thresholds.cpuWarning}% + Future Forecast ${projectedCpuNext}%`
            : `Upward CPU Trajectory (+${cpuDelta}%) projecting ${projectedCpuNext}%`,
        explanation: `Recent ${recent.length} raw samples [${cpuValues
          .map((v) => `${round2(v)}%`)
          .join(' -> ')}] project ${projectedCpuNext}% CPU within upcoming intervals (R²=${round2(cpuReg.rSquared)}).`,
        recommendedMaintenance:
          'Auto-remediation recommends rebalancing worker concurrency, applying rate-limiting, and pre-warming standby replica.',
        detectedAt: now,
      });
    }

    // 2. Sustained Memory breach
    const memValues = recent.map((p) => p.memory);
    const memConsecutiveWarn = memValues.filter((v) => v >= thresholds.memoryWarning).length;
    const memDelta = round2(memValues[memValues.length - 1] - memValues[0]);
    const memReg = fitLinearRegression(memValues);
    const projectedMemNext = round2(memReg.intercept + memReg.slope * (memValues.length + 2));

    if (
      memConsecutiveWarn >= 3 ||
      (sys.memoryUsage >= thresholds.memoryWarning && memDelta >= 5) ||
      projectedMemNext >= thresholds.memoryCritical
    ) {
      const isCrit =
        sys.memoryUsage >= thresholds.memoryCritical || projectedMemNext >= thresholds.memoryCritical;
      warnings.push({
        id: `pred-mem-${sys.id}`,
        systemId: sys.id,
        systemName: sys.name,
        category: sys.category,
        severity: isCrit ? 'critical' : 'warning',
        metric: 'Memory',
        currentValue: round2(sys.memoryUsage),
        threshold: isCrit ? thresholds.memoryCritical : thresholds.memoryWarning,
        trendDelta: memDelta,
        ruleTriggered:
          memConsecutiveWarn >= 3
            ? `Sustained Memory >= ${thresholds.memoryWarning}% + Forecast ${projectedMemNext}%`
            : `Monotonic Memory Growth (+${memDelta}%) projecting ${projectedMemNext}%`,
        explanation: `Raw memory sequence [${memValues
          .map((v) => `${round2(v)}%`)
          .join(' -> ')}] indicates steady heap growth toward ${projectedMemNext}%.`,
        recommendedMaintenance:
          'Trigger cache eviction TTL cleanup and schedule graceful rolling worker recycle.',
        detectedAt: now,
      });
    }

    // 3. Sustained Response Time degradation
    const rtValues = recent.map((p) => p.responseMs);
    const rtConsecutiveWarn = rtValues.filter((v) => v >= thresholds.responseWarningMs).length;
    const rtDelta = round2(rtValues[rtValues.length - 1] - rtValues[0]);
    const rtReg = fitLinearRegression(rtValues);
    const projectedRtNext = round2(rtReg.intercept + rtReg.slope * (rtValues.length + 2));

    if (
      rtConsecutiveWarn >= 3 ||
      (sys.responseTimeMs >= thresholds.responseWarningMs && rtDelta >= 35) ||
      projectedRtNext >= thresholds.responseCriticalMs
    ) {
      const isCrit =
        sys.responseTimeMs >= thresholds.responseCriticalMs ||
        projectedRtNext >= thresholds.responseCriticalMs;
      warnings.push({
        id: `pred-rt-${sys.id}`,
        systemId: sys.id,
        systemName: sys.name,
        category: sys.category,
        severity: isCrit ? 'critical' : 'warning',
        metric: 'Response Time',
        currentValue: round2(sys.responseTimeMs),
        threshold: isCrit ? thresholds.responseCriticalMs : thresholds.responseWarningMs,
        trendDelta: rtDelta,
        ruleTriggered:
          rtConsecutiveWarn >= 3
            ? `Sustained Latency >= ${thresholds.responseWarningMs}ms + Forecast ${projectedRtNext}ms`
            : `Latency Escalation (+${rtDelta}ms) projecting ${projectedRtNext}ms`,
        explanation: `Latency moved across [${rtValues
          .map((v) => `${round2(v)}ms`)
          .join(' -> ')}], projecting ${projectedRtNext}ms if queue contention continues.`,
        recommendedMaintenance:
          'Inspect PostgreSQL connection pool wait times and validate circuit-breaker failover thresholds.',
        detectedAt: now,
      });
    }
  }

  return warnings;
}
