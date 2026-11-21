import React, { useMemo } from 'react';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  ChartOptions,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { AlertItem, ForecastPoint, TelemetryPoint } from '../types/veilwatch';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
);

interface ThemeProps {
  theme: 'dark' | 'light';
}

export const CpuMemoryChart: React.FC<
  { data: TelemetryPoint[]; forecast?: ForecastPoint[] } & ThemeProps
> = ({ data, forecast = [], theme }) => {
  const isDark = theme === 'dark';
  const gridColor = isDark ? 'rgba(232, 195, 106, 0.12)' : 'rgba(217, 154, 37, 0.14)';
  const tickColor = isDark ? '#D5C6AE' : '#6A5B47';

  const chartData = useMemo(() => {
    const observedLabels = data.map((p) => p.label);
    const futureLabels = forecast.map((f) => f.label);
    const allLabels = [...observedLabels, ...futureLabels];
    const lastObservedIdx = data.length - 1;

    const observedCpu = [...data.map((p) => p.cpu), ...futureLabels.map(() => null)];
    const observedMem = [...data.map((p) => p.memory), ...futureLabels.map(() => null)];

    const futureCpu = allLabels.map((_, idx) => {
      if (idx < lastObservedIdx) return null;
      if (idx === lastObservedIdx) return data[lastObservedIdx]?.cpu ?? null;
      return forecast[idx - data.length]?.cpu ?? null;
    });

    const futureMem = allLabels.map((_, idx) => {
      if (idx < lastObservedIdx) return null;
      if (idx === lastObservedIdx) return data[lastObservedIdx]?.memory ?? null;
      return forecast[idx - data.length]?.memory ?? null;
    });

    const futureBandHigh = allLabels.map((_, idx) => {
      if (idx < lastObservedIdx) return null;
      if (idx === lastObservedIdx) return data[lastObservedIdx]?.cpu ?? null;
      return forecast[idx - data.length]?.cpuHigh ?? null;
    });

    return {
      labels: allLabels,
      datasets: [
        {
          label: 'Observed CPU (%)',
          data: observedCpu,
          borderColor: '#D99A25',
          backgroundColor: 'rgba(245, 197, 66, 0.22)',
          borderWidth: 2.3,
          tension: 0.34,
          fill: true,
          pointRadius: 2.5,
          pointBackgroundColor: '#F5C542',
          pointHoverRadius: 5,
        },
        {
          label: 'Observed Memory (%)',
          data: observedMem,
          borderColor: isDark ? '#E8C36A' : '#8F5A0B',
          backgroundColor: isDark ? 'rgba(232, 195, 106, 0.12)' : 'rgba(232, 195, 106, 0.18)',
          borderWidth: 2,
          tension: 0.34,
          fill: true,
          pointRadius: 2.5,
          pointBackgroundColor: isDark ? '#E8C36A' : '#8F5A0B',
          pointHoverRadius: 5,
        },
        ...(forecast.length > 0
          ? [
              {
                label: 'Upcoming CPU Forecast (%)',
                data: futureCpu,
                borderColor: '#059669',
                borderDash: [6, 4],
                borderWidth: 2.2,
                tension: 0.32,
                fill: false,
                pointRadius: 3,
                pointBackgroundColor: '#10B981',
              },
              {
                label: 'Upcoming Memory Forecast (%)',
                data: futureMem,
                borderColor: '#0284C7',
                borderDash: [4, 4],
                borderWidth: 1.9,
                tension: 0.32,
                fill: false,
                pointRadius: 2.5,
                pointBackgroundColor: '#0EA5E9',
              },
              {
                label: '95% CPU Confidence Upper',
                data: futureBandHigh,
                borderColor: 'rgba(16, 185, 129, 0.35)',
                backgroundColor: 'rgba(16, 185, 129, 0.10)',
                borderDash: [2, 3],
                borderWidth: 1,
                pointRadius: 0,
                fill: '-2',
              },
            ]
          : []),
      ],
    };
  }, [data, forecast, isDark]);

  const options: ChartOptions<'line'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600, easing: 'easeOutQuart' },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            color: tickColor,
            boxWidth: 10,
            usePointStyle: true,
            font: { family: 'DM Sans, sans-serif', size: 11 },
          },
        },
        tooltip: {
          backgroundColor: isDark ? '#221B11' : '#FFF9EF',
          titleColor: isDark ? '#FFF9EF' : '#29231B',
          bodyColor: isDark ? '#E8C36A' : '#6A5B47',
          borderColor: 'rgba(217, 154, 37, 0.45)',
          borderWidth: 1,
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed.y;
              return v === null || v === undefined ? '' : `${ctx.dataset.label}: ${Number(v).toFixed(2)}%`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: tickColor, maxTicksLimit: 8, font: { size: 10 } },
        },
        y: {
          min: 0,
          max: 100,
          grid: { color: gridColor },
          ticks: {
            color: tickColor,
            callback: (val) => `${val}%`,
            font: { family: 'JetBrains Mono, monospace', size: 11 },
          },
        },
      },
    }),
    [gridColor, isDark, tickColor]
  );

  return <Line data={chartData} options={options} />;
};

