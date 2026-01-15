import { Subconscious } from "subconscious";

// Singleton client instance
let client: Subconscious | null = null;

export function getSubconsciousClient(): Subconscious {
  if (!client) {
    const apiKey = process.env.SUBCONSCIOUS_API_KEY;
    const baseUrl = process.env.SUBCONSCIOUS_BASE_URL;

    if (!apiKey) {
      throw new Error("SUBCONSCIOUS_API_KEY environment variable is not set");
    }

    // Allow using a local Subconscious API for development with custom tools
    // Set SUBCONSCIOUS_BASE_URL=http://localhost:8000 to use local API
    const options: { apiKey: string; baseUrl?: string } = { apiKey };
    if (baseUrl) {
      options.baseUrl = baseUrl;
      console.log("Using Subconscious API at:", baseUrl);
    }

    client = new Subconscious(options);
  }

  return client;
}

// Default engine for all requests
export const DEFAULT_ENGINE = "tim-large";

/**
 * Parse the answer from a TIM-large response.
 * When answerFormat is NOT used, the answer is returned as a JSON string.
 * This function handles both cases for safety.
 */
export function parseAnswer<T = unknown>(answer: unknown): T {
  if (typeof answer === "string") {
    return JSON.parse(answer) as T;
  }
  return answer as T;
}

// Helper to create a run with standard options
// NOTE: We intentionally do NOT use answerFormat because TIM-large
// returns arrays as stringified JSON when answerFormat is provided.
// Instead, we ask for JSON in the prompt and parse the answer string.
export async function createAgentRun(
  instructions: string,
  options?: {
    awaitCompletion?: boolean;
  }
) {
  const client = getSubconsciousClient();

  const run = await client.run({
    engine: DEFAULT_ENGINE,
    input: {
      instructions,
      tools: [{ type: "platform", id: "parallel_search", options: {} }],
      // NO answerFormat - this causes TIM-large to stringify arrays
      // Instead, ask for JSON in the prompt and use parseAnswer()
    },
    options: {
      awaitCompletion: options?.awaitCompletion !== false,
    },
  });

  return run;
}
