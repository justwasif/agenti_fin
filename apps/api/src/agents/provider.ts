/**
 * provider.ts — LLM provider selection for the two ProofOfWorkPay agents.
 *
 * Env-driven fallback chain (primary → fallback):
 *   test-authoring: GEMINI_API_KEY → openrouter(deepseek-chat:free)
 *   worker:         GEMINI_API_KEY → OPENROUTER_API_KEY → ollama(qwen2.5-coder:7b)
 *
 * All model construction is wrapped in a try/catch and every call site goes
 * through `callWithTimeout`, so a missing/empty env var or a provider that is
 * down degrades gracefully instead of crashing the route. The agent layer
 * (test-authoring.ts / worker.ts) is what actually catches model failures and
 * returns a cached/canned fallback.
 */
import { createGoogle } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

/** Google provider that reads GEMINI_API_KEY explicitly. */
function gemini(modelId: string): LanguageModel {
  const googleProvider = createGoogle({
    apiKey: process.env.GEMINI_API_KEY,
  });
  return googleProvider(modelId);
}

/**
 * Working Gemini Flash model. `gemini-2.5-flash` was retired by Google
 * ("no longer available to new users"); `gemini-3.6-flash` is the current
 * Flash model. Overridable via GEMINI_MODEL.
 */
const GEMINI_MODEL =
  process.env.GEMINI_MODEL ?? "gemini-3.6-flash";

/** OpenRouter exposes an OpenAI-compatible chat API. */
function openrouter(modelId: string): LanguageModel {
  const openai = createOpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY ?? "",
    name: "openrouter",
  });
  return openai.chat(modelId);
}

/** Local Ollama exposes an OpenAI-compatible chat API at /v1. */
function ollama(modelId: string): LanguageModel {
  const ollamaProvider = createOpenAICompatible({
    name: "ollama",
    baseURL: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1",
  });
  return ollamaProvider.chatModel(modelId);
}

/**
 * testAuthoringModel(): prefer Gemini Flash, fall back to a free OpenRouter
 * model (deepseek-chat) for the test-authoring agent.
 */
export function testAuthoringModel(): LanguageModel {
  try {
    if (process.env.GEMINI_API_KEY) {
      return gemini(GEMINI_MODEL);
    }
    return openrouter("deepseek/deepseek-chat:free");
  } catch (err) {
    // Last-resort: fall back to whatever worker fallback chain is reachable.
    console.warn("[provider] testAuthoringModel fallback triggered:", err);
    return workerModel();
  }
}

/**
 * workerModel(): Gemini → OpenRouter (qwen coder) → local Ollama.
 */
export function workerModel(): LanguageModel {
  try {
    if (process.env.GEMINI_API_KEY) {
      return gemini(GEMINI_MODEL);
    }
    if (process.env.OPENROUTER_API_KEY) {
      return openrouter("qwen/qwen2.5-coder-32b-instruct:free");
    }
    return ollama("qwen2.5-coder:7b");
  } catch (err) {
    // The Google `google()` constructor may throw if no key/ADC is configured;
    // degrade to the OpenAI-compatible chain rather than crashing the route.
    console.warn("[provider] workerModel fallback triggered:", err);
    return ollama("qwen2.5-coder:7b");
  }
}

/**
 * Run `fn` with an overall wall-clock timeout. Returns a promise that rejects
 * with a descriptive Error if the model call exceeds `timeoutMs`.
 */
export async function callWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs = 60_000
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`LLM call timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([fn(), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
