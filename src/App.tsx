import { useCallback, useEffect, useState } from "react";
import { AppView, SavedDrill, TestResult, ThemeId } from "./types/typing";
import {
  clearTestHistory,
  deleteSavedDrill,
  deleteTestResult,
  loadPreferences,
  loadSavedDrills,
  loadTestHistory,
  saveDrill,
  savePreferences,
  saveTestResult,
} from "./utils/storage";
import { Header } from "./components/Header";
import { TypingArena } from "./components/TypingArena";
import { AnalyticsDashboard } from "./components/AnalyticsDashboard";
import { DrillsView } from "./components/DrillsView";

export default function App() {
  const [activeView, setActiveView] = useState<AppView>(AppView.ARENA);
  const [prefs, setPrefs] = useState(() => loadPreferences());
  const [history, setHistory] = useState<TestResult[]>(() => loadTestHistory());
  const [savedDrills, setSavedDrills] = useState<SavedDrill[]>(() =>
    loadSavedDrills()
  );
  const [externalDrill, setExternalDrill] = useState<{
    text: string;
    label: string;
    nonce: number;
  } | null>(null);
  const [restartSignal, setRestartSignal] = useState<number>(0);

  // Sync theme attribute on root element
  useEffect(() => {
    const root = document.documentElement;
    if (prefs.theme === ThemeId.LIGHT) {
      root.setAttribute("data-theme", "light");
      root.classList.remove("dark");
    } else if (prefs.theme === ThemeId.TERMINAL) {
      root.setAttribute("data-theme", "terminal");
      root.classList.add("dark");
    } else {
      root.removeAttribute("data-theme");
      root.classList.add("dark");
    }
    savePreferences(prefs);
  }, [prefs]);

  const handleThemeChange = (theme: ThemeId) => {
    setPrefs((prev) => ({ ...prev, theme }));
  };

  const handleToggleSound = () => {
    setPrefs((prev) => ({ ...prev, soundEnabled: !prev.soundEnabled }));
  };

  const handleToggleKeyboard = () => {
    setPrefs((prev) => ({ ...prev, showKeyboard: !prev.showKeyboard }));
  };

  const handleTestComplete = useCallback((result: TestResult) => {
    const updated = saveTestResult(result);
    setHistory(updated);
  }, []);

  const handleSaveDrill = useCallback((drill: SavedDrill) => {
    const updated = saveDrill(drill);
    setSavedDrills(updated);
  }, []);

  const handleDeleteDrill = (id: string) => {
    setSavedDrills(deleteSavedDrill(id));
  };

  const handleDeleteResult = (id: string) => {
    setHistory(deleteTestResult(id));
  };

  const handleClearHistory = () => {
    clearTestHistory();
    setHistory([]);
  };

  const handleStartSavedDrill = (text: string, label = "Custom AI Drill") => {
    setExternalDrill({ text, label, nonce: Date.now() });
    setActiveView(AppView.ARENA);
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        backgroundColor: "var(--bg-canvas)",
        color: "var(--text-primary)",
      }}
    >
      <Header
        activeView={activeView}
        onChangeView={setActiveView}
        onRestartTest={() => setRestartSignal((s) => s + 1)}
      />

      <main className="flex-1">
        {activeView === AppView.ARENA && (
          <TypingArena
            theme={prefs.theme}
            onChangeTheme={handleThemeChange}
            soundEnabled={prefs.soundEnabled}
            onToggleSound={handleToggleSound}
            showKeyboard={prefs.showKeyboard}
            onToggleKeyboard={handleToggleKeyboard}
            history={history}
            onTestComplete={handleTestComplete}
            onSaveDrill={handleSaveDrill}
            externalDrill={externalDrill}
            onClearExternalDrill={() => setExternalDrill(null)}
            restartSignal={restartSignal}
          />
        )}

        {activeView === AppView.ANALYTICS && (
          <AnalyticsDashboard
            history={history}
            onDeleteResult={handleDeleteResult}
            onClearHistory={handleClearHistory}
            onGoToArena={() => setActiveView(AppView.ARENA)}
          />
        )}

        {activeView === AppView.DRILLS && (
          <DrillsView
            savedDrills={savedDrills}
            history={history}
            onStartDrill={handleStartSavedDrill}
            onSaveDrill={handleSaveDrill}
            onDeleteDrill={handleDeleteDrill}
          />
        )}
      </main>
    </div>
  );
}
