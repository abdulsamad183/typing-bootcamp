export const PROSE_PASSAGES: string[] = [
  "Software architecture rewards engineers who keep interfaces clean, state transitions predictable, and feedback loops tight. When every keystroke flows without hesitation, complex abstractions turn into muscle memory and deep concentration feels effortless.",
  "Precision typing is less about frantic speed and more about eliminating micro-pauses between unfamiliar letter combinations. Steady rhythm across home-row anchors lets your eyes read two words ahead while your fingers execute cleanly.",
  "Modern telemetry systems capture thousands of events every second so operators can spot subtle drift before latency spikes appear. Reading clean dashboards under pressure requires calm focus and disciplined visual hierarchy.",
  "Great tools stay quiet until the moment you need diagnostic clarity. By surfacing exact bottlenecks rather than noisy vanity numbers, intentional software helps practitioners refine craft one deliberate repetition at a time.",
  "Ergonomic posture keeps wrists neutral, shoulders relaxed, and fingers curved lightly above the home keys. Developing consistent reach patterns for punctuation and upper-row characters protects both long-term comfort and peak velocity.",
];

export const COMMON_WORDS: string[] = [
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "it",
  "for", "not", "on", "with", "he", "as", "you", "do", "at", "this",
  "but", "his", "by", "from", "they", "we", "say", "her", "she", "or",
  "an", "will", "my", "one", "all", "would", "there", "their", "what", "so",
  "up", "out", "if", "about", "who", "get", "which", "go", "me", "when",
  "make", "can", "like", "time", "no", "just", "him", "know", "take", "people",
  "into", "year", "your", "good", "some", "could", "them", "see", "other", "than",
  "then", "now", "look", "only", "come", "its", "over", "think", "also", "back",
  "after", "use", "two", "how", "our", "work", "first", "well", "way", "even",
  "new", "want", "because", "any", "these", "give", "day", "most", "us", "code",
  "system", "data", "build", "track", "speed", "focus", "flow", "craft", "sharp",
  "clean", "scale", "logic", "state", "input", "pulse", "frame", "model", "query",
  "token", "value", "index", "layer", "graph", "shift", "enter", "space", "rapid",
  "quiet", "clear", "drift", "route", "stack", "array", "parse", "async", "yield",
];

export const CODE_SNIPPETS: string[] = [
  "const calculateNetWpm = (chars: number, errors: number, ms: number): number => { const mins = Math.max(ms / 60000, 0.01); return Math.max(0, Math.round(((chars / 5) - errors) / mins)); };",
  "async function fetchTelemetry(endpoint: string, signal?: AbortSignal): Promise<Record<string, number>> { const res = await fetch(endpoint, { signal }); if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); }",
  "const groupErrorsByKey = (events: Array<{ key: string; ok: boolean }>) => events.reduce<Record<string, number>>((acc, item) => { if (!item.ok) acc[item.key] = (acc[item.key] ?? 0) + 1; return acc; }, {});",
  "export function debounce<T extends (...args: unknown[]) => void>(fn: T, waitMs: number) { let timer: ReturnType<typeof setTimeout>; return (...args: Parameters<T>) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), waitMs); }; }",
  "SELECT user_id, ROUND(AVG(wpm), 1) AS avg_wpm, MAX(accuracy) AS peak_acc FROM typing_runs WHERE created_at >= NOW() - INTERVAL '30 days' GROUP BY user_id ORDER BY avg_wpm DESC LIMIT 10;",
];

export function generateWordStream(wordCount: number): string {
  const result: string[] = [];
  let prev = "";
  for (let i = 0; i < wordCount; i++) {
    let pick = COMMON_WORDS[Math.floor(Math.random() * COMMON_WORDS.length)];
    if (pick === prev) {
      pick = COMMON_WORDS[(COMMON_WORDS.indexOf(pick) + 7) % COMMON_WORDS.length];
    }
    prev = pick;
    result.push(pick);
  }
  return result.join(" ");
}

export function generateTimedText(): string {
  const shuffled = [...PROSE_PASSAGES].sort(() => Math.random() - 0.5);
  return `${shuffled[0]} ${shuffled[1]}`;
}

export function generateCodeText(snippetCount = 2): string {
  const shuffled = [...CODE_SNIPPETS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, snippetCount).join(" ");
}

export const KEYBOARD_ROWS: string[][] = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "[", "]"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";", "'"],
  ["z", "x", "c", "v", "b", "n", "m", ",", ".", "/"],
];

export type FingerName =
  | "Left Pinky"
  | "Left Ring"
  | "Left Middle"
  | "Left Index"
  | "Thumb"
  | "Right Index"
  | "Right Middle"
  | "Right Ring"
  | "Right Pinky";

const KEY_TO_FINGER: Record<string, FingerName> = {
  "1": "Left Pinky", q: "Left Pinky", a: "Left Pinky", z: "Left Pinky", "`": "Left Pinky",
  "2": "Left Ring", w: "Left Ring", s: "Left Ring", x: "Left Ring",
  "3": "Left Middle", e: "Left Middle", d: "Left Middle", c: "Left Middle",
  "4": "Left Index", "5": "Left Index", r: "Left Index", t: "Left Index", f: "Left Index", g: "Left Index", v: "Left Index", b: "Left Index",
  " ": "Thumb",
  "6": "Right Index", "7": "Right Index", y: "Right Index", u: "Right Index", h: "Right Index", j: "Right Index", n: "Right Index", m: "Right Index",
  "8": "Right Middle", i: "Right Middle", k: "Right Middle", ",": "Right Middle", "<": "Right Middle",
  "9": "Right Ring", o: "Right Ring", l: "Right Ring", ".": "Right Ring", ">": "Right Ring",
  "0": "Right Pinky", "-": "Right Pinky", "=": "Right Pinky", p: "Right Pinky", "[": "Right Pinky", "]": "Right Pinky", ";": "Right Pinky", "'": "Right Pinky", "/": "Right Pinky", "?": "Right Pinky", ":": "Right Pinky", "\"": "Right Pinky", "{": "Right Pinky", "}": "Right Pinky", "(": "Right Ring", ")": "Right Pinky", "_": "Right Pinky", "+": "Right Pinky",
};

export function getFingerForKey(char: string): FingerName {
  const lower = char.toLowerCase();
  return KEY_TO_FINGER[lower] ?? "Right Pinky";
}

export const ALL_FINGERS: FingerName[] = [
  "Left Pinky",
  "Left Ring",
  "Left Middle",
  "Left Index",
  "Thumb",
  "Right Index",
  "Right Middle",
  "Right Ring",
  "Right Pinky",
];
