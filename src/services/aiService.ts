import { AIDrillResponse, ErrorPair } from "../types/typing";

export interface AnalyzeDrillRequest {
  missedKeys: Record<string, number>;
  errorPairs: ErrorPair[];
  bigrams: Record<string, number>;
  wpm: number;
  accuracy: number;
  mode: string;
}

export async function requestAIDrill(
  payload: AnalyzeDrillRequest
): Promise<AIDrillResponse> {
  const response = await fetch("/api/ai/analyze-drill", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => ({}))) as Partial<AIDrillResponse> & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(
      data.error || `Drill generation failed with status ${response.status}.`
    );
  }

  if (!data.drillParagraph) {
    throw new Error("Server returned an incomplete AI drill payload.");
  }

  return {
    drillParagraph: data.drillParagraph,
    focusSummary: data.focusSummary || "Custom drill generated from your recent keystroke telemetry.",
    weakKeysTargeted: Array.isArray(data.weakKeysTargeted) ? data.weakKeysTargeted : [],
    coachingTips: Array.isArray(data.coachingTips) ? data.coachingTips : [],
  };
}
