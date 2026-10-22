// Runs AI Suggest off the main thread so the 3D scene never freezes
import { optimize, type OptimizeInput, type OptimizeResult, type Progress } from './optimizer';

export type WorkerRequest = Omit<OptimizeInput, 'onProgress'>;
export type WorkerMessage = { type: 'progress'; progress: Progress } | { type: 'done'; result: OptimizeResult };

const ctx = self as unknown as { onmessage: (e: MessageEvent<WorkerRequest>) => void; postMessage: (m: WorkerMessage) => void };
ctx.onmessage = e => {
  const result = optimize({ ...e.data, onProgress: progress => ctx.postMessage({ type: 'progress', progress }) });
  ctx.postMessage({ type: 'done', result });
};
