/**
 * The Anthropic request behind `publish.ts --ai-changelog`, with fetch injected so its failure
 * paths are testable. It never throws: every problem comes back as a fallback with a reason, and
 * the caller falls back to the raw commit list.
 */

export type AiDraft = { kind: 'text'; text: string } | { kind: 'no-changes' } | { kind: 'fallback'; reason: string };

export interface AiDraftRequest {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  /** Liveness bound for the whole request. */
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export const requestAiDraft = async (req: AiDraftRequest): Promise<AiDraft> => {
  const fetchFn = req.fetchFn ?? fetch;
  try {
    const response = await fetchFn('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: AbortSignal.timeout(req.timeoutMs ?? 60_000),
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': req.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: req.model,
        max_tokens: 4096,
        system: req.system,
        messages: [{ role: 'user', content: req.user }],
      }),
    });

    if (!response.ok) {
      return { kind: 'fallback', reason: `Claude API returned ${response.status}: ${await response.text()}` };
    }

    const data = (await response.json()) as { content?: Array<{ text?: string }>; stop_reason?: string };
    // Anything but a finished turn (max_tokens, refusal, pause) may be a cut-off draft.
    if (data.stop_reason !== 'end_turn') {
      return { kind: 'fallback', reason: `Claude stopped with stop_reason "${data.stop_reason ?? 'missing'}", not end_turn` };
    }

    const text = data.content?.[0]?.text?.trim() ?? '';
    if (text === 'NO_USER_CHANGES') return { kind: 'no-changes' };
    if (text === '') return { kind: 'fallback', reason: 'Claude returned an empty draft' };
    return { kind: 'text', text };
  } catch (err) {
    return { kind: 'fallback', reason: `Claude API call failed: ${err instanceof Error ? err.message : String(err)}` };
  }
};
