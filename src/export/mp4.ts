import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import type { AppState } from '../core/state';
import { FrameRenderer, frameTimes, yieldToUI, type ExportOpts } from './frames';
import { preloadLayerImages } from '../core/layerimg';

export function mp4Supported(): boolean {
  return typeof window !== 'undefined' && 'VideoEncoder' in window;
}

const CODEC_CANDIDATES = ['avc1.640034', 'avc1.4d0034', 'avc1.42003e'];

async function pickCodec(width: number, height: number, fps: number): Promise<string> {
  for (const codec of CODEC_CANDIDATES) {
    const support = await VideoEncoder.isConfigSupported({ codec, width, height, framerate: fps });
    if (support.supported) return codec;
  }
  throw new Error('No supported H.264 encoder configuration');
}

export async function exportMp4(state: AppState, opts: ExportOpts): Promise<Blob> {
  await preloadLayerImages(state.layers);
  const fr = new FrameRenderer(state, opts.scale, false, opts.targetSize);
  // H.264 requires even dimensions; render once to learn the size, then pad.
  fr.render(0);
  const width = Math.ceil(fr.canvas.width / 2) * 2;
  const height = Math.ceil(fr.canvas.height / 2) * 2;

  const pad = document.createElement('canvas');
  pad.width = width;
  pad.height = height;
  const padCtx = pad.getContext('2d', { alpha: false })!;

  const codec = await pickCodec(width, height, state.fps);
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width, height },
    fastStart: 'in-memory',
  });

  let encoderError: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => (encoderError = e as Error),
  });
  encoder.configure({
    codec,
    width,
    height,
    bitrate: Math.min(20_000_000, width * height * 6),
    framerate: state.fps,
  });

  const times = frameTimes(state.fps, state.duration);
  const usPerFrame = 1_000_000 / state.fps;

  try {
    for (let i = 0; i < times.length; i++) {
      if (opts.signal.aborted) throw new Error('cancelled');
      if (encoderError) throw encoderError;
      const canvas = fr.render(times[i]);
      padCtx.fillStyle = state.mapper.bg;
      padCtx.fillRect(0, 0, width, height);
      padCtx.drawImage(canvas, 0, 0);
      const frame = new VideoFrame(pad, {
        timestamp: Math.round(i * usPerFrame),
        duration: Math.round(usPerFrame),
      });
      encoder.encode(frame, { keyFrame: i % (state.fps * 2) === 0 });
      frame.close();
      opts.onProgress(i + 1, times.length);
      if (encoder.encodeQueueSize > 8) await yieldToUI();
      if (i % 3 === 2) await yieldToUI();
    }
    await encoder.flush();
    if (encoderError) throw encoderError;
  } finally {
    if (encoder.state !== 'closed') encoder.close();
  }

  muxer.finalize();
  return new Blob([(muxer.target as ArrayBufferTarget).buffer], { type: 'video/mp4' });
}
