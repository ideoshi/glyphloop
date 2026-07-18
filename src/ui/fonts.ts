import { clearTextMaskCache } from '../sources/textmask';
import { clearTextBaseCache } from '../core/base';

/** Curated text-base fonts. Google fonts are loaded on demand. */
export const TEXT_FONTS: Record<string, string> = {
  'Mono': 'ui-monospace, Menlo, monospace',
  'Space Grotesk': "'Space Grotesk', sans-serif",
  'Inter': "'Inter', sans-serif",
  'Impact': 'Impact, Haettenschweiler, sans-serif',
  'Georgia': 'Georgia, serif',
};

/** Fonts assumed locally available - everything else is fetched from Google Fonts. */
const SYSTEM_FONTS = new Set(['Mono', 'Impact', 'Georgia']);

const loaded = new Set<string>();

/**
 * Load a font by name (any Google Fonts family works, e.g. "Bungee" or
 * "Pixelify Sans") and clear text mask caches so it takes effect.
 * Throws if the family can't be fetched.
 */
export async function ensureTextFont(name: string): Promise<void> {
  if (!SYSTEM_FONTS.has(name) && !loaded.has(name)) {
    const spec = `${encodeURIComponent(name).replace(/%20/g, '+')}:wght@700`;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${spec}&display=swap`;
    const ok = await new Promise((resolve) => {
      link.onload = () => resolve(true);
      link.onerror = () => resolve(false);
      document.head.appendChild(link);
    });
    if (!ok) {
      link.remove();
      throw new Error(`font "${name}" not found on Google Fonts`);
    }
    await document.fonts.load(`700 80px "${name}"`);
    loaded.add(name);
  }
  clearTextMaskCache();
  clearTextBaseCache();
}

/** CSS font-family stack for a font name. */
export function fontFamilyFor(name: string): string {
  return TEXT_FONTS[name] ?? `'${name}', sans-serif`;
}
