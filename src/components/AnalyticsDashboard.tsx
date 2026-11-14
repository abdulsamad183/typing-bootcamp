import React, { useMemo, useState } from "react";
import { Award, Trash2, TrendingUp } from "lucide-react";
import { TestMode, TestResult } from "../types/typing";
import { ALL_FINGERS, getFingerForKey } from "../data/wordBanks";
import { computeAchievements } from "../utils/storage";

interface AnalyticsDashboardProps {
  history: TestResult[];
  onDeleteResult: (id: string) => void;
  onClearHistory: () => void;
  onGoToArena: () => void;
}

type HistoryFilter = "all" | "timed" | "words" | "code" | "drill";

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  history,
  onDeleteResult,
  onClearHistory,
  onGoToArena,
}) => {
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [confirmClear, setConfirmClear] = useState<boolean>(false);

  const stats = useMemo(() => {
    if (history.length === 0) {
      return {
        avgLast10Wpm: 0,
        bestWpm: 0,
        avgAccuracy: 0,
        totalRuns: 0,
      };
    }
    const last10 = history.slice(0, 10);
    const avgLast10Wpm = Math.round(
      last10.reduce((sum, r) => sum + r.wpm, 0) / last10.length
    );
    const bestWpm = history.reduce((max, r) => Math.max(max, r.wpm), 0);
    const avgAccuracy = Math.round(
      history.reduce((sum, r) => sum + r.accuracy, 0) / history.length
    );
    return {
      avgLast10Wpm,
      bestWpm,
      avgAccuracy,
      totalRuns: history.length,
    };
  }, [history]);

  // Chronological last 10 tests for progression chart (oldest -> newest)
  const chartData = useMemo(() => {
    return [...history].slice(0, 10).reverse();
  }, [history]);

  const persistentKeys = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const run of history) {
      for (const [k, v] of Object.entries(run.missedKeys)) {
        counts[k] = (counts[k] ?? 0) + v;
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [history]);

  const fingerErrors = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const finger of ALL_FINGERS) {
      counts[finger] = 0;
    }
    for (const run of history) {
      for (const [k, v] of Object.entries(run.missedKeys)) {
        const finger = getFingerForKey(k);
        counts[finger] = (counts[finger] ?? 0) + v;
      }
    }
    const maxVal = Math.max(1, ...Object.values(counts));
    return ALL_FINGERS.map((finger) => ({
      finger,
      errors: counts[finger],
      ratio: counts[finger] / maxVal,
    }));
  }, [history]);

  const achievements = useMemo(() => computeAchievements(history), [history]);

  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      if (filter === "all") return true;
      if (filter === "drill") return item.isCustomDrill;
      return item.mode === filter;
    });
  }, [history, filter]);

  if (history.length === 0) {
    return (
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-12">
        <div
          className="p-10 rounded-lg border text-center space-y-4"
          style={{
            backgroundColor: "var(--bg-surface)",
            borderColor: "var(--border-subtle)",
          }}
        >
          <TrendingUp
            className="w-8 h-8 mx-auto"
            style={{ color: "var(--accent-primary)" }}
            aria-hidden="true"
          />
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            No Telemetry Recorded Yet
          </h1>
          <p
            className="text-sm max-w-md mx-auto"
            style={{ color: "var(--text-secondary)" }}
          >
            Complete a typing run in the Arena to unlock your Last-10 WPM progression curve, persistent problem key diagnostics, and milestone tracking.
          </p>
          <button
            type="button"
            onClick={onGoToArena}
            className="px-5 py-2.5 text-xs font-semibold rounded cursor-pointer"
            style={{
              backgroundColor: "var(--accent-primary)",
              color: "var(--accent-primary-fg)",
            }}
          >
            Start First Test
          </button>
        </div>
      </div>
    );
  }

  // SVG Chart Geometry
  const svgWidth = 760;
  const svgHeight = 220;
  const padLeft = 40;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 30;
  const innerW = svgWidth - padLeft - padRight;
  const innerH = svgHeight - padTop - padBottom;

  const maxWpm = Math.max(80, ...chartData.map((d) => d.wpm + 15));
  const minWpm = 0;

  const points = chartData.map((d, idx) => {
    const x =
      chartData.length === 1
        ? padLeft + innerW / 2
        : padLeft + (idx / (chartData.length - 1)) * innerW;
    const y =
      padTop + innerH - ((d.wpm - minWpm) / (maxWpm - minWpm)) * innerH;
    return { x, y, data: d, idx };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(
          padTop + innerH
        ).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padTop + innerH).toFixed(
          1
        )} Z`
      : "";

  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : points[points.length - 1];

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-8 space-y-8">
      <div
        className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b pb-5"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div>
          <h1
            className="text-2xl sm:text-3xl font-bold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Performance Analytics
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            Rolling progression across your last 10 runs, cumulative error patterns, and finger efficiency.
          </p>
        </div>

        <div>
          {!confirmClear ? (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="px-3.5 py-2 text-xs font-medium rounded border cursor-pointer whitespace-nowrap shrink-0"
              style={{
                borderColor: "var(--border-subtle)",
                color: "var(--text-secondary)",
              }}
            >
              Clear History
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onClearHistory();
                  setConfirmClear(false);
                }}
                className="px-3.5 py-2 text-xs font-semibold rounded cursor-pointer whitespace-nowrap shrink-0"
                style={{
                  backgroundColor: "var(--status-error)",
                  color: "#ffffff",
                }}
              >
                Confirm Clear
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="px-3 py-2 text-xs font-medium rounded border cursor-pointer whitespace-nowrap shrink-0"
                style={{
                  borderColor: "var(--border-subtle)",
                  color: "var(--text-secondary)",
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 4-Column KPI Strip */}
      <div
        className="grid grid-cols-2 lg:grid-cols-4 rounded-lg border divide-y lg:divide-y-0 lg:divide-x"
        style={{
          backgroundColor: "var(--bg-surface)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <div className="p-5" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            Avg WPM (Last 10 Tests)
          </div>
          <div
            className="mt-2 font-mono-hud text-3xl font-bold"
            style={{ color: "var(--accent-primary)" }}
          >
            {stats.avgLast10Wpm}
          </div>
        </div>

        <div className="p-5" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            All-Time Peak WPM
          </div>
          <div
            className="mt-2 font-mono-hud text-3xl font-bold"
            style={{ color: "var(--status-success)" }}
          >
            {stats.bestWpm}
          </div>
        </div>

        <div className="p-5" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            Mean Accuracy
          </div>
          <div
            className="mt-2 font-mono-hud text-3xl font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            {stats.avgAccuracy}%
          </div>
        </div>

        <div className="p-5" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            Completed Runs
          </div>
          <div
            className="mt-2 font-mono-hud text-3xl font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            {stats.totalRuns}
          </div>
        </div>
      </div>

      {/* WPM Progression Chart */}
      <section
        aria-label="WPM progression chart"
        className="p-6 rounded-lg border space-y-4"
        style={{
          backgroundColor: "var(--bg-surface)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2
              className="text-base font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              WPM Progression (Last {chartData.length} Tests)
            </h2>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Hover points to inspect individual test speed and accuracy
            </p>
          </div>
          {activePoint && (
            <div
              className="font-mono-hud text-xs flex items-center gap-3 px-3 py-1.5 rounded border"
              style={{
                backgroundColor: "var(--bg-recessed)",
                borderColor: "var(--border-subtle)",
                color: "var(--text-primary)",
              }}
            >
              <span style={{ color: "var(--accent-primary)" }}>
                {activePoint.data.wpm} WPM
              </span>
              <span aria-hidden="true">·</span>
              <span style={{ color: "var(--status-success)" }}>
                {activePoint.data.accuracy}% Acc
              </span>
              <span aria-hidden="true">·</span>
              <span style={{ color: "var(--text-secondary)" }}>
                {new Date(activePoint.data.timestamp).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          )}
        </div>

        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full min-w-[480px] h-auto"
            role="img"
            aria-label="WPM progression line chart"
          >
            <defs>
              <linearGradient id="wpmAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.28" />
                <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((frac, idx) => {
              const y = padTop + innerH * (1 - frac);
              const val = Math.round(minWpm + (maxWpm - minWpm) * frac);
              return (
                <g key={idx}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={svgWidth - padRight}
                    y2={y}
                    stroke="var(--border-subtle)"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={padLeft - 8}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="10"
                    fontFamily="var(--font-mono)"
                    fill="var(--text-muted)"
                  >
                    {val}
                  </text>
                </g>
              );
            })}

            {points.length > 1 && (
              <>
                <path d={areaPath} fill="url(#wpmAreaGrad)" />
                <path
                  d={linePath}
                  fill="none"
                  stroke="var(--accent-primary)"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </>
            )}

            {points.map((p) => {
              const isSelected = activePoint?.idx === p.idx;
              return (
                <g
                  key={p.data.id}
                  onMouseEnter={() => setHoveredIdx(p.idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className="cursor-pointer"
                >
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isSelected ? 6 : 4}
                    fill="var(--bg-canvas)"
                    stroke="var(--accent-primary)"
                    strokeWidth={isSelected ? 3 : 2}
                  />
                  <text
                    x={p.x}
                    y={svgHeight - 8}
                    textAnchor="middle"
                    fontSize="10"
                    fontFamily="var(--font-mono)"
                    fill="var(--text-muted)"
                  >
                    #{p.idx + 1}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </section>

      {/* Problem Keys + Finger Error Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section
          className="p-6 rounded-lg border space-y-4"
          style={{
            backgroundColor: "var(--bg-surface)",
            borderColor: "var(--border-subtle)",
          }}
        >
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Persistent Problem Keys
          </h2>
          {persistentKeys.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              No recurring error keys detected yet.
            </p>
          ) : (
            <div className="space-y-2.5">
              {persistentKeys.map(([key, count]) => {
                const maxErr = persistentKeys[0][1];
                const pct = Math.round((count / maxErr) * 100);
                return (
                  <div key={key} className="flex items-center gap-3 text-xs">
                    <span
                      className="w-12 font-mono-hud font-semibold text-center py-1 rounded border"
                      style={{
                        backgroundColor: "var(--bg-recessed)",
                        borderColor: "var(--border-subtle)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {key === " " ? "SPC" : key.toUpperCase()}
                    </span>
                    <div
                      className="flex-1 h-2 rounded overflow-hidden"
                      style={{ backgroundColor: "var(--bg-recessed)" }}
                    >
                      <div
                        className="h-full rounded"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: "var(--status-error)",
                        }}
                      />
                    </div>
                    <span
                      className="w-16 text-right font-mono-hud"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {count} misses
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section
          className="p-6 rounded-lg border space-y-4"
          style={{
            backgroundColor: "var(--bg-surface)",
            borderColor: "var(--border-subtle)",
          }}
        >
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Errors by Finger
          </h2>
          <div className="space-y-2.5">
            {fingerErrors.map((item) => (
              <div key={item.finger} className="flex items-center gap-3 text-xs">
                <span
                  className="w-28 truncate"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {item.finger}
                </span>
                <div
                  className="flex-1 h-2 rounded overflow-hidden"
                  style={{ backgroundColor: "var(--bg-recessed)" }}
                >
                  <div
                    className="h-full rounded"
                    style={{
                      width: `${Math.round(item.ratio * 100)}%`,
                      backgroundColor:
                        item.errors > 0
                          ? "var(--accent-primary)"
                          : "transparent",
                    }}
                  />
                </div>
                <span
                  className="w-10 text-right font-mono-hud"
                  style={{ color: "var(--text-primary)" }}
                >
                  {item.errors}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Achievements */}
      <section
        className="p-6 rounded-lg border space-y-4"
        style={{
          backgroundColor: "var(--bg-surface)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <div className="flex items-center gap-2">
          <Award
            className="w-4 h-4"
            style={{ color: "var(--accent-primary)" }}
            aria-hidden="true"
          />
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Milestones
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {achievements.map((ach) => (
            <div
              key={ach.id}
              className="p-4 rounded border flex flex-col justify-between gap-2"
              style={{
                backgroundColor: "var(--bg-recessed)",
                borderColor: ach.unlocked
                  ? "var(--status-success)"
                  : "var(--border-subtle)",
                opacity: ach.unlocked ? 1 : 0.72,
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className="text-sm font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {ach.title}
                </span>
                <span
                  className="font-mono-hud text-xs font-medium"
                  style={{
                    color: ach.unlocked
                      ? "var(--status-success)"
                      : "var(--text-muted)",
                  }}
                >
                  {ach.unlocked ? "Unlocked" : ach.progressLabel}
                </span>
              </div>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {ach.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Run History Table */}
      <section
        className="rounded-lg border overflow-hidden"
        style={{
          backgroundColor: "var(--bg-surface)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <div
          className="px-6 py-4 border-b flex flex-wrap items-center justify-between gap-4"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Test History
          </h2>

          <div
            className="flex items-center p-1 rounded border"
            style={{
              backgroundColor: "var(--bg-recessed)",
              borderColor: "var(--border-subtle)",
            }}
          >
            {(
              [
                { id: "all", label: "All" },
                { id: "timed", label: "Timed" },
                { id: "words", label: "Words" },
                { id: "code", label: "Code" },
                { id: "drill", label: "AI Drills" },
              ] as Array<{ id: HistoryFilter; label: string }>
            ).map((tab) => {
              const active = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className="px-3 py-1 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  style={{
                    backgroundColor: active
                      ? "var(--bg-surface-elevated)"
                      : "transparent",
                    color: active
                      ? "var(--text-primary)"
                      : "var(--text-secondary)",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr
                className="border-b text-xs"
                style={{
                  borderColor: "var(--border-subtle)",
                  color: "var(--text-muted)",
                }}
              >
                <th className="py-3 px-6 font-medium">Timestamp</th>
                <th className="py-3 px-4 font-medium">Mode</th>
                <th className="py-3 px-4 font-medium text-right">WPM</th>
                <th className="py-3 px-4 font-medium text-right">Net WPM</th>
                <th className="py-3 px-4 font-medium text-right">Accuracy</th>
                <th className="py-3 px-4 font-medium text-right">Errors</th>
                <th className="py-3 px-4 font-medium text-right">Duration</th>
                <th className="py-3 px-6 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm" style={{ borderColor: "var(--border-subtle)" }}>
              {filteredHistory.map((row) => {
                const modeLabel = row.isCustomDrill
                  ? "AI Drill"
                  : row.mode === TestMode.TIMED
                  ? `Timed ${row.subOption}s`
                  : row.mode === TestMode.WORDS
                  ? `${row.subOption} Words`
                  : `Code ${row.subOption}x`;
                return (
                  <tr
                    key={row.id}
                    className="h-11 transition-colors"
                    style={{ borderColor: "var(--border-subtle)" }}
                  >
                    <td
                      className="py-2.5 px-6 font-mono-hud text-xs whitespace-nowrap"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {new Date(row.timestamp).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td
                      className="py-2.5 px-4 text-xs whitespace-nowrap"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {modeLabel}
                    </td>
                    <td
                      className="py-2.5 px-4 font-mono-hud font-semibold text-right"
                      style={{ color: "var(--accent-primary)" }}
                    >
                      {row.wpm}
                    </td>
                    <td
                      className="py-2.5 px-4 font-mono-hud text-right"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {row.netWpm}
                    </td>
                    <td
                      className="py-2.5 px-4 font-mono-hud font-semibold text-right"
                      style={{
                        color:
                          row.accuracy >= 95
                            ? "var(--status-success)"
                            : "var(--text-primary)",
                      }}
                    >
                      {row.accuracy}%
                    </td>
                    <td
                      className="py-2.5 px-4 font-mono-hud text-right"
                      style={{
                        color:
                          row.errors > 0
                            ? "var(--status-error)"
                            : "var(--text-muted)",
                      }}
                    >
                      {row.errors}
                    </td>
                    <td
                      className="py-2.5 px-4 font-mono-hud text-right"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {row.durationSeconds}s
                    </td>
                    <td className="py-2.5 px-6 text-right">
                      <button
                        type="button"
                        onClick={() => onDeleteResult(row.id)}
                        aria-label="Delete test result"
                        className="p-1.5 rounded transition-colors cursor-pointer"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
