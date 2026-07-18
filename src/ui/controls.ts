import type { ParamSpec, ParamValues, ParamValue } from '../core/params';

/** Render a set of labeled controls from ParamSpecs into `container`. */
export function renderControls(
  container: HTMLElement,
  specs: ParamSpec[],
  values: ParamValues,
  onChange: (key: string, value: ParamValue) => void,
  validate?: (key: string, value: ParamValue) => string | null,
): void {
  container.innerHTML = '';
  for (const spec of specs) {
    const row = document.createElement('label');
    row.className = 'control-row';

    const name = document.createElement('span');
    name.className = 'control-label';
    name.textContent = spec.label;
    row.appendChild(name);

    const current = values[spec.key] ?? spec.default;

    if (spec.type === 'range') {
      const wrap = document.createElement('span');
      wrap.className = 'control-range';
      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(spec.min ?? 0);
      input.max = String(spec.max ?? 1);
      input.step = String(spec.step ?? 0.01);
      input.value = String(current);
      const val = document.createElement('span');
      val.className = 'control-value';
      val.textContent = String(current);
      input.addEventListener('input', () => {
        val.textContent = input.value;
        onChange(spec.key, Number(input.value));
      });
      wrap.append(input, val);
      row.appendChild(wrap);
    } else if (spec.type === 'select') {
      const input = document.createElement('select');
      for (const opt of spec.options ?? []) {
        const o = document.createElement('option');
        o.value = opt;
        o.textContent = opt;
        input.appendChild(o);
      }
      input.value = String(current);
      input.addEventListener('change', () => onChange(spec.key, input.value));
      row.appendChild(input);
    } else if (spec.type === 'text') {
      const stack = document.createElement('span');
      stack.className = 'control-stack';
      const input = document.createElement('input');
      input.type = 'text';
      input.value = String(current);
      const error = document.createElement('span');
      error.className = 'control-error';
      error.setAttribute('role', 'status');
      input.addEventListener('input', () => {
        const message = validate?.(spec.key, input.value) ?? null;
        input.setAttribute('aria-invalid', String(!!message));
        error.textContent = message ?? '';
        error.hidden = !message;
        if (!message) onChange(spec.key, input.value);
      });
      stack.append(input, error);
      row.appendChild(stack);
    } else if (spec.type === 'color') {
      const input = document.createElement('input');
      input.type = 'color';
      input.value = String(current);
      input.addEventListener('input', () => onChange(spec.key, input.value));
      row.appendChild(input);
    } else {
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = Boolean(current);
      input.addEventListener('change', () => onChange(spec.key, input.checked));
      row.appendChild(input);
    }

    container.appendChild(row);
  }
}

export function toast(message: string, kind: 'info' | 'error' = 'info'): void {
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}
