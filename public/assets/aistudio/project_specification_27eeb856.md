# TypeRush – Project Specification & Architecture

## 1. Executive Summary
**TypeRush** is a feature-rich, modern web application designed to test, analyze, and improve typing speed (WPM) and accuracy. Going beyond traditional typing tests, TypeRush integrates generative AI capabilities (via Google AI Studio / Gemini API) to analyze user typing patterns, detect persistent error keys, and generate personalized practice drills and exercises.

## 2. Target Audience & Core Value Proposition
* **Audience:** Students, professionals, developers, and competitive typists looking to improve keyboard efficiency and ergonomics.
* **Value Proposition:** Combines sleek, gamified typing tests with actionable AI-driven insights to accelerate skill development.

## 3. Key Features & Functional Requirements
1. **Typing Test Engine:**
   * Real-time calculation of Words Per Minute (WPM), Net WPM, Accuracy %, and Character Count.
   * Multiple test modes: Timed (15s, 30s, 60s, 120s), Word Count (10, 25, 50, 100), and Code/Symbol mode.
   * Visual feedback highlighting correct (green), incorrect (red), and upcoming characters.
2. **AI Suggestions & Analytics Dashboard:**
   * Post-test performance breakdown identifying weak fingers, problem keys (e.g., frequently mistyped combinations like "th", "ion"), and rhythm inconsistencies.
   * AI-generated custom practice paragraphs tailored to target weak areas.
3. **User Profiles & History:**
   * Local storage / cloud persistence of past test results, WPM progression charts over time, and achievement badges.
4. **Customization & Themes:**
   * Dark mode, cyberpunk, minimal light, and retro terminal color palettes. Sound effects for mechanical keyboard clicks (optional toggle).

## 4. Tech Stack & Architecture
* **Frontend UI / Wireframe Generation:** Google Stitch (for UI design system, layout, and visual components).
* **Core Development & AI Integration:** Google AI Studio (Gemini API for real-time text generation, drill creation, and performance diagnostics).
* **Framework:** React / Vite (Single Page Application) with Tailwind CSS for styling and Lucide React for icons.