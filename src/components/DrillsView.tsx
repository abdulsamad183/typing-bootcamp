import React, { useState } from "react";
import { Play, Sparkles, Trash2, AlertCircle, RefreshCw } from "lucide-react";
import { SavedDrill, TestResult } from "../types/typing";
import { requestAIDrill } from "../services/aiService";

interface DrillsViewProps {
  savedDrills: SavedDrill[];
  history: TestResult[];
  onStartDrill: (drillText: string, drillTitle?: string) => void;
  onSaveDrill: (drill: SavedDrill) => void;
  onDeleteDrill: (id: string) => void;
}

export const DrillsView: React.FC<DrillsViewProps> = ({
  savedDrills,
  history,
  onStartDrill,
  onSaveDrill,
  onDeleteDrill,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGenerateFromHistory = async () => {
    setIsGenerating(true);
    setErrorMsg(null);
    try {
      const aggregatedKeys: Record<string, number> = {};
      const aggregatedBigrams: Record<string, number> = {};
      let wpmSum = 0;
      let accSum = 0;

      const recent = history.slice(0, 10);
      for (const run of recent) {
        wpmSum += run.wpm;
        accSum += run.accuracy;
        for (const [k, v] of Object.entries(run.missedKeys)) {
          aggregatedKeys[k] = (aggregatedKeys[k] ?? 0) + v;
        }
        for (const [b, v] of Object.entries(run.bigrams)) {
          aggregatedBigrams[b] = (aggregatedBigrams[b] ?? 0) + v;
        }
      }

      const avgWpm = recent.length > 0 ? Math.round(wpmSum / recent.length) : 60;
      const avgAcc = recent.length > 0 ? Math.round(accSum / recent.length) : 95;

      const errorPairs = Object.entries(aggregatedKeys)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([expected, count]) => ({
          expected,
          actual: "missed",
          count,
        }));

      const response = await requestAIDrill({
        missedKeys: aggregatedKeys,
        errorPairs,
        bigrams: aggregatedBigrams,
        wpm: avgWpm,
        accuracy: avgAcc,
        mode: "cumulative",
      });

      const newDrill: SavedDrill = {
        id: `drill_${Date.now()}`,
        createdAt: Date.now(),
        sourceWpm: avgWpm,
        sourceAccuracy: avgAcc,
        drill: response,
      };
      onSaveDrill(newDrill);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to generate cumulative drill."
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b pb-6" style={{ borderColor: "var(--border-subtle)" }}>
        <div>
          <h1
            className="text-2xl sm:text-3xl font-bold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            AI Practice Drills
          </h1>
          <p className="mt-1.5 text-sm max-w-2xl" style={{ color: "var(--text-secondary)" }}>
            Targeted 3-sentence exercises synthesized by Gemini from your actual missed keys, slow bigrams, and finger error patterns.
          </p>
        </div>

        <button
          type="button"
          onClick={handleGenerateFromHistory}
          disabled={isGenerating}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
          style={{
            backgroundColor: "var(--accent-primary)",
            color: "var(--accent-primary-fg)",
          }}
        >
          {isGenerating ? (
            <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="w-4 h-4" aria-hidden="true" />
          )}
          <span>
            {isGenerating ? "Analyzing History..." : "Generate Cumulative Drill"}
          </span>
        </button>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="flex items-center justify-between gap-4 p-4 rounded-lg border"
          style={{
            backgroundColor: "var(--status-error-soft)",
            borderColor: "var(--status-error)",
            color: "var(--text-primary)",
          }}
        >
          <div className="flex items-center gap-3 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" style={{ color: "var(--status-error)" }} />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={handleGenerateFromHistory}
            className="px-3 py-1.5 text-xs font-medium rounded border whitespace-nowrap shrink-0 cursor-pointer"
            style={{
              borderColor: "var(--border-strong)",
              color: "var(--text-primary)",
            }}
          >
            Retry
          </button>
        </div>
      )}

      {savedDrills.length === 0 ? (
        <div
          className="p-10 rounded-lg border text-center space-y-4"
          style={{
            backgroundColor: "var(--bg-surface)",
            borderColor: "var(--border-subtle)",
          }}
        >
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            No Custom Drills Saved Yet
          </h2>
          <p className="text-sm max-w-md mx-auto" style={{ color: "var(--text-secondary)" }}>
            Complete a typing test in the Arena to automatically generate a tailored AI drill, or generate one right now from baseline rhythms.
          </p>
          <button
            type="button"
            onClick={handleGenerateFromHistory}
            disabled={isGenerating}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded cursor-pointer"
            style={{
              backgroundColor: "var(--accent-primary)",
              color: "var(--accent-primary-fg)",
            }}
          >
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Generate First Drill</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {savedDrills.map((item) => {
            const dateStr = new Date(item.createdAt).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });
            return (
              <article
                key={item.id}
                className="flex flex-col justify-between p-6 rounded-lg border gap-5"
                style={{
                  backgroundColor: "var(--bg-surface)",
                  borderColor: "var(--border-subtle)",
                }}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div
                      className="flex items-center gap-2 text-xs font-mono-hud"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      <span>{dateStr}</span>
                      <span aria-hidden="true">·</span>
                      <span>Source {item.sourceWpm} WPM</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.sourceAccuracy}% Acc</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteDrill(item.id)}
                      aria-label="Delete drill"
                      className="p-1.5 rounded transition-colors cursor-pointer"
                      style={{ color: "var(--text-muted)" }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {item.drill.focusSummary}
                  </p>

                  <blockquote
                    className="p-4 rounded border font-mono-hud text-sm leading-relaxed"
                    style={{
                      backgroundColor: "var(--bg-recessed)",
                      borderColor: "var(--border-subtle)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {item.drill.drillParagraph}
                  </blockquote>

                  {item.drill.weakKeysTargeted.length > 0 && (
                    <div className="flex items-center flex-wrap gap-2 text-xs">
                      <span style={{ color: "var(--text-muted)" }}>Targets:</span>
                      <span className="font-mono-hud" style={{ color: "var(--accent-primary)" }}>
                        {item.drill.weakKeysTargeted.join(" · ")}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: "var(--border-subtle)" }}>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {item.drill.drillParagraph.split(/\s+/).length} words
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onStartDrill(item.drill.drillParagraph, "Saved AI Drill")
                    }
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded cursor-pointer whitespace-nowrap shrink-0"
                    style={{
                      backgroundColor: "var(--accent-primary)",
                      color: "var(--accent-primary-fg)",
                    }}
                  >
                    <Play className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Start Drill</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
