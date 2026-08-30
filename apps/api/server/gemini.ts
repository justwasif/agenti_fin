/**
 * Minimal Google Gemini REST client.
 *
 * Docs: https://ai.google.dev/gemini-api/docs/text-generation
 *
 * Uses the public v1beta endpoint with the API key as a query param.
 * The key is read from GEMINI_API_KEY on the server side only.
 */

const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

export interface GenerateOptions {
  system?: string;
  user: string;
  json?: boolean;          // request JSON output
  temperature?: number;    // 0..1
  maxOutputTokens?: number;
}

export interface GenerateResult {
  text: string;
  json?: unknown;
}

function endpoint(): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
}

export async function generate(opts: GenerateOptions): Promise<GenerateResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    throw new Error(
      "GEMINI_API_KEY is not set. Copy server/.env.example to server/.env and add your key."
    );
  }

  const body: Record<string, unknown> = {
    contents: [
      {
        role: "user",
        parts: [{ text: opts.user }],
      },
    ],
    generationConfig: {
      temperature: opts.temperature ?? 0.4,
      maxOutputTokens: opts.maxOutputTokens ?? 2048,
    },
  };

  if (opts.system) {
    body.systemInstruction = { role: "system", parts: [{ text: opts.system }] };
  }

  if (opts.json) {
    (body.generationConfig as Record<string, unknown>).responseMimeType =
      "application/json";
  }

  const res = await fetch(`${endpoint()}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data: any = await res.json();
  const text: string =
    data?.candidates?.[0]?.content?.parts
      ?.map((p: any) => p?.text ?? "")
      .join("") ?? "";

  const result: GenerateResult = { text };
  if (opts.json) {
    try {
      result.json = JSON.parse(text);
    } catch {
      // try to extract a JSON block from the text
      const m = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (m) {
        try {
          result.json = JSON.parse(m[0]);
        } catch {
          // leave json undefined
        }
      }
    }
  }
  return result;
}
