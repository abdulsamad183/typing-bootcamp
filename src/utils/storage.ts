import { Achievement, SavedDrill, TestMode, TestResult, ThemeId } from "../types/typing";

const HISTORY_KEY = "typerush_history_v1";
const DRILLS_KEY = "typerush_drills_v1";
const PREFS_KEY = "typerush_prefs_v1";

export interface UserPreferences {
  theme: ThemeId;
  soundEnabled: boolean;
  showKeyboard: boolean;
}

const DEFAULT_PREFS: UserPreferences = {
  theme: ThemeId.CYBERPUNK,
  soundEnabled: false,
  showKeyboard: true,
};

export function loadPreferences(): UserPreferences {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    return {
      theme: parsed.theme ?? DEFAULT_PREFS.theme,
      soundEnabled: parsed.soundEnabled ?? DEFAULT_PREFS.soundEnabled,
      showKeyboard: parsed.showKeyboard ?? DEFAULT_PREFS.showKeyboard,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePreferences(prefs: UserPreferences): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadTestHistory(): TestResult[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TestResult[]) : [];
  } catch {
    return [];
  }
}

export function saveTestResult(result: TestResult): TestResult[] {
  const existing = loadTestHistory();
  const updated = [result, ...existing].slice(0, 100);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage quota errors
  }
  return updated;
}

export function deleteTestResult(id: string): TestResult[] {
  const updated = loadTestHistory().filter((item) => item.id !== id);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // Ignore
  }
  return updated;
}

export function clearTestHistory(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // Ignore
  }
}

export function loadSavedDrills(): SavedDrill[] {
  try {
    const raw = localStorage.getItem(DRILLS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedDrill[]) : [];
  } catch {
    return [];
  }
}

export function saveDrill(drill: SavedDrill): SavedDrill[] {
  const existing = loadSavedDrills();
  const updated = [drill, ...existing].slice(0, 20);
  try {
    localStorage.setItem(DRILLS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore
  }
  return updated;
}

export function deleteSavedDrill(id: string): SavedDrill[] {
  const updated = loadSavedDrills().filter((item) => item.id !== id);
  try {
    localStorage.setItem(DRILLS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore
  }
  return updated;
}

export function computeAchievements(history: TestResult[]): Achievement[] {
  const totalRuns = history.length;
  const bestWpm = history.reduce((max, r) => Math.max(max, r.wpm), 0);
  const bestAcc = history.reduce((max, r) => Math.max(max, r.accuracy), 0);
  const customDrillRuns = history.filter((r) => r.isCustomDrill).length;
  const codeRuns = history.filter((r) => r.mode === TestMode.CODE).length;
  const highAccuracyRuns = history.filter((r) => r.accuracy >= 98).length;

  return [
    {
      id: "first_run",
      title: "First Telemetry",
      description: "Complete your first typing run.",
      unlocked: totalRuns >= 1,
      progressLabel: `${Math.min(totalRuns, 1)}/1 run`,
    },
    {
      id: "speed_60",
      title: "Cruising Velocity",
      description: "Reach 60 WPM in any test mode.",
      unlocked: bestWpm >= 60,
      progressLabel: `${Math.min(bestWpm, 60)}/60 WPM`,
    },
    {
      id: "speed_90",
      title: "Flow State",
      description: "Break 90 WPM on a completed test.",
      unlocked: bestWpm >= 90,
      progressLabel: `${Math.min(bestWpm, 90)}/90 WPM`,
    },
    {
      id: "precision_98",
      title: "Zero Drift",
      description: "Finish 3 tests with 98%+ accuracy.",
      unlocked: highAccuracyRuns >= 3,
      progressLabel: `${Math.min(highAccuracyRuns, 3)}/3 runs`,
    },
    {
      id: "code_runner",
      title: "Syntax Specialist",
      description: "Complete a Code & Symbols test.",
      unlocked: codeRuns >= 1,
      progressLabel: `${Math.min(codeRuns, 1)}/1 run`,
    },
    {
      id: "ai_driller",
      title: "Targeted Mastery",
      description: "Complete an AI-generated custom drill.",
      unlocked: customDrillRuns >= 1,
      progressLabel: `${Math.min(customDrillRuns, 1)}/1 drill`,
    },
  ];
}
