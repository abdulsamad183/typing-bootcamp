import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Keyboard,
  Play,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  AIDrillResponse,
  ErrorPair,
  SavedDrill,
  TestMode,
  TestResult,
  ThemeId,
  TypingState,
} from "../types/typing";
import {
  generateCodeText,
  generateTimedText,
  generateWordStream,
  getFingerForKey,
} from "../data/wordBanks";
import { playKeyClick } from "../utils/sound";
import { requestAIDrill } from "../services/aiService";
import { KeyboardHeatmap } from "./KeyboardHeatmap";

interface TypingArenaProps {
  theme: ThemeId;
  onChangeTheme: (theme: ThemeId) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  showKeyboard: boolean;
  onToggleKeyboard: () => void;
  history: TestResult[];
  onTestComplete: (result: TestResult) => void;
  onSaveDrill: (drill: SavedDrill) => void;
  externalDrill: { text: string; label: string; nonce: number } | null;
  onClearExternalDrill: () => void;
  restartSignal: number;
}

const TIMED_OPTIONS = [15, 30, 60, 120];
const WORD_OPTIONS = [10, 25, 50, 100];
const CODE_OPTIONS = [1, 2, 3];

function createTargetText(mode: TestMode, subOption: number): string {
  if (mode === TestMode.TIMED) {
    return generateTimedText();
  }
  if (mode === TestMode.WORDS) {
    return generateWordStream(subOption);
  }
  return generateCodeText(subOption);
}