export const NetworkTrafficChart: React.FC<
  { data: TelemetryPoint[]; forecast?: ForecastPoint[] } & ThemeProps
> = ({ data, forecast = [], theme }) => {
  const isDark = theme === 'dark';
  const gridColor = isDark ? 'rgba(232, 195, 106, 0.12)' : 'rgba(217, 154, 37, 0.14)';
  const tickColor = isDark ? '#D5C6AE' : '#6A5B47';

  const chartData = useMemo(() => {
    const observedLabels = data.map((p) => p.label);
    const futureLabels = forecast.map((f) => f.label);
    const allLabels = [...observedLabels, ...futureLabels];
    const lastIdx = data.length - 1;

    return {
      labels: allLabels,
      datasets: [
        {
          label: 'Ingress (Mbps)',
          data: [...data.map((p) => p.networkInMbps), ...futureLabels.map(() => null)],
          borderColor: '#D99A25',
          backgroundColor: 'rgba(245, 197, 66, 0.24)',
          borderWidth: 2.2,
          tension: 0.36,
          fill: true,
          pointRadius: 2.5,
          pointBackgroundColor: '#D99A25',
        },
        {
          label: 'Sanitized Egress (Mbps)',
          data: [...data.map((p) => p.networkOutMbps), ...futureLabels.map(() => null)],
          borderColor: isDark ? '#F5C542' : '#7A5416',
          backgroundColor: 'rgba(232, 195, 106, 0.16)',
          borderWidth: 2,
          tension: 0.36,
          fill: true,
          pointRadius: 2.5,
          pointBackgroundColor: isDark ? '#F5C542' : '#7A5416',
        },
        ...(forecast.length > 0
          ? [
              {
                label: 'Projected Ingress (Mbps)',
                data: allLabels.map((_, idx) =>
                  idx < lastIdx
                    ? null
                    : idx === lastIdx
                      ? (data[lastIdx]?.networkInMbps ?? null)
                      : (forecast[idx - data.length]?.networkInMbps ?? null)
                ),
                borderColor: '#059669',
                borderDash: [6, 4],
                borderWidth: 2,
                tension: 0.34,
                fill: false,
                pointRadius: 2.5,
              },
              {
                label: 'Projected Egress (Mbps)',
                data: allLabels.map((_, idx) =>
                  idx < lastIdx
                    ? null
                    : idx === lastIdx
                      ? (data[lastIdx]?.networkOutMbps ?? null)
                      : (forecast[idx - data.length]?.networkOutMbps ?? null)
                ),
                borderColor: '#0284C7',
                borderDash: [4, 4],
                borderWidth: 1.8,
                tension: 0.34,
                fill: false,
                pointRadius: 2.5,
              },
            ]
          : []),
      ],
    };
  }, [data, forecast, isDark]);

  const options: ChartOptions<'line'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600, easing: 'easeOutQuart' },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            color: tickColor,
            boxWidth: 10,
            usePointStyle: true,
            font: { family: 'DM Sans, sans-serif', size: 11 },
          },
        },
        tooltip: {
          backgroundColor: isDark ? '#221B11' : '#FFF9EF',
          titleColor: isDark ? '#FFF9EF' : '#29231B',
          bodyColor: isDark ? '#E8C36A' : '#6A5B47',
          borderColor: 'rgba(217, 154, 37, 0.45)',
          borderWidth: 1,
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed.y;
              return v === null || v === undefined ? '' : `${ctx.dataset.label}: ${Number(v).toFixed(2)} Mbps`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: tickColor, maxTicksLimit: 8, font: { size: 10 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: gridColor },
          ticks: {
            color: tickColor,
            callback: (val) => `${val}M`,
            font: { family: 'JetBrains Mono, monospace', size: 11 },
          },
        },
      },
    }),
    [gridColor, isDark, tickColor]
  );

  return <Line data={chartData} options={options} />;
};

export const PredictiveTrendChart: React.FC<
  {
    labels: string[];
    cpu: number[];
    memory: number[];
    responseMs: number[];
    cpuThreshold: number;
    forecast?: ForecastPoint[];
  } & ThemeProps
