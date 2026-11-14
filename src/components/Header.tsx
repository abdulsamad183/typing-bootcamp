import React from "react";
import { RotateCcw } from "lucide-react";
import { AppView } from "../types/typing";

interface HeaderProps {
  activeView: AppView;
  onChangeView: (view: AppView) => void;
  onRestartTest: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeView,
  onChangeView,
  onRestartTest,
}) => {
  const navItems: Array<{ id: AppView; label: string }> = [
    { id: AppView.ARENA, label: "Arena" },
    { id: AppView.ANALYTICS, label: "Analytics" },
    { id: AppView.DRILLS, label: "AI Coach" },
  ];

  return (
    <header
      className="w-full border-b"
      style={{
        borderColor: "var(--border-subtle)",
        backgroundColor: "var(--bg-canvas)",
      }}
    >
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => onChangeView(AppView.ARENA)}
          className="text-xl font-bold tracking-tight whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4"
          style={{
            color: "var(--text-primary)",
            outlineColor: "var(--accent-primary)",
          }}
        >
          TypeRush
        </button>

        {/* Zone 2: Concise single-line nav links */}
        <nav
          aria-label="Primary navigation"
          className="flex items-center gap-6 sm:gap-8"
        >
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChangeView(item.id)}
                className="relative py-2 text-sm font-medium whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4"
                style={{
                  color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                  outlineColor: "var(--accent-primary)",
                }}
              >
                {item.label}
                {isActive && (
                  <span
                    className="absolute left-0 right-0 -bottom-[1px] h-[2px]"
                    style={{ backgroundColor: "var(--accent-primary)" }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => {
              onChangeView(AppView.ARENA);
              onRestartTest();
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{
              backgroundColor: "var(--accent-primary)",
              color: "var(--accent-primary-fg)",
              outlineColor: "var(--accent-primary)",
            }}
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>New Test</span>
          </button>
        </div>
      </div>
    </header>
  );
};
