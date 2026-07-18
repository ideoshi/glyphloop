import { afterEach, describe, expect, it, vi } from 'vitest';
import { installHostedTelemetry, track, trackEditorOpened } from '../src/core/telemetry';

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('telemetry outside a browser', () => {
  it('is safe to call when window and localStorage are unavailable', () => {
    expect(() => track('editor_opened')).not.toThrow();
    expect(() => trackEditorOpened()).not.toThrow();
    expect(() => installHostedTelemetry()).not.toThrow();
  });

  it('sends only allowlisted properties from the hosted Studio', () => {
    const sent = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(null, { status: 204 }));
    const hostedWindow: Record<string, unknown> = {
      location: { hostname: 'glyphloop.art', pathname: '/studio/' },
      dispatchEvent: vi.fn(),
    };
    vi.stubGlobal('window', hostedWindow);
    vi.stubGlobal('navigator', { doNotTrack: '0', globalPrivacyControl: false });
    vi.stubGlobal('localStorage', storage());
    vi.stubGlobal('sessionStorage', storage());
    vi.stubGlobal('crypto', {
      randomUUID: vi
        .fn()
        .mockReturnValueOnce('019f7456-b125-7890-8abc-1234567890ab')
        .mockReturnValueOnce('019f7456-c234-7890-8abc-1234567890ab'),
    });
    vi.stubGlobal('fetch', sent);

    installHostedTelemetry();
    const sink = hostedWindow.glyphloopTelemetry as (event: object) => void;
    sink({
      name: 'preset_selected',
      at: new Date().toISOString(),
      properties: { builtIn: false, preset: 'Client secret preset', message: 'never send this' },
    });

    const request = sent.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(body.properties).toEqual({ builtIn: false, preset: 'custom' });
    expect(JSON.stringify(body)).not.toContain('Client secret preset');
    expect(JSON.stringify(body)).not.toContain('never send this');
  });
});
