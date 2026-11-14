export enum TestMode {
  TIMED = "timed",
  WORDS = "words",
  CODE = "code",
}

export enum ThemeId {
  CYBERPUNK = "cyberpunk",
  LIGHT = "light",
  TERMINAL = "terminal",
}

export enum AppView {
  ARENA = "arena",
  ANALYTICS = "analytics",
  DRILLS = "drills",
}

export interface ErrorPair {
  expected: string;
  actual: string;
  count: number;
}

export interface KeystrokeTelemetry {
  missedKeys: Record<string, number>;
  keyAttempts: Record<string, number>;
  bigrams: Record<string, number>;
  errorPairs: ErrorPair[];
}

export interface TypingState {
  targetText: string;
  currentIndex: number;
  userInput: string;
  startTime: number | null;
  endTime: number | null;
  isStarted: boolean;
  isFinished: boolean;
  errors: number;
  totalChars: number;
}

export interface AIDrillResponse {
  drillParagraph: string;
  focusSummary: string;
  weakKeysTargeted: string[];
  coachingTips: string[];
}

export interface SavedDrill {
  id: string;
  createdAt: number;
  sourceWpm: number;
  sourceAccuracy: number;
  drill: AIDrillResponse;
}

export interface TestResult {
  id: string;
  timestamp: number;
  wpm: number;
  netWpm: number;
  accuracy: number;
  mode: TestMode;
  subOption: number; // seconds for timed, word count for words/code
  durationSeconds: number;
  totalChars: number;
  errors: number;
  missedKeys: Record<string, number>;
  bigrams: Record<string, number>;
  isCustomDrill: boolean;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  progressLabel: string;
}
