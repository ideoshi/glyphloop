import { GLYPHLOOP_VERSION } from '../version';

export type GlyphloopEventName =
  | 'editor_opened'
  | 'preset_selected'
  | 'media_import_started'
  | 'media_import_completed'
  | 'media_import_failed'
  | 'export_started'
  | 'export_completed'
  | 'export_failed'
  | 'export_cancelled';

export interface GlyphloopEvent {
  name: GlyphloopEventName;
  at: string;
  properties: Record<string, string | number | boolean>;
}

const ANALYTICS_DISABLED_KEY = 'glyphloop-analytics-disabled';
const ANONYMOUS_ID_KEY = 'glyphloop-anonymous-id';
const SESSION_ID_KEY = 'glyphloop-session-id';
const HOSTED_NAMES = new Set(['glyphloop.art', 'www.glyphloop.art']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

declare global {
  interface Window {
    glyphloopTelemetry?: (event: GlyphloopEvent) => void;
  }
}

/** Provider-neutral product event hook. No data leaves the browser by default. */
export function track(name: GlyphloopEventName, properties: GlyphloopEvent['properties'] = {}): void {
  const event: GlyphloopEvent = { name, at: new Date().toISOString(), properties };
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<GlyphloopEvent>('glyphloop:event', { detail: event }));
  window.glyphloopTelemetry?.(event);
}

export function trackEditorOpened(): void {
  const key = 'glyphloop-has-opened';
  let returning = false;
  try {
    returning = localStorage.getItem(key) === '1';
    localStorage.setItem(key, '1');
  } catch {
    // Storage can be unavailable in private/embedded contexts; telemetry stays usable.
  }
  track('editor_opened', { returning });
}

/** Install the first-party sink only on Glyphloop's hosted production origins. */
export function installHostedTelemetry(): void {
  if (typeof window === 'undefined' || !HOSTED_NAMES.has(window.location.hostname)) return;
  if (window.glyphloopTelemetry || analyticsDisabled()) return;

  const anonymousId = storedId(localStorage, ANONYMOUS_ID_KEY);
  const sessionId = storedId(sessionStorage, SESSION_ID_KEY);
  if (!anonymousId || !sessionId) return;

  window.glyphloopTelemetry = (event) => {
    const body = JSON.stringify({
      name: event.name,
      anonymousId,
      sessionId,
      path: window.location.pathname,
      version: GLYPHLOOP_VERSION,
      properties: publicProperties(event),
    });
    void fetch('/api/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      credentials: 'omit',
      keepalive: true,
    }).catch(() => undefined);
  };
}

function analyticsDisabled(): boolean {
  const privacyNavigator = navigator as Navigator & { globalPrivacyControl?: boolean };
  if (privacyNavigator.globalPrivacyControl === true || navigator.doNotTrack === '1') return true;
  try {
    return localStorage.getItem(ANALYTICS_DISABLED_KEY) === '1';
  } catch {
    return true;
  }
}

function storedId(storage: Storage, key: string): string {
  try {
    const existing = storage.getItem(key);
    if (existing && UUID_RE.test(existing)) return existing;
    const id = crypto.randomUUID();
    storage.setItem(key, id);
    return id;
  } catch {
    return '';
  }
}

/** Strip free-form values before an event leaves the browser. */
function publicProperties(event: GlyphloopEvent): Record<string, string | number | boolean> {
  const properties = event.properties;
  switch (event.name) {
    case 'editor_opened':
      return { returning: properties.returning === true };
    case 'preset_selected': {
      const builtIn = properties.builtIn === true;
      return { builtIn, preset: builtIn ? String(properties.preset || '') : 'custom' };
    }
    case 'media_import_started':
    case 'media_import_completed':
    case 'media_import_failed':
      return { kind: String(properties.kind || ''), via: String(properties.via || '') };
    case 'export_started':
    case 'export_completed':
    case 'export_failed':
    case 'export_cancelled': {
      const safe: Record<string, string | number | boolean> = { format: String(properties.format || '') };
      if (event.name === 'export_completed' && typeof properties.bytes === 'number') safe.bytes = properties.bytes;
      return safe;
    }
  }
}
