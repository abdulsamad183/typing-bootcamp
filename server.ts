import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === "production";

interface AnalyzeDrillBody {
  missedKeys?: Record<string, number>;
  errorPairs?: Array<{ expected: string; actual: string; count: number }>;
  bigrams?: Record<string, number>;
  wpm?: number;
  accuracy?: number;
  mode?: string;
}

function createGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in the server environment.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

async function generateWithRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      const isRetryable =
        message.includes("429") ||
        message.includes("503") ||
        message.includes("UNAVAILABLE") ||
        message.includes("ECONNRESET");
      if (!isRetryable || attempt === maxRetries) {
        break;
      }
      const delayMs = 400 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "256kb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/api/ai/analyze-drill", async (req, res) => {
    try {
      const body = (req.body || {}) as AnalyzeDrillBody;
      const missedKeys = body.missedKeys ?? {};
      const errorPairs = body.errorPairs ?? [];
      const bigrams = body.bigrams ?? {};
      const wpm = typeof body.wpm === "number" ? body.wpm : 0;
      const accuracy = typeof body.accuracy === "number" ? body.accuracy : 100;
      const mode = typeof body.mode === "string" ? body.mode : "timed";

      const telemetryPayload = {
        wpm,
        accuracy,
        mode,
        missedKeys,
        topErrorPairs: errorPairs.slice(0, 12),
        weakBigrams: bigrams,
      };

      const hasErrors =
        Object.keys(missedKeys).length > 0 ||
        errorPairs.length > 0 ||
        Object.keys(bigrams).length > 0;

      const prompt = hasErrors
        ? `Analyze these typing errors and weak key combinations: ${JSON.stringify(
            telemetryPayload
          )}. Generate a short, 3-sentence custom practice paragraph specifically designed to drill these weak keys and transitions cleanly in natural English (or clean code-adjacent prose if mode is code, avoiding exotic unicode symbols). Keep sentences crisp, engaging, and strictly 3 sentences total.`
        : `The user completed a ${mode} typing run at ${wpm} WPM with ${accuracy}% accuracy and zero errors. Generate a short, 3-sentence custom speed-and-rhythm progression practice paragraph focusing on fluid alternating-hand transitions, common English bigrams (th, er, on, an, in), and steady cadence. Keep it strictly 3 sentences total.`;

      const ai = createGeminiClient();

      const response = await generateWithRetry(() =>
        ai.models.generateContent({
          model: "gemini-4-hydrogen",
          contents: prompt,
          config: {
            systemInstruction:
              "You are a precision typing ergonomics and speed coach. Return structured JSON only. The drillParagraph must contain exactly 3 clear, typable sentences using standard ASCII characters (letters, spaces, commas, periods, apostrophes, and basic punctuation only). Never include markdown formatting or bullet points inside drillParagraph.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                drillParagraph: {
                  type: Type.STRING,
                  description:
                    "Exactly 3 well-formed sentences targeting the weak keys and bigrams, using standard ASCII punctuation.",
                },
                focusSummary: {
                  type: Type.STRING,
                  description:
                    "1-2 concise sentences summarizing the primary error pattern or rhythm bottleneck observed.",
                },
                weakKeysTargeted: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description:
                    "Up to 6 specific keys or 2-character bigrams targeted by this drill.",
                },
                coachingTips: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description:
                    "2 to 3 actionable finger placement or cadence tips tailored to the errors.",
                },
              },
              required: [
                "drillParagraph",
                "focusSummary",
                "weakKeysTargeted",
                "coachingTips",
              ],
            },
          },
        })
      );

      const rawText = response.text?.trim();
      if (!rawText) {
        res.status(502).json({
          error: "Gemini returned an empty response while generating your drill.",
        });
        return;
      }

      const parsed = JSON.parse(rawText) as {
        drillParagraph: string;
        focusSummary: string;
        weakKeysTargeted: string[];
        coachingTips: string[];
      };

      res.json({
        drillParagraph: parsed.drillParagraph.replace(/\s+/g, " ").trim(),
        focusSummary: parsed.focusSummary,
        weakKeysTargeted: parsed.weakKeysTargeted ?? [],
        coachingTips: parsed.coachingTips ?? [],
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to analyze errors with Gemini.";
      console.error("[Gemini API Error]:", message);

      let statusCode = 500;
      let userMessage = message;
      if (message.includes("API_KEY_INVALID") || message.includes("PERMISSION_DENIED")) {
        statusCode = 403;
        userMessage =
          "Gemini API authorization failed. Check GEMINI_API_KEY in Settings > Secrets.";
      } else if (message.includes("RESOURCE_EXHAUSTED") || message.includes("429")) {
        statusCode = 429;
        userMessage = "Gemini API rate limit reached. Please wait a moment and retry.";
      } else if (message.includes("NOT_FOUND") || message.includes("404")) {
        statusCode = 502;
        userMessage = "Requested Gemini model was unavailable. Please retry.";
      }

      res.status(statusCode).json({ error: userMessage });
    }
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("/{*path}", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`TypeRush server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start TypeRush server:", err);
  process.exit(1);
});
