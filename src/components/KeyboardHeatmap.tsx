import React from "react";
import { KEYBOARD_ROWS, ALL_FINGERS, getFingerForKey } from "../data/wordBanks";

interface KeyboardHeatmapProps {
  nextChar: string;
  lastPressedKey: string | null;
  lastPressedError: boolean;
  missedKeys: Record<string, number>;
  keyAttempts: Record<string, number>;
}

export const KeyboardHeatmap: React.FC<KeyboardHeatmapProps> = ({
  nextChar,
  lastPressedKey,
  lastPressedError,
  missedKeys,
  keyAttempts,
}) => {
  const normalizedNext = nextChar.toLowerCase();
  const normalizedLast = lastPressedKey?.toLowerCase() ?? null;

  const fingerStats = ALL_FINGERS.map((finger) => {
    let attempts = 0;
    let errors = 0;
    for (const [key, count] of Object.entries(keyAttempts)) {
      if (getFingerForKey(key) === finger) {
        attempts += count;
      }
    }
    for (const [key, count] of Object.entries(missedKeys)) {
      if (getFingerForKey(key) === finger) {
        errors += count;
      }
    }
    const accuracy = attempts > 0 ? Math.max(0, Math.round(((attempts - errors) / attempts) * 100)) : 100;
    return { finger, attempts, errors, accuracy };
  });

  const renderKey = (keyLabel: string, wide = false) => {
    const isNext = normalizedNext === keyLabel || (keyLabel === "space" && nextChar === " ");
    const isLast = normalizedLast === keyLabel || (keyLabel === "space" && lastPressedKey === " ");
    const errCount = missedKeys[keyLabel === "space" ? " " : keyLabel] ?? 0;

    let bg = "var(--bg-surface)";
    let border = "var(--border-subtle)";
    let color = "var(--text-secondary)";
    let boxShadow = "none";

    if (isLast && lastPressedError) {
      bg = "var(--status-error-soft)";
      border = "var(--status-error)";
      color = "var(--status-error)";
    } else if (isNext) {
      bg = "var(--accent-primary-soft)";
      border = "var(--accent-primary)";
      color = "var(--text-primary)";
      boxShadow = "0 0 12px var(--accent-primary-glow)";
    } else if (errCount > 0) {
      bg = "var(--status-error-soft)";
      border = "rgba(239, 68, 68, 0.4)";
      color = "var(--text-primary)";
    }

    return (
      <div
        key={keyLabel}
        className={`relative flex items-center justify-center font-mono-hud text-xs font-medium rounded select-none transition-all duration-100 border ${
          wide ? "w-48 h-9" : "w-9 h-9"
        }`}
        style={{
          backgroundColor: bg,
          borderColor: border,
          color,
          boxShadow,
        }}
      >
        <span>{keyLabel === "space" ? "SPACE" : keyLabel.toUpperCase()}</span>
        {errCount > 0 && (
          <span
            className="absolute -top-1.5 -right-1.5 px-1 text-[10px] leading-tight font-semibold rounded"
            style={{
              backgroundColor: "var(--status-error)",
              color: "#ffffff",
            }}
            aria-label={`${errCount} errors on ${keyLabel}`}
          >
            {errCount}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="w-full max-w-[960px] mx-auto">
      {/* Desktop: Interactive Keyboard Heatmap */}
      <div
        className="hidden md:flex flex-col items-center gap-2 p-4 rounded-lg border"
        style={{
          backgroundColor: "var(--bg-surface)",
          borderColor: "var(--border-subtle)",
        }}
      >
        {KEYBOARD_ROWS.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className="flex items-center gap-1.5"
            style={{
              paddingLeft: rowIndex === 1 ? "16px" : rowIndex === 2 ? "36px" : "0px",
            }}
          >
            {row.map((key) => renderKey(key))}
          </div>
        ))}
        <div className="flex items-center justify-center pt-0.5">
          {renderKey("space", true)}
        </div>
      </div>

      {/* Mobile: Compact Finger Accuracy Indicators */}
      <div
        className="md:hidden grid grid-cols-3 gap-2 p-3 rounded-lg border"
        style={{
          backgroundColor: "var(--bg-surface)",
          borderColor: "var(--border-subtle)",
        }}
      >
        {fingerStats
          .filter((f) => f.attempts > 0 || f.errors > 0)
          .slice(0, 6)
          .map((stat) => (
            <div
              key={stat.finger}
              className="flex items-center justify-between text-xs px-2 py-1.5 rounded border"
              style={{
                borderColor: stat.errors > 0 ? "var(--status-error)" : "var(--border-subtle)",
                backgroundColor: stat.errors > 0 ? "var(--status-error-soft)" : "var(--bg-recessed)",
              }}
            >
              <span className="truncate" style={{ color: "var(--text-secondary)" }}>
                {stat.finger.replace("Left ", "L ").replace("Right ", "R ")}
              </span>
              <span
                className="font-mono-hud font-semibold ml-1"
                style={{
                  color: stat.errors > 0 ? "var(--status-error)" : "var(--status-success)",
                }}
              >
                {stat.accuracy}%
              </span>
            </div>
          ))}
        {fingerStats.every((f) => f.attempts === 0) && (
          <div
            className="col-span-3 text-center text-xs py-1"
            style={{ color: "var(--text-muted)" }}
          >
            Finger accuracy telemetry activates as you type
          </div>
        )}
      </div>
    </div>
  );
};