> = ({ labels, cpu, memory, responseMs, cpuThreshold, forecast = [], theme }) => {
  const isDark = theme === 'dark';
  const gridColor = isDark ? 'rgba(232, 195, 106, 0.12)' : 'rgba(217, 154, 37, 0.14)';
  const tickColor = isDark ? '#D5C6AE' : '#6A5B47';

  const chartData = useMemo(() => {
    const allLabels = [...labels, ...forecast.map((f) => f.label)];
    const lastIdx = labels.length - 1;

    return {
      labels: allLabels,
      datasets: [
        {
          label: 'Observed CPU (%)',
          data: [...cpu, ...forecast.map(() => null)],
          borderColor: '#D99A25',
          backgroundColor: 'rgba(245, 197, 66, 0.18)',
          borderWidth: 2.2,
          tension: 0.34,
        },
        {
          label: 'Observed Memory (%)',
          data: [...memory, ...forecast.map(() => null)],
          borderColor: isDark ? '#E8C36A' : '#7A5416',
          backgroundColor: 'rgba(232, 195, 106, 0.14)',
          borderWidth: 2,
          tension: 0.34,
        },
        ...(forecast.length > 0
          ? [
              {
                label: 'Future CPU Projection (%)',
                data: allLabels.map((_, idx) =>
                  idx < lastIdx
                    ? null
                    : idx === lastIdx
                      ? (cpu[lastIdx] ?? null)
                      : (forecast[idx - labels.length]?.cpu ?? null)
                ),
                borderColor: '#059669',
                borderDash: [6, 4],
                borderWidth: 2.2,
                tension: 0.32,
              },
              {
                label: 'Future Memory Projection (%)',
                data: allLabels.map((_, idx) =>
                  idx < lastIdx
                    ? null
                    : idx === lastIdx
                      ? (memory[lastIdx] ?? null)
                      : (forecast[idx - labels.length]?.memory ?? null)
                ),
                borderColor: '#0284C7',
                borderDash: [4, 4],
                borderWidth: 1.9,
                tension: 0.32,
              },
            ]
          : []),
        {
          label: `CPU Warning Baseline (${cpuThreshold}%)`,
          data: allLabels.map(() => cpuThreshold),
          borderColor: '#BE123C',
          borderDash: [6, 5],
          borderWidth: 1.5,
          pointRadius: 0,
        },
        {
          label: 'Scaled Latency (ms / 4)',
          data: [
            ...responseMs.map((r) => Number(Math.min(100, r / 4).toFixed(2))),
            ...forecast.map((f) => Number(Math.min(100, f.responseMs / 4).toFixed(2))),
          ],
          borderColor: '#B87914',
          borderWidth: 1.8,
          tension: 0.34,
        },
      ],
    };
  }, [labels, cpu, memory, responseMs, cpuThreshold, forecast, isDark]);

  const options: ChartOptions<'line'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600, easing: 'easeOutQuart' },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: { color: tickColor, boxWidth: 10, usePointStyle: true, font: { size: 11 } },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed.y;
              return v === null || v === undefined ? '' : `${ctx.dataset.label}: ${Number(v).toFixed(2)}`;
            },
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: tickColor, maxTicksLimit: 9, font: { size: 10 } } },
        y: {
          min: 0,
          max: 105,
          grid: { color: gridColor },
          ticks: { color: tickColor, font: { family: 'JetBrains Mono, monospace', size: 11 } },
        },
      },
    }),
    [gridColor, tickColor]
  );

  return <Line data={chartData} options={options} />;
};

export const AlertDistributionChart: React.FC<{ alerts: AlertItem[] } & ThemeProps> = ({
  alerts,
  theme,
}) => {
  const isDark = theme === 'dark';
  const tickColor = isDark ? '#D5C6AE' : '#6A5B47';

  const counts = useMemo(() => {
    const map = { low: 0, medium: 0, high: 0, critical: 0 };
    alerts.forEach((a) => {
      map[a.severity] += 1;
    });
    return map;
  }, [alerts]);

  const data = {
    labels: ['Low', 'Medium', 'High', 'Critical'],
    datasets: [
      {
        label: 'Alerts',
        data: [counts.low, counts.medium, counts.high, counts.critical],
        backgroundColor: [
          'rgba(232, 195, 106, 0.90)',
          'rgba(245, 197, 66, 0.92)',
          'rgba(217, 154, 37, 0.92)',
          'rgba(190, 18, 60, 0.85)',
        ],
        borderColor: isDark ? '#221B11' : '#FFF9EF',
        borderWidth: 2,
      },
    ],
  };

  return (
    <Doughnut
      data={data}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600, easing: 'easeOutQuart' },
        cutout: '66%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: tickColor,
              padding: 16,
              usePointStyle: true,
              font: { size: 12 },
            },
          },
        },
      }}
    />
  );
};

export const PrivacyDecisionBarChart: React.FC<
  { approved: number; blocked: number } & ThemeProps
> = ({ approved, blocked, theme }) => {
  const isDark = theme === 'dark';
  const gridColor = isDark ? 'rgba(232, 195, 106, 0.12)' : 'rgba(217, 154, 37, 0.14)';
  const tickColor = isDark ? '#D5C6AE' : '#6A5B47';

  const data = {
    labels: ['Approved Summaries', 'Blocked Exports'],
    datasets: [
      {
        label: 'Inspections',
        data: [approved, blocked],
        backgroundColor: ['rgba(245, 197, 66, 0.9)', 'rgba(217, 154, 37, 0.9)'],
        borderRadius: 8,
        barThickness: 42,
      },
    ],
  };

  return (
    <Bar
      data={data}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600, easing: 'easeOutQuart' },
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: tickColor } },
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1, color: tickColor, font: { family: 'JetBrains Mono, monospace' } },
            grid: { color: gridColor },
          },
        },
      }}
    />
  );
};
