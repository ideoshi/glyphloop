import { describe, expect, it, vi } from 'vitest';
// @ts-expect-error The production Worker entrypoint is intentionally plain JavaScript.
import worker, { MAX_EVENT_BODY_BYTES, MAX_WAITLIST_BODY_BYTES } from '../site-worker/index.js';

function env(waitlistAllowed = true, analyticsAllowed = true) {
  return {
    WAITLIST: { put: vi.fn(async (_key: string, _value: string) => undefined) },
    WAITLIST_RATE_LIMITER: { limit: vi.fn(async () => ({ success: waitlistAllowed })) },
    ANALYTICS_RATE_LIMITER: { limit: vi.fn(async () => ({ success: analyticsAllowed })) },
    PRODUCT_ANALYTICS: { writeDataPoint: vi.fn() },
    ASSETS: { fetch: vi.fn(async () => new Response('asset')) },
  };
}

function signup(body: string, headers: Record<string, string> = {}) {
  return new Request('https://glyphloop.art/api/waitlist', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.7', ...headers },
    body,
  });
}

const anonymousId = '019f7456-b125-7890-8abc-1234567890ab';
const sessionId = '019f7456-c234-7890-8abc-1234567890ab';

function productEvent(overrides: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  return new Request('https://glyphloop.art/api/events', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'cf-connecting-ip': '203.0.113.7',
      origin: 'https://glyphloop.art',
      ...headers,
    },
    body: JSON.stringify({
      name: 'editor_opened',
      anonymousId,
      sessionId,
      path: '/studio/',
      version: '0.1.0-beta.0',
      properties: { returning: true },
      ...overrides,
    }),
  });
}

describe('waitlist Worker', () => {
  it('passes static requests to the assets binding', async () => {
    const bindings = env();
    const response = await worker.fetch(new Request('https://glyphloop.art/studio/'), bindings);
    expect(await response.text()).toBe('asset');
    expect(bindings.ASSETS.fetch).toHaveBeenCalledOnce();
  });

  it('normalizes and stores a valid signup', async () => {
    const bindings = env();
    const response = await worker.fetch(signup(JSON.stringify({ email: '  Person@Example.COM ' })), bindings);
    expect(response.status).toBe(200);
    expect(bindings.WAITLIST.put).toHaveBeenCalledWith('person@example.com', expect.any(String));
    const storedSignup = JSON.parse(bindings.WAITLIST.put.mock.calls[0][1]);
    expect(storedSignup).toEqual({ at: expect.any(String) });
    expect(bindings.PRODUCT_ANALYTICS.writeDataPoint).toHaveBeenCalledWith(
      expect.objectContaining({ blobs: expect.arrayContaining(['waitlist_submitted']) }),
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('silently accepts the honeypot without writing', async () => {
    const bindings = env();
    const response = await worker.fetch(signup(JSON.stringify({ email: 'bot@example.com', company: 'spam' })), bindings);
    expect(response.status).toBe(200);
    expect(bindings.WAITLIST.put).not.toHaveBeenCalled();
  });

  it('rejects unsupported methods and content types', async () => {
    const bindings = env();
    const method = await worker.fetch(new Request('https://glyphloop.art/api/waitlist'), bindings);
    expect(method.status).toBe(405);
    expect(method.headers.get('allow')).toBe('POST');

    const media = await worker.fetch(signup('{}', { 'content-type': 'text/plain' }), bindings);
    expect(media.status).toBe(415);
  });

  it('rejects declared and streamed oversized bodies', async () => {
    const bindings = env();
    const declared = await worker.fetch(signup('{}', { 'content-length': String(MAX_WAITLIST_BODY_BYTES + 1) }), bindings);
    expect(declared.status).toBe(413);

    const streamed = await worker.fetch(signup(`{"email":"${'x'.repeat(MAX_WAITLIST_BODY_BYTES)}"}`), bindings);
    expect(streamed.status).toBe(413);
    expect(bindings.WAITLIST.put).not.toHaveBeenCalled();
  });

  it('returns 429 when the binding denies the attempt', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const bindings = env(false);
    const response = await worker.fetch(signup('{"email":"person@example.com"}'), bindings);
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('60');
    expect(bindings.WAITLIST.put).not.toHaveBeenCalled();
    expect(warning).toHaveBeenCalledOnce();
    warning.mockRestore();
  });

  it('returns a controlled error when KV is unavailable', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const bindings = env();
    bindings.WAITLIST.put.mockRejectedValueOnce(new Error('KV unavailable'));
    const response = await worker.fetch(signup('{"email":"person@example.com"}'), bindings);
    expect(response.status).toBe(503);
    expect(errorLog).toHaveBeenCalledOnce();
    errorLog.mockRestore();
  });
});

describe('product analytics Worker', () => {
  it('writes a fixed-schema product event without request metadata', async () => {
    const bindings = env();
    const response = await worker.fetch(productEvent(), bindings);
    expect(response.status).toBe(204);
    expect(bindings.PRODUCT_ANALYTICS.writeDataPoint).toHaveBeenCalledWith({
      indexes: [anonymousId],
      blobs: ['editor_opened', sessionId, '/studio/', '', '', '', '', '0.1.0-beta.0'],
      doubles: [1, 0, 0],
    });
    const stored = bindings.PRODUCT_ANALYTICS.writeDataPoint.mock.calls[0][0];
    expect(JSON.stringify(stored)).not.toContain('203.0.113.7');
  });

  it('collapses custom preset names and drops free-form properties', async () => {
    const bindings = env();
    const response = await worker.fetch(productEvent({
      name: 'preset_selected',
      properties: { builtIn: false, preset: 'Client Name and secret phrase', message: 'do not store me' },
    }), bindings);
    expect(response.status).toBe(204);
    const stored = bindings.PRODUCT_ANALYTICS.writeDataPoint.mock.calls[0][0];
    expect(stored.blobs[3]).toBe('custom');
    expect(JSON.stringify(stored)).not.toContain('Client Name');
    expect(JSON.stringify(stored)).not.toContain('do not store me');
  });

  it('rejects unknown events, identifiers, paths, origins, and content types', async () => {
    const bindings = env();
    expect((await worker.fetch(productEvent({ name: 'made_up' }), bindings)).status).toBe(400);
    expect((await worker.fetch(productEvent({ anonymousId: 'not-an-id' }), bindings)).status).toBe(400);
    expect((await worker.fetch(productEvent({ path: '/private' }), bindings)).status).toBe(400);
    expect((await worker.fetch(productEvent({}, { origin: 'https://example.com' }), bindings)).status).toBe(403);
    expect((await worker.fetch(productEvent({}, { 'content-type': 'text/plain' }), bindings)).status).toBe(415);
  });

  it('rejects oversized and rate-limited event requests', async () => {
    const bindings = env();
    const oversized = productEvent({}, { 'content-length': String(MAX_EVENT_BODY_BYTES + 1) });
    expect((await worker.fetch(oversized, bindings)).status).toBe(413);

    const limited = env(true, false);
    const response = await worker.fetch(productEvent(), limited);
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('60');
    expect(limited.PRODUCT_ANALYTICS.writeDataPoint).not.toHaveBeenCalled();
  });
});