export const TypingArena: React.FC<TypingArenaProps> = ({
  theme,
  onChangeTheme,
  soundEnabled,
  onToggleSound,
  showKeyboard,
  onToggleKeyboard,
  history,
  onTestComplete,
  onSaveDrill,
  externalDrill,
  onClearExternalDrill,
  restartSignal,
}) => {
  const [mode, setMode] = useState<TestMode>(TestMode.TIMED);
  const [subOption, setSubOption] = useState<number>(30);
  const [activeDrillLabel, setActiveDrillLabel] = useState<string | null>(null);

  const [typingState, setTypingState] = useState<TypingState>(() => {
    const initial = createTargetText(TestMode.TIMED, 30);
    return {
      targetText: initial,
      currentIndex: 0,
      userInput: "",
      startTime: null,
      endTime: null,
      isStarted: false,
      isFinished: false,
      errors: 0,
      totalChars: 0,
    };
  });

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [isFocused, setIsFocused] = useState<boolean>(true);

  // Telemetry state for per-key, bigram, and error-pair tracking
  const [missedKeys, setMissedKeys] = useState<Record<string, number>>({});
  const [keyAttempts, setKeyAttempts] = useState<Record<string, number>>({});
  const [bigrams, setBigrams] = useState<Record<string, number>>({});
  const [errorPairs, setErrorPairs] = useState<ErrorPair[]>([]);
  const [lastPressedKey, setLastPressedKey] = useState<string | null>(null);
  const [lastPressedError, setLastPressedError] = useState<boolean>(false);

  // Post-test AI drill generation state
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiDrill, setAiDrill] = useState<AIDrillResponse | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const stageContainerRef = useRef<HTMLDivElement | null>(null);
  const activeCharRef = useRef<HTMLSpanElement | null>(null);
  const completionRecordedRef = useRef<boolean>(false);

  // Keep latest state accessible in timer intervals without stale closures
  const stateRef = useRef(typingState);
  stateRef.current = typingState;
  const telemetryRef = useRef({ missedKeys, bigrams, errorPairs });
  telemetryRef.current = { missedKeys, bigrams, errorPairs };
  const modeRef = useRef({ mode, subOption, activeDrillLabel });
  modeRef.current = { mode, subOption, activeDrillLabel };

  const resetRun = useCallback(
    (customText?: string, customLabel?: string | null) => {
      const nextTarget =
        customText ?? createTargetText(modeRef.current.mode, modeRef.current.subOption);
      completionRecordedRef.current = false;
      setTypingState({
        targetText: nextTarget,
        currentIndex: 0,
        userInput: "",
        startTime: null,
        endTime: null,
        isStarted: false,
        isFinished: false,
        errors: 0,
        totalChars: 0,
      });
      setMissedKeys({});
      setKeyAttempts({});
      setBigrams({});
      setErrorPairs([]);
      setLastPressedKey(null);
      setLastPressedError(false);
      setAiLoading(false);
      setAiError(null);
      setAiDrill(null);
      setActiveDrillLabel(customLabel ?? null);
      if (!customText) {
        onClearExternalDrill();
      }
      if (stageContainerRef.current) {
        stageContainerRef.current.scrollTop = 0;
      }
      requestAnimationFrame(() => {
        inputRef.current?.focus({ preventScroll: true });
      });
    },
    [onClearExternalDrill]
  );

  // Trigger external drill when launched from AI Coach view
  useEffect(() => {
    if (externalDrill) {
      resetRun(externalDrill.text, externalDrill.label);
    }
  }, [externalDrill, resetRun]);

  // Trigger restart from Header button
  useEffect(() => {
    if (restartSignal > 0) {
      resetRun();
    }
  }, [restartSignal, resetRun]);

  const triggerAIAnalysis = useCallback(
    async (
      wpm: number,
      accuracy: number,
      missed: Record<string, number>,
      pairs: ErrorPair[],
      bigramMap: Record<string, number>,
      testModeLabel: string
    ) => {
      setAiLoading(true);
      setAiError(null);
      try {
        const result = await requestAIDrill({
          missedKeys: missed,
          errorPairs: pairs,
          bigrams: bigramMap,
          wpm,
          accuracy,
          mode: testModeLabel,
        });
        setAiDrill(result);
        onSaveDrill({
          id: `drill_${Date.now()}`,
          createdAt: Date.now(),
          sourceWpm: wpm,
          sourceAccuracy: accuracy,
          drill: result,
        });
      } catch (err) {
        setAiError(
          err instanceof Error
            ? err.message
            : "Could not reach Gemini AI drill service."
        );
      } finally {
        setAiLoading(false);
      }
    },
    [onSaveDrill]
  );

  const finalizeRun = useCallback(
    (finalState: TypingState, endTimestamp: number) => {
      if (completionRecordedRef.current) return;
      completionRecordedRef.current = true;

      const start = finalState.startTime ?? endTimestamp;
      const elapsedMs = Math.max(endTimestamp - start, 500);
      const elapsedMin = elapsedMs / 60000;
      const charsTyped = finalState.userInput.length;

      let correctCount = 0;
      for (let i = 0; i < charsTyped; i++) {
        if (finalState.userInput[i] === finalState.targetText[i]) {
          correctCount++;
        }
      }
      const uncorrectedErrors = charsTyped - correctCount;

      const grossWpm = Math.max(0, Math.round(charsTyped / 5 / elapsedMin));
      const netWpm = Math.max(
        0,
        Math.round((correctCount / 5 - uncorrectedErrors) / elapsedMin)
      );
      const accuracy =
        finalState.totalChars > 0
          ? Math.max(
              0,
              Math.min(
                100,
                Math.round(
                  ((finalState.totalChars - finalState.errors) /
                    finalState.totalChars) *
                    100
                )
              )
            )
          : 100;

      const { missedKeys: mKeys, bigrams: bgMap, errorPairs: ePairs } =
        telemetryRef.current;
      const { mode: currentMode, subOption: currentSub, activeDrillLabel: drillLabel } =
        modeRef.current;

      const result: TestResult = {
        id: `run_${Date.now()}`,
        timestamp: endTimestamp,
        wpm: grossWpm,
        netWpm,
        accuracy,
        mode: currentMode,
        subOption: currentSub,
        durationSeconds: Math.max(1, Math.round(elapsedMs / 1000)),
        totalChars: finalState.totalChars,
        errors: finalState.errors,
        missedKeys: { ...mKeys },
        bigrams: { ...bgMap },
        isCustomDrill: Boolean(drillLabel),
      };

      onTestComplete(result);
      triggerAIAnalysis(
        grossWpm,
        accuracy,
        mKeys,
        ePairs,
        bgMap,
        drillLabel ? "custom-drill" : currentMode
      );
    },
    [onTestComplete, triggerAIAnalysis]
  );

  // Real-time ticker for elapsed time & Timed mode auto-finish
  useEffect(() => {
    if (!typingState.isStarted || typingState.isFinished) return;

    const interval = window.setInterval(() => {
      const currentNow = Date.now();
      setNowMs(currentNow);

      const st = stateRef.current;
      if (
        !activeDrillLabel &&
        mode === TestMode.TIMED &&
        st.startTime !== null &&
        currentNow - st.startTime >= subOption * 1000
      ) {
        const cappedEnd = st.startTime + subOption * 1000;
        const finishedState: TypingState = {
          ...st,
          endTime: cappedEnd,
          isFinished: true,
        };
        setTypingState(finishedState);
        finalizeRun(finishedState, cappedEnd);
      }
    }, 100);

    return () => window.clearInterval(interval);
  }, [
    typingState.isStarted,
    typingState.isFinished,
    mode,
    subOption,
    activeDrillLabel,
    finalizeRun,
  ]);

  // Keep the active character aligned inside the typing viewport without animation lag
  useEffect(() => {
    const container = stageContainerRef.current;
    const activeEl = activeCharRef.current;
    if (!container || !activeEl) return;

    const containerRect = container.getBoundingClientRect();
    const charRect = activeEl.getBoundingClientRect();
    const relativeTop = charRect.top - containerRect.top;
    const lineHeight = charRect.height || 36;

    // Only scroll when the caret moves past the second line or above the top edge
    if (relativeTop > container.clientHeight - lineHeight * 1.4) {
      container.scrollTop += relativeTop - lineHeight;
    } else if (relativeTop < 0) {
      container.scrollTop += relativeTop;
    }
  }, [typingState.currentIndex]);

  const handleKeyStroke = useCallback(
    (key: string) => {
      const st = stateRef.current;
      if (st.isFinished) return;

      if (key === "Escape") {
        resetRun(
          activeDrillLabel ? st.targetText : undefined,
          activeDrillLabel
        );
        return;
      }

      if (key === "Backspace") {
        if (st.currentIndex === 0) return;
        playKeyClick(false, soundEnabled);
        setLastPressedKey(null);
        setLastPressedError(false);
        const backState: TypingState = {
          ...st,
          currentIndex: Math.max(0, st.currentIndex - 1),
          userInput: st.userInput.slice(0, -1),
        };
        stateRef.current = backState;
        setTypingState(backState);
        return;
      }

      if (key.length !== 1) return;

      const timestamp = Date.now();
      const startTime = st.isStarted ? st.startTime : timestamp;
      setNowMs(timestamp);

      const expectedChar = st.targetText[st.currentIndex];
      if (expectedChar === undefined) return;

      const isCorrect = key === expectedChar;
      playKeyClick(!isCorrect, soundEnabled);

      setLastPressedKey(key);
      setLastPressedError(!isCorrect);

      const normalizedExpected = expectedChar.toLowerCase();
      setKeyAttempts((prev) => ({
        ...prev,
        [normalizedExpected]: (prev[normalizedExpected] ?? 0) + 1,
      }));

      if (!isCorrect) {
        setMissedKeys((prev) => ({
          ...prev,
          [normalizedExpected]: (prev[normalizedExpected] ?? 0) + 1,
        }));

        if (st.currentIndex > 0) {
          const prevChar = st.targetText[st.currentIndex - 1];
          if (prevChar !== " " && expectedChar !== " ") {
            const bigram = `${prevChar.toLowerCase()}${normalizedExpected}`;
            setBigrams((prev) => ({
              ...prev,
              [bigram]: (prev[bigram] ?? 0) + 1,
            }));
          }
        }

        setErrorPairs((prev) => {
          const existingIdx = prev.findIndex(
            (p) => p.expected === expectedChar && p.actual === key
          );
          if (existingIdx >= 0) {
            const next = [...prev];
            next[existingIdx] = {
              ...next[existingIdx],
              count: next[existingIdx].count + 1,
            };
            return next.sort((a, b) => b.count - a.count);
          }
          return [...prev, { expected: expectedChar, actual: key, count: 1 }].sort(
            (a, b) => b.count - a.count
          );
        });
      }

      let nextTargetText = st.targetText;
      const nextIndex = st.currentIndex + 1;
      const nextInput = st.userInput + key;

      // In Timed mode, append more words seamlessly if typist nears end of buffer
      if (
        !activeDrillLabel &&
        mode === TestMode.TIMED &&
        nextTargetText.length - nextIndex < 60
      ) {
        nextTargetText = `${nextTargetText} ${generateTimedText()}`;
      }

      const reachedEndOfText = nextIndex >= nextTargetText.length;

      const nextState: TypingState = {
        targetText: nextTargetText,
        currentIndex: nextIndex,
        userInput: nextInput,
        startTime,
        endTime: reachedEndOfText ? timestamp : null,
        isStarted: true,
        isFinished: reachedEndOfText,
        errors: st.errors + (isCorrect ? 0 : 1),
        totalChars: st.totalChars + 1,
      };

      // Update ref synchronously so rapid bursts or multi-char inputs never read stale state
      stateRef.current = nextState;
      setTypingState(nextState);

      if (reachedEndOfText) {
        finalizeRun(nextState, timestamp);
      }
    },
    [activeDrillLabel, finalizeRun, mode, resetRun, soundEnabled]
  );

  // Global keydown listener only handles keys when the hidden input is not already focused
  useEffect(() => {
    const onWindowKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "Escape") {
        e.preventDefault();
        resetRun(
          activeDrillLabel ? stateRef.current.targetText : undefined,
          activeDrillLabel
        );
        return;
      }

      if (stateRef.current.isFinished) return;

      // Avoid double-handling when event originated on the hidden typing input
      if (e.target === inputRef.current) return;

      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (
        activeTag === "button" ||
        activeTag === "select" ||
        activeTag === "a" ||
        activeTag === "input" ||
        activeTag === "textarea"
      ) {
        return;
      }

      if (e.key === "Backspace" || e.key.length === 1) {
        e.preventDefault();
        inputRef.current?.focus({ preventScroll: true });
        handleKeyStroke(e.key);
      }
    };

    window.addEventListener("keydown", onWindowKeyDown);
    return () => window.removeEventListener("keydown", onWindowKeyDown);
  }, [activeDrillLabel, handleKeyStroke, resetRun]);

  // Derived real-time metrics
  const metrics = useMemo(() => {
    const start = typingState.startTime;
    const end = typingState.isFinished ? typingState.endTime ?? nowMs : nowMs;
    const elapsedMs = start ? Math.max(end - start, 250) : 0;
    const elapsedMinutes = elapsedMs / 60000;

    const charactersTyped = typingState.userInput.length;
    let correctCount = 0;
    for (let i = 0; i < charactersTyped; i++) {
      if (typingState.userInput[i] === typingState.targetText[i]) {
        correctCount++;
      }
    }
    const uncorrectedErrors = charactersTyped - correctCount;

    const wpm =
      typingState.isStarted && elapsedMinutes > 0
        ? Math.max(0, Math.round(charactersTyped / 5 / elapsedMinutes))
        : 0;
    const netWpm =
      typingState.isStarted && elapsedMinutes > 0
        ? Math.max(
            0,
            Math.round((correctCount / 5 - uncorrectedErrors) / elapsedMinutes)
          )
        : 0;
    const accuracy =
      typingState.totalChars > 0
        ? Math.max(
            0,
            Math.min(
              100,
              Math.round(
                ((typingState.totalChars - typingState.errors) /
                  typingState.totalChars) *
                  100
              )
            )
          )
        : 100;

    const remainingSeconds =
      !activeDrillLabel && mode === TestMode.TIMED
        ? Math.max(0, Math.ceil((subOption * 1000 - elapsedMs) / 1000))
        : Math.floor(elapsedMs / 1000);

    return {
      wpm,
      netWpm,
      accuracy,
      remainingSeconds,
      elapsedSeconds: Math.max(1, Math.round(elapsedMs / 1000)),
    };
  }, [typingState, nowMs, mode, subOption, activeDrillLabel]);

  // Group targetText into words with global character indices so lines wrap cleanly on word boundaries
  const wordTokens = useMemo(() => {
    const tokens: Array<{ chars: Array<{ char: string; idx: number }> }> = [];
    let currentWord: Array<{ char: string; idx: number }> = [];

    for (let i = 0; i < typingState.targetText.length; i++) {
      const ch = typingState.targetText[i];
      currentWord.push({ char: ch, idx: i });
      if (ch === " ") {
        tokens.push({ chars: currentWord });
        currentWord = [];
      }
    }
    if (currentWord.length > 0) {
      tokens.push({ chars: currentWord });
    }
    return tokens;
  }, [typingState.targetText]);

  const handleModeChange = (nextMode: TestMode) => {
    const defaultSub =
      nextMode === TestMode.TIMED ? 30 : nextMode === TestMode.WORDS ? 25 : 2;
    setMode(nextMode);
    setSubOption(defaultSub);
    modeRef.current = {
      mode: nextMode,
      subOption: defaultSub,
      activeDrillLabel: null,
    };
    resetRun(createTargetText(nextMode, defaultSub), null);
  };

  const handleSubOptionChange = (nextSub: number) => {
    setSubOption(nextSub);
    modeRef.current = { mode, subOption: nextSub, activeDrillLabel: null };
    resetRun(createTargetText(mode, nextSub), null);
  };

  const last10AvgWpm = useMemo(() => {
    const slice = history.slice(0, 10);
    if (slice.length === 0) return null;
    return Math.round(slice.reduce((sum, r) => sum + r.wpm, 0) / slice.length);
  }, [history]);

  const subOptionsList =
    mode === TestMode.TIMED
      ? TIMED_OPTIONS
      : mode === TestMode.WORDS
      ? WORD_OPTIONS
      : CODE_OPTIONS;

  const topMissedList = useMemo(
    () =>
      Object.entries(missedKeys)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6),
    [missedKeys]
  );

  const primaryWeakFinger = useMemo(() => {
    if (topMissedList.length === 0) return null;
    const counts: Record<string, number> = {};
    for (const [key, cnt] of Object.entries(missedKeys)) {
      const finger = getFingerForKey(key);
      counts[finger] = (counts[finger] ?? 0) + cnt;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? null;
  }, [missedKeys, topMissedList.length]);

  const completedWords = useMemo(() => {
    const typedSlice = typingState.userInput.trim();
    if (!typedSlice) return 0;
    return typedSlice.split(/\s+/).length;
  }, [typingState.userInput]);

  const totalTargetWords = useMemo(
    () => typingState.targetText.trim().split(/\s+/).length,
    [typingState.targetText]
  );

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-6">
      {/* Workspace Configuration Toolbar */}
      <div
        className="max-w-[960px] mx-auto flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-lg border"
        style={{
          backgroundColor: "var(--bg-surface)",
          borderColor: "var(--border-subtle)",
        }}
      >
        {/* Mode & Sub-option segmented controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div
            className="flex items-center p-1 rounded border"
            style={{
              backgroundColor: "var(--bg-recessed)",
              borderColor: "var(--border-subtle)",
            }}
            role="group"
            aria-label="Test mode"
          >
            {[
              { id: TestMode.TIMED, label: "Timed" },
              { id: TestMode.WORDS, label: "Words" },
              { id: TestMode.CODE, label: "Code" },
            ].map((item) => {
              const active = mode === item.id && !activeDrillLabel;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleModeChange(item.id)}
                  className="px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  style={{
                    backgroundColor: active
                      ? "var(--accent-primary-soft)"
                      : "transparent",
                    color: active
                      ? "var(--accent-primary)"
                      : "var(--text-secondary)",
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {!activeDrillLabel && (
            <div
              className="flex items-center p-1 rounded border"
              style={{
                backgroundColor: "var(--bg-recessed)",
                borderColor: "var(--border-subtle)",
              }}
              role="group"
              aria-label="Test length"
            >
              {subOptionsList.map((val) => {
                const active = subOption === val;
                const label =
                  mode === TestMode.TIMED
                    ? `${val}s`
                    : mode === TestMode.WORDS
                    ? `${val}`
                    : `${val}x`;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleSubOptionChange(val)}
                    className="px-2.5 py-1.5 font-mono-hud text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    style={{
                      backgroundColor: active
                        ? "var(--bg-surface-elevated)"
                        : "transparent",
                      color: active
                        ? "var(--text-primary)"
                        : "var(--text-secondary)",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {activeDrillLabel && (
            <div className="flex items-center gap-2 px-2">
              <span
                className="text-xs font-medium"
                style={{ color: "var(--accent-primary)" }}
              >
                Active Drill: {activeDrillLabel}
              </span>
              <button
                type="button"
                onClick={() => resetRun()}
                aria-label="Exit custom drill"
                className="inline-flex items-center gap-1 text-xs underline cursor-pointer"
                style={{ color: "var(--text-secondary)" }}
              >
                <X className="w-3.5 h-3.5" />
                <span>Exit</span>
              </button>
            </div>
          )}
        </div>

        {/* Utility controls: Theme, Sound, Keyboard */}
        <div className="flex items-center gap-2">
          <div
            className="flex items-center p-1 rounded border"
            style={{
              backgroundColor: "var(--bg-recessed)",
              borderColor: "var(--border-subtle)",
            }}
            role="group"
            aria-label="Color theme"
          >
            {[
              { id: ThemeId.CYBERPUNK, label: "HUD" },
              { id: ThemeId.LIGHT, label: "Light" },
              { id: ThemeId.TERMINAL, label: "CRT" },
            ].map((t) => {
              const active = theme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onChangeTheme(t.id)}
                  className="px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  style={{
                    backgroundColor: active
                      ? "var(--bg-surface-elevated)"
                      : "transparent",
                    color: active
                      ? "var(--text-primary)"
                      : "var(--text-secondary)",
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onToggleSound}
            aria-label={soundEnabled ? "Mute keystroke audio" : "Enable keystroke audio"}
            title={soundEnabled ? "Sound On" : "Sound Off"}
            className="p-2 rounded border transition-colors cursor-pointer"
            style={{
              backgroundColor: soundEnabled
                ? "var(--accent-primary-soft)"
                : "var(--bg-recessed)",
              borderColor: soundEnabled
                ? "var(--accent-primary)"
                : "var(--border-subtle)",
              color: soundEnabled
                ? "var(--accent-primary)"
                : "var(--text-secondary)",
            }}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4" />
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
          </button>

          <button
            type="button"
            onClick={onToggleKeyboard}
            aria-label={showKeyboard ? "Hide keyboard heatmap" : "Show keyboard heatmap"}
            title={showKeyboard ? "Hide Keyboard" : "Show Keyboard"}
            className="hidden md:inline-flex p-2 rounded border transition-colors cursor-pointer"
            style={{
              backgroundColor: showKeyboard
                ? "var(--accent-primary-soft)"
                : "var(--bg-recessed)",
              borderColor: showKeyboard
                ? "var(--accent-primary)"
                : "var(--border-subtle)",
              color: showKeyboard
                ? "var(--accent-primary)"
                : "var(--text-secondary)",
            }}
          >
            <Keyboard className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Live Telemetry Bar (Single-level container with hairline dividers) */}
      <div
        className="max-w-[960px] mx-auto grid grid-cols-2 sm:grid-cols-4 rounded-lg border divide-y sm:divide-y-0 sm:divide-x"
        style={{
          backgroundColor: "var(--bg-surface)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <div className="px-5 py-3.5" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            Live WPM
          </div>
          <div
            className="mt-1 font-mono-hud text-2xl sm:text-3xl font-bold"
            style={{ color: "var(--accent-primary)" }}
          >
            {metrics.wpm}
          </div>
        </div>

        <div className="px-5 py-3.5" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            Accuracy
          </div>
          <div
            className="mt-1 font-mono-hud text-2xl sm:text-3xl font-bold"
            style={{
              color:
                metrics.accuracy >= 95
                  ? "var(--status-success)"
                  : metrics.accuracy >= 85
                  ? "var(--text-primary)"
                  : "var(--status-error)",
            }}
          >
            {metrics.accuracy}%
          </div>
        </div>

        <div className="px-5 py-3.5" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            {!activeDrillLabel && mode === TestMode.TIMED ? "Time Remaining" : "Progress"}
          </div>
          <div
            className="mt-1 font-mono-hud text-2xl sm:text-3xl font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            {!activeDrillLabel && mode === TestMode.TIMED
              ? `${metrics.remainingSeconds}s`
              : `${completedWords}/${totalTargetWords}`}
          </div>
        </div>

        <div className="px-5 py-3.5" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            Errors · Net WPM
          </div>
          <div className="mt-1 font-mono-hud text-2xl sm:text-3xl font-bold flex items-baseline gap-2">
            <span
              style={{
                color:
                  typingState.errors > 0
                    ? "var(--status-error)"
                    : "var(--text-primary)",
              }}
            >
              {typingState.errors}
            </span>
            <span className="text-sm font-normal" style={{ color: "var(--text-muted)" }}>
              · {metrics.netWpm} net
            </span>
          </div>
        </div>
      </div>

      {/* Main Typing Stage or Post-Test Diagnostic & AI Drill View */}
      {!typingState.isFinished ? (
        <section
          aria-label="Typing arena"
          onClick={() => inputRef.current?.focus({ preventScroll: true })}
          className="max-w-[960px] mx-auto relative rounded-lg border p-6 sm:p-8 cursor-text transition-shadow duration-150"
          style={{
            backgroundColor: "var(--bg-surface)",
            borderColor: isFocused
              ? "var(--accent-primary)"
              : "var(--border-subtle)",
            boxShadow: isFocused
              ? "0 0 24px var(--accent-primary-glow)"
              : "none",
          }}
        >
          {/* Accessible hidden input for physical & mobile keyboards */}
          <input
            ref={inputRef}
            type="text"
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-label="Typing test input"
            value=""
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onChange={(e) => {
              const val = e.target.value;
              if (val.length > 0) {
                for (const ch of val) {
                  handleKeyStroke(ch);
                }
              }
            }}
            onKeyDown={(e) => {
              if (e.metaKey || e.ctrlKey || e.altKey) return;
              if (e.key === "Backspace" || e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                handleKeyStroke(e.key);
              } else if (e.key.length === 1) {
                e.preventDefault();
                e.stopPropagation();
                handleKeyStroke(e.key);
              }
            }}
            className="absolute top-0 left-0 w-px h-px opacity-0 pointer-events-none"
          />

          <div
            ref={stageContainerRef}
            className="h-[168px] sm:h-[180px] overflow-y-auto pr-2 select-none font-mono-hud text-xl sm:text-2xl leading-[1.7] tracking-[0.02em]"
          >
            <div className="flex flex-wrap gap-y-1">
              {wordTokens.map((word, wIdx) => (
                <span key={wIdx} className="inline-flex whitespace-nowrap">
                  {word.chars.map(({ char, idx }) => {
                    const isTyped = idx < typingState.currentIndex;
                    const isCurrent = idx === typingState.currentIndex;
                    const typedChar = typingState.userInput[idx];
                    const isCorrect = isTyped && typedChar === char;
                    const isError = isTyped && typedChar !== char;

                    let color = "var(--text-secondary)";
                    let opacity = 0.55;
                    let bg = "transparent";

                    if (isCorrect) {
                      color = "var(--status-success)";
                      opacity = 1;
                    } else if (isError) {
                      color = "var(--status-error)";
                      opacity = 1;
                      if (char === " ") {
                        bg = "var(--status-error-soft)";
                      }
                    } else if (isCurrent) {
                      color = "var(--text-primary)";
                      opacity = 1;
                    }

                    return (
                      <span
                        key={idx}
                        ref={isCurrent ? activeCharRef : null}
                        className="relative inline-block rounded-[2px]"
                        style={{
                          color,
                          opacity,
                          backgroundColor: bg,
                          width: char === " " ? "1ch" : undefined,
                          textDecoration: isError && char !== " " ? "underline" : "none",
                          textDecorationColor: isError ? "var(--status-error)" : undefined,
                          textUnderlineOffset: "5px",
                        }}
                      >
                        {isCurrent && (
                          <span
                            aria-hidden="true"
                            className={`absolute -left-[1px] top-[3px] bottom-[3px] w-[2px] ${
                              typingState.isStarted ? "" : "typing-caret"
                            }`}
                            style={{ backgroundColor: "var(--accent-primary)" }}
                          />
                        )}
                        {char === " " ? "\u00A0" : char}
                      </span>
                    );
                  })}
                </span>
              ))}
            </div>
          </div>

          <div
            className="mt-5 pt-4 border-t flex items-center justify-between gap-4 text-xs"
            style={{
              borderColor: "var(--border-subtle)",
              color: "var(--text-muted)",
            }}
          >
            <span>
              {typingState.isStarted
                ? "Press Esc anytime to restart"
                : isFocused
                ? "Start typing to begin timer · Esc to reset"
                : "Click inside the box or start typing to focus"}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                resetRun(
                  activeDrillLabel ? typingState.targetText : undefined,
                  activeDrillLabel
                );
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border transition-colors cursor-pointer whitespace-nowrap shrink-0"
              style={{
                borderColor: "var(--border-subtle)",
                color: "var(--text-secondary)",
              }}
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Restart</span>
            </button>
          </div>
        </section>
      ) : (
        /* Post-Test Summary & Seamless Gemini AI Drill Section */
        <section
          aria-label="Test results and AI drill"
          className="max-w-[960px] mx-auto space-y-6"
        >
          <div
            className="rounded-lg border p-6 sm:p-8 space-y-6"
            style={{
              backgroundColor: "var(--bg-surface)",
              borderColor: "var(--border-subtle)",
            }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5" style={{ borderColor: "var(--border-subtle)" }}>
              <div>
                <h2
                  className="text-xl sm:text-2xl font-bold tracking-tight"
                  style={{ color: "var(--text-primary)" }}
                >
                  Run Complete
                </h2>
                <div
                  className="mt-1 flex flex-wrap items-center gap-2 text-xs font-mono-hud"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <span>
                    {activeDrillLabel
                      ? activeDrillLabel
                      : mode === TestMode.TIMED
                      ? `Timed ${subOption}s`
                      : mode === TestMode.WORDS
                      ? `${subOption} Words`
                      : `Code ${subOption}x`}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{metrics.elapsedSeconds}s elapsed</span>
                  {last10AvgWpm !== null && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>Last 10 avg: {last10AvgWpm} WPM</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => resetRun()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded border cursor-pointer whitespace-nowrap shrink-0"
                  style={{
                    borderColor: "var(--border-strong)",
                    color: "var(--text-primary)",
                  }}
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>New Run</span>
                </button>
              </div>
            </div>

            {/* Keystroke Diagnostic Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3
                  className="text-sm font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  Weak Keys & Error Pairs
                </h3>
                {errorPairs.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--status-success)" }}>
                    Zero keystroke errors recorded during this run.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {errorPairs.slice(0, 5).map((pair, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between px-3 py-2 rounded border text-xs font-mono-hud"
                        style={{
                          backgroundColor: "var(--bg-recessed)",
                          borderColor: "var(--border-subtle)",
                        }}
                      >
                        <span style={{ color: "var(--text-primary)" }}>
                          Expected{" "}
                          <strong style={{ color: "var(--status-success)" }}>
                            {pair.expected === " " ? "SPACE" : pair.expected}
                          </strong>{" "}
                          → Typed{" "}
                          <strong style={{ color: "var(--status-error)" }}>
                            {pair.actual === " " ? "SPACE" : pair.actual}
                          </strong>
                        </span>
                        <span style={{ color: "var(--text-secondary)" }}>
                          {pair.count}x
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h3
                  className="text-sm font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  Ergonomic Telemetry
                </h3>
                <div
                  className="p-4 rounded border space-y-2.5 text-sm"
                  style={{
                    backgroundColor: "var(--bg-recessed)",
                    borderColor: "var(--border-subtle)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span style={{ color: "var(--text-secondary)" }}>
                      Total Keystrokes
                    </span>
                    <span
                      className="font-mono-hud font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {typingState.totalChars}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: "var(--text-secondary)" }}>
                      Slowest / Most Missed Finger
                    </span>
                    <span
                      className="font-mono-hud font-semibold"
                      style={{
                        color: primaryWeakFinger
                          ? "var(--status-error)"
                          : "var(--status-success)",
                      }}
                    >
                      {primaryWeakFinger
                        ? `${primaryWeakFinger[0]} (${primaryWeakFinger[1]})`
                        : "Balanced"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: "var(--text-secondary)" }}>
                      Problem Bigrams
                    </span>
                    <span
                      className="font-mono-hud font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {Object.keys(bigrams).length > 0
                        ? Object.entries(bigrams)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 3)
                            .map(([b, c]) => `${b} (${c})`)
                            .join(", ")
                        : "None"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Gemini AI Custom Practice Drill */}
            <div
              className="pt-6 border-t space-y-4"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Sparkles
                    className="w-4 h-4"
                    style={{ color: "var(--accent-primary)" }}
                    aria-hidden="true"
                  />
                  <h3
                    className="text-base font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Gemini Custom Error Drill
                  </h3>
                </div>

                {!aiLoading && (
                  <button
                    type="button"
                    onClick={() =>
                      triggerAIAnalysis(
                        metrics.wpm,
                        metrics.accuracy,
                        missedKeys,
                        errorPairs,
                        bigrams,
                        activeDrillLabel ? "custom-drill" : mode
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border cursor-pointer whitespace-nowrap shrink-0"
                    style={{
                      borderColor: "var(--border-subtle)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Regenerate</span>
                  </button>
                )}
              </div>

              {aiLoading && (
                <div
                  className="p-5 rounded border space-y-3 animate-pulse"
                  style={{
                    backgroundColor: "var(--bg-recessed)",
                    borderColor: "var(--border-subtle)",
                  }}
                >
                  <div
                    className="h-4 w-2/3 rounded"
                    style={{ backgroundColor: "var(--bg-surface-elevated)" }}
                  />
                  <div
                    className="h-4 w-full rounded"
                    style={{ backgroundColor: "var(--bg-surface-elevated)" }}
                  />
                  <div
                    className="h-4 w-5/6 rounded"
                    style={{ backgroundColor: "var(--bg-surface-elevated)" }}
                  />
                </div>
              )}

              {aiError && !aiLoading && (
                <div
                  role="alert"
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded border"
                  style={{
                    backgroundColor: "var(--status-error-soft)",
                    borderColor: "var(--status-error)",
                  }}
                >
                  <div className="flex items-center gap-2.5 text-sm">
                    <AlertCircle
                      className="w-4 h-4 shrink-0"
                      style={{ color: "var(--status-error)" }}
                    />
                    <span style={{ color: "var(--text-primary)" }}>{aiError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      triggerAIAnalysis(
                        metrics.wpm,
                        metrics.accuracy,
                        missedKeys,
                        errorPairs,
                        bigrams,
                        activeDrillLabel ? "custom-drill" : mode
                      )
                    }
                    className="px-3 py-1.5 text-xs font-semibold rounded border whitespace-nowrap shrink-0 cursor-pointer"
                    style={{
                      borderColor: "var(--border-strong)",
                      color: "var(--text-primary)",
                    }}
                  >
                    Retry Analysis
                  </button>
                </div>
              )}

              {aiDrill && !aiLoading && (
                <div className="space-y-4">
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    {aiDrill.focusSummary}
                  </p>

                  <blockquote
                    className="p-5 rounded border font-mono-hud text-base leading-relaxed"
                    style={{
                      backgroundColor: "var(--bg-recessed)",
                      borderColor: "var(--accent-primary)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {aiDrill.drillParagraph}
                  </blockquote>

                  {aiDrill.coachingTips.length > 0 && (
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {aiDrill.coachingTips.map((tip, idx) => (
                        <li
                          key={idx}
                          className="p-3 rounded border"
                          style={{
                            backgroundColor: "var(--bg-recessed)",
                            borderColor: "var(--border-subtle)",
                            color: "var(--text-secondary)",
                          }}
                        >
                          {tip}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                    <div
                      className="text-xs font-mono-hud"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {aiDrill.weakKeysTargeted.length > 0
                        ? `Drilling: ${aiDrill.weakKeysTargeted.join(" · ")}`
                        : "Balanced cadence drill"}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        resetRun(aiDrill.drillParagraph, "Gemini Error Drill")
                      }
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded cursor-pointer whitespace-nowrap shrink-0"
                      style={{
                        backgroundColor: "var(--accent-primary)",
                        color: "var(--accent-primary-fg)",
                      }}
                    >
                      <Play className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Start Drill</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Keyboard Heatmap (Visible during active typing when enabled) */}
      {showKeyboard && !typingState.isFinished && (
        <KeyboardHeatmap
          nextChar={typingState.targetText[typingState.currentIndex] ?? ""}
          lastPressedKey={lastPressedKey}
          lastPressedError={lastPressedError}
          missedKeys={missedKeys}
          keyAttempts={keyAttempts}
        />
      )}
    </div>
  );
};
