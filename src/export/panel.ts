import type { AppState } from '../core/state';
import { toast } from '../ui/controls';
import { downloadBlob, type ExportOpts } from './frames';
import { exportPng } from './png';
import { exportGif } from './gif';
import { exportMp4, mp4Supported } from './mp4';
import { exportEmbed } from './embed';
import { exportTerminal } from './terminal';
import { assertExportBudget } from '../core/guardrails';

type Format = 'png' | 'gif' | 'mp4' | 'embed' | 'terminal';

export type ExportEvent =
  | { name: 'export_started'; format: Format }
  | { name: 'export_completed'; format: Format; bytes: number }
  | { name: 'export_failed'; format: Format; message: string }
  | { name: 'export_cancelled'; format: Format };

const RUNNERS: Record<Exclude<Format, 'png'>, (s: AppState, o: ExportOpts) => Promise<Blob>> = {
  gif: exportGif,
  mp4: exportMp4,
  embed: exportEmbed,
  terminal: exportTerminal,
};

const EXTENSIONS: Record<Format, string> = {
  png: 'png',
  gif: 'gif',
  mp4: 'mp4',
  embed: 'embed.zip',
  terminal: 'terminal.zip',
};

/** Build the export panel UI. getT returns the editor's current playhead. */
export function buildExportPanel(
  container: HTMLElement,
  state: AppState,
  getT: () => number,
  onEvent?: (event: ExportEvent) => void,
): void {
  const row = document.createElement('div');
  row.className = 'control-row';

  const format = document.createElement('select');
  const formats: [Format, string, boolean][] = [
    ['png', 'PNG (frame)', true],
    ['gif', 'GIF (loop)', true],
    ['mp4', 'MP4 (loop)', mp4Supported()],
    ['embed', 'Web embed (zip)', true],
    ['terminal', 'Terminal (zip)', true],
  ];
  for (const [value, label, enabled] of formats) {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = enabled ? label : `${label} - needs WebCodecs`;
    o.disabled = !enabled;
    format.appendChild(o);
  }

  const scale = document.createElement('select');
  for (const s of ['1', '2', '3']) {
    const o = document.createElement('option');
    o.value = s;
    o.textContent = `${s}×`;
    scale.appendChild(o);
  }
  scale.value = '2';

  row.append(format, scale);

  const alphaRow = document.createElement('label');
  alphaRow.className = 'control-row';
  const alphaCheck = document.createElement('input');
  alphaCheck.type = 'checkbox';
  const alphaLabel = document.createElement('span');
  alphaLabel.className = 'control-label';
  alphaLabel.textContent = 'Alpha (PNG)';
  alphaRow.append(alphaLabel, alphaCheck);

  const btnRow = document.createElement('div');
  btnRow.className = 'control-row';
  const exportBtn = document.createElement('button');
  exportBtn.className = 'btn btn-primary';
  exportBtn.textContent = 'Export';
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.display = 'none';
  btnRow.append(exportBtn, cancelBtn);

  const progress = document.createElement('div');
  progress.className = 'progress';
  const bar = document.createElement('div');
  progress.appendChild(bar);
  progress.style.display = 'none';

  container.append(row, alphaRow, btnRow, progress);

  let signal = { aborted: false };

  const setBusy = (busy: boolean) => {
    exportBtn.disabled = busy;
    cancelBtn.style.display = busy ? '' : 'none';
    progress.style.display = busy ? '' : 'none';
    if (!busy) bar.style.width = '0%';
  };

  cancelBtn.addEventListener('click', () => (signal.aborted = true));

  exportBtn.addEventListener('click', async () => {
    const fmt = format.value as Format;
    const sc = Number(scale.value);
    signal = { aborted: false };
    const opts: ExportOpts = {
      scale: sc,
      signal,
      onProgress: (done, total) => (bar.style.width = `${Math.round((done / total) * 100)}%`),
    };
    setBusy(true);
    onEvent?.({ name: 'export_started', format: fmt });
    try {
      assertExportBudget(state, fmt, sc);
      if (fmt === 'png') {
        const blob = await exportPng(state, getT(), sc, alphaCheck.checked);
        downloadBlob(blob, 'ascii.png');
        toast('PNG exported');
        onEvent?.({ name: 'export_completed', format: fmt, bytes: blob.size });
      } else {
        const blob = await RUNNERS[fmt](state, opts);
        downloadBlob(blob, `ascii.${EXTENSIONS[fmt]}`);
        toast(`${fmt.toUpperCase()} exported (${(blob.size / 1e6).toFixed(1)} MB)`);
        onEvent?.({ name: 'export_completed', format: fmt, bytes: blob.size });
      }
    } catch (e) {
      const msg = (e as Error).message;
      toast(msg === 'cancelled' ? 'Export cancelled' : `Export failed: ${msg}`, msg === 'cancelled' ? 'info' : 'error');
      onEvent?.(msg === 'cancelled'
        ? { name: 'export_cancelled', format: fmt }
        : { name: 'export_failed', format: fmt, message: msg });
    } finally {
      setBusy(false);
    }
  });
}
