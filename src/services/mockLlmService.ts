/**
 * System prompt for TextNet AI.
 * Defines the assistant's behavior and strict SMS constraints.
 */
export const SYSTEM_PROMPT = `You are TextNet, an offline SMS assistant.
STRICT CONSTRAINTS:
1. Response length: ABSOLUTE MAX 150 characters.
2. Formatting: Plain text only. NO Markdown, NO emojis.
3. Style: Telegraphic, dictionary-style definitions.`;

const SIMULATED_LATENCY_MS = 3000;

/**
 * Generates a mock LLM response with simulated latency.
 *
 * @param userMessage - The user's input message
 * @returns A mock response string
 */
export async function generateResponse(userMessage: string): Promise<string> {
  console.log(`🔄 MockLlmService: Processing with ${SIMULATED_LATENCY_MS}ms simulated latency`);

  // Simulate LLM processing time
  await new Promise((resolve) => setTimeout(resolve, SIMULATED_LATENCY_MS));

  // Return a dummy response (truncated to 150 chars)
  const response = `TextNet received: "${truncate(userMessage, 50)}". This is a mock response. Real LLM integration pending.`;

  return truncate(response, 150);
}

/**
 * Truncates a string to the specified max length.
 */
function truncate(text: string | null | undefined, maxLength: number): string {
  if (!text) return '';
  return text.length <= maxLength ? text : text.substring(0, maxLength - 3) + '...';
}
