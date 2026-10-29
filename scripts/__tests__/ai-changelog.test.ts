import { describe, expect, it } from 'bun:test';
import { requestAiDraft } from '../ai-changelog.ts';

const base = { apiKey: 'k', model: 'm', system: 's', user: 'u' };
const reply = (body: unknown, status = 200) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

// Bug caught: a draft cut off at max_tokens was used as if complete, so a truncated entry could be
// promoted into CHANGELOG.md; a hung API call stalled the release with no way out.
describe('requestAiDraft', () => {
  it('returns the text on end_turn', async () => {
    const out = await requestAiDraft({ ...base, fetchFn: reply({ stop_reason: 'end_turn', content: [{ text: ' ### Features\n- a ' }] }) });
    expect(out).toEqual({ kind: 'text', text: '### Features\n- a' });
  });

  it('falls back on any other stop_reason, naming it', async () => {
    const out = await requestAiDraft({ ...base, fetchFn: reply({ stop_reason: 'max_tokens', content: [{ text: '### Features\n- cut of' }] }) });
    expect(out.kind).toBe('fallback');
    expect(out.kind === 'fallback' && out.reason).toContain('max_tokens');
  });

  it('falls back on an HTTP error and on a thrown fetch', async () => {
    expect((await requestAiDraft({ ...base, fetchFn: reply({ error: 'overloaded' }, 529) })).kind).toBe('fallback');
    const boom = (async () => {
      throw new Error('socket closed');
    }) as unknown as typeof fetch;
    expect((await requestAiDraft({ ...base, fetchFn: boom })).kind).toBe('fallback');
  });

  it('passes an abort signal and falls back when the request outlives the timeout', async () => {
    let sawSignal = false;
    const hang = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        sawSignal = init.signal instanceof AbortSignal;
        init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      })) as unknown as typeof fetch;

    const out = await requestAiDraft({ ...base, fetchFn: hang, timeoutMs: 30 });

    expect(sawSignal).toBe(true);
    expect(out.kind).toBe('fallback');
  });

  it('reports NO_USER_CHANGES as its own outcome', async () => {
    const out = await requestAiDraft({ ...base, fetchFn: reply({ stop_reason: 'end_turn', content: [{ text: 'NO_USER_CHANGES' }] }) });
    expect(out.kind).toBe('no-changes');
  });
});
