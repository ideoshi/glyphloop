import type { PresetInput } from '../cli/preset';
import blobsAmbient from '../../presets/blobs-ambient.json';
import exprRipples from '../../presets/expr-ripples.json';
import flowfieldHero from '../../presets/flowfield-hero.json';
import parametricSpring from '../../presets/parametric-spring.json';
import torusSpin from '../../presets/torus-spin.json';
import wavesCalm from '../../presets/waves-calm.json';

export interface BuiltinPreset {
  slug: string;
  name: string;
  description: string;
  preset: PresetInput;
}

export const BUILTIN_PRESETS: BuiltinPreset[] = [
  { slug: 'flowfield-hero', name: 'Flowfield Hero', description: 'Wide, calm website backdrop', preset: flowfieldHero as PresetInput },
  { slug: 'waves-calm', name: 'Calm Waves', description: 'Soft dotted interference', preset: wavesCalm as PresetInput },
  { slug: 'blobs-ambient', name: 'Ambient Blobs', description: 'Slow organic gradient', preset: blobsAmbient as PresetInput },
  { slug: 'expr-ripples', name: 'Ripple Expression', description: 'Custom mathematical loop', preset: exprRipples as PresetInput },
  { slug: 'torus-spin', name: 'Torus Spin', description: 'Shaded rotating glyph sculpture', preset: torusSpin as PresetInput },
  { slug: 'parametric-spring', name: 'Parametric Spring', description: 'Agent-authored 3D surface', preset: parametricSpring as PresetInput },
];

export function builtinBySlug(slug: string): BuiltinPreset | undefined {
  return BUILTIN_PRESETS.find((item) => item.slug === slug);
}
