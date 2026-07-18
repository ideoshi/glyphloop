export type ParamValue = number | string | boolean;
export type ParamValues = Record<string, ParamValue>;

export interface ParamSpec {
  key: string;
  label: string;
  type: 'range' | 'select' | 'color' | 'checkbox' | 'text';
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  default: ParamValue;
}

export function defaults(specs: ParamSpec[]): ParamValues {
  const out: ParamValues = {};
  for (const s of specs) out[s.key] = s.default;
  return out;
}
