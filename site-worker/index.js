/**
 * glyphloop.art worker: static assets + release-note signup endpoint.
 * POST /api/waitlist {email, consent} -> stored in KV (key: email, value: metadata).
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRODUCT_EVENT_NAMES = new Set([
  'try_glyphloop',
  'github_opened',
  'example_opened',
  'embed_copied',
  'editor_opened',
  'preset_selected',
  'media_import_started',
  'media_import_completed',
  'media_import_failed',
  'export_started',
  'export_completed',
  'export_failed',
  'export_cancelled',
]);
export const MAX_WAITLIST_BODY_BYTES = 2048;
export const MAX_EVENT_BODY_BYTES = 2048;

export class BodyTooLargeError extends Error {}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/events') {
      return handleProductEvent(request, env);
    }

    if (url.pathname === '/api/waitlist') {
      if (request.method !== 'POST') {
        return json({ ok: false, error: 'method not allowed' }, 405, { allow: 'POST' });
      }
      if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
        return json({ ok: false, error: 'content type must be application/json' }, 415);
      }

      const actor = request.headers.get('cf-connecting-ip') || 'unknown';
      const { success } = await env.WAITLIST_RATE_LIMITER.limit({ key: `waitlist:${actor}` });
      if (!success) {
        console.warn(JSON.stringify({ event: 'waitlist_rate_limited' }));
        return json({ ok: false, error: 'too many attempts, try again shortly' }, 429, { 'retry-after': '60' });
      }

      let email = '';
      let consent = 'public-beta-launch-note';
      try {
        const body = await readJsonWithLimit(request);
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid body');
        email = String(body.email || '').trim().toLowerCase();
        if (body.consent === 'v1-launch-note') consent = body.consent;
        // honeypot field: real users never fill it
        if (body.company) return json({ ok: true });
      } catch (error) {
        if (error instanceof BodyTooLargeError) {
          return json({ ok: false, error: 'request is too large' }, 413);
        }
        return json({ ok: false, error: 'bad request' }, 400);
      }
      if (!EMAIL_RE.test(email) || email.length > 254) {
        return json({ ok: false, error: 'enter a valid email' }, 400);
      }
      try {
        await env.WAITLIST.put(
          email,
          JSON.stringify({
            at: new Date().toISOString(),
            consent,
          }),
        );
        writeAnalyticsPoint(env, {
          indexes: ['waitlist'],
          blobs: ['waitlist_submitted', '', '/', '', '', '', '', 'site'],
          doubles: [0, 0, 0],
        });
      } catch (error) {
        console.error(JSON.stringify({ event: 'waitlist_write_failed', message: String(error) }));
        return json({ ok: false, error: 'temporarily unavailable' }, 503);
      }
      return json({ ok: true });
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleProductEvent(request, env) {
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'method not allowed' }, 405, { allow: 'POST' });
  }
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return json({ ok: false, error: 'content type must be application/json' }, 415);
  }

  const origin = request.headers.get('origin');
  if (origin && origin !== 'https://glyphloop.art' && origin !== 'https://www.glyphloop.art') {
    return json({ ok: false, error: 'origin not allowed' }, 403);
  }

  const actor = request.headers.get('cf-connecting-ip') || 'unknown';
  const { success } = await env.ANALYTICS_RATE_LIMITER.limit({ key: `events:${actor}` });
  if (!success) {
    return json({ ok: false, error: 'too many events, try again shortly' }, 429, { 'retry-after': '60' });
  }

  let event;
  try {
    const body = await readJsonWithLimit(request, MAX_EVENT_BODY_BYTES);
    event = normalizeProductEvent(body);
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return json({ ok: false, error: 'request is too large' }, 413);
    }
    return json({ ok: false, error: 'bad request' }, 400);
  }

  writeAnalyticsPoint(env, event);
  return new Response(null, {
    status: 204,
    headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  });
}

function normalizeProductEvent(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid body');
  if (!PRODUCT_EVENT_NAMES.has(body.name)) throw new Error('invalid event');
  if (!UUID_RE.test(body.anonymousId) || !UUID_RE.test(body.sessionId)) throw new Error('invalid identifiers');

  const path = body.path === '/' || body.path === '/studio/' ? body.path : '';
  if (!path) throw new Error('invalid path');
  const version = safeToken(body.version, 32);
  const properties = body.properties && typeof body.properties === 'object' && !Array.isArray(body.properties)
    ? body.properties
    : {};

  let preset = '';
  let mediaKind = '';
  let via = '';
  let format = '';
  let returning = 0;
  let builtIn = 0;
  let bytes = 0;

  if (body.name === 'editor_opened') returning = properties.returning === true ? 1 : 0;
  if (body.name === 'preset_selected') {
    builtIn = properties.builtIn === true ? 1 : 0;
    preset = builtIn ? safeToken(properties.preset, 64) : 'custom';
  }
  if (body.name.startsWith('media_import_')) {
    mediaKind = allowed(properties.kind, ['image', 'video', 'unknown']);
    via = allowed(properties.via, ['picker', 'drop-or-paste']);
  }
  if (body.name.startsWith('export_')) {
    format = allowed(properties.format, ['png', 'gif', 'mp4', 'embed', 'terminal']);
    if (body.name === 'export_completed' && Number.isFinite(properties.bytes)) {
      bytes = Math.max(0, Math.min(Number(properties.bytes), 2_000_000_000));
    }
  }

  return {
    indexes: [body.anonymousId],
    // Ordered schema: event, session, path, preset, media kind, import route,
    // export format, app version. Never add free-form creative content here.
    blobs: [body.name, body.sessionId, path, preset, mediaKind, via, format, version],
    doubles: [returning, builtIn, bytes],
  };
}

function allowed(value, values) {
  return values.includes(value) ? value : '';
}

function safeToken(value, maxLength) {
  const token = typeof value === 'string' ? value : '';
  return /^[a-zA-Z0-9._-]+$/.test(token) ? token.slice(0, maxLength) : '';
}

function writeAnalyticsPoint(env, point) {
  try {
    env.PRODUCT_ANALYTICS.writeDataPoint(point);
  } catch (error) {
    console.error(JSON.stringify({ event: 'analytics_write_failed', message: String(error) }));
  }
}

export async function readJsonWithLimit(request, maxBytes = MAX_WAITLIST_BODY_BYTES) {
  const declared = request.headers.get('content-length');
  if (declared !== null && Number(declared) > maxBytes) throw new BodyTooLargeError();
  if (!request.body) throw new Error('missing body');

  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let total = 0;
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new BodyTooLargeError();
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return JSON.parse(text);
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
      'x-content-type-options': 'nosniff',
      ...extraHeaders,
    },
  });
}
