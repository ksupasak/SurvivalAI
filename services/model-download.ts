/**
 * Model Download Service
 *
 * Manages downloading and storing GGUF models for on-device LLM inference.
 * Uses expo-file-system legacy API for downloads with progress tracking.
 */

import { Platform } from 'react-native';
import {
  documentDirectory,
  getInfoAsync,
  makeDirectoryAsync,
  deleteAsync,
  readDirectoryAsync,
  createDownloadResumable,
  type DownloadResumable,
  type DownloadProgressData,
  getFreeDiskStorageAsync,
  getTotalDiskCapacityAsync,
} from 'expo-file-system/legacy';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  sizeBytes: number;
  sizeLabel: string;
  ramRequired: string;
  url: string;
  filename: string;
  quantization: string;
  recommended?: boolean;
}

export type DownloadStatus =
  | { state: 'idle' }
  | { state: 'downloading'; progress: number }
  | { state: 'completed'; path: string }
  | { state: 'error'; message: string };

// ─── Available Models ───────────────────────────────────────────────────────

export const AVAILABLE_MODELS: ModelInfo[] = [
  {
    id: 'phi-3-mini',
    name: 'Phi-3.5 Mini 3.8B',
    description: 'Highest quality under 4GB. Best reasoning ability. Default choice.',
    sizeBytes: 2_390_000_000,
    sizeLabel: '2.3 GB',
    ramRequired: '~3.5 GB',
    url: 'https://huggingface.co/bartowski/Phi-3.5-mini-instruct-GGUF/resolve/main/Phi-3.5-mini-instruct-Q4_K_M.gguf',
    filename: 'Phi-3.5-mini-instruct-Q4_K_M.gguf',
    quantization: 'Q4_K_M',
    recommended: true,
  },
  {
    id: 'qwen2.5-1.5b',
    name: 'Qwen2.5 1.5B',
    description: 'Strong multilingual support. Excellent for non-English languages.',
    sizeBytes: 1_100_000_000,
    sizeLabel: '1.1 GB',
    ramRequired: '~1.5 GB',
    url: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf',
    filename: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
    quantization: 'Q4_K_M',
  },
  {
    id: 'smollm2-1.7b',
    name: 'SmolLM2 1.7B',
    description: 'Compact yet capable. Good balance of speed and quality for mobile.',
    sizeBytes: 1_060_000_000,
    sizeLabel: '1.0 GB',
    ramRequired: '~1.5 GB',
    url: 'https://huggingface.co/huggingface/SmolLM2-1.7B-Instruct-GGUF/resolve/main/smollm2-1.7b-instruct-q4_k_m.gguf',
    filename: 'smollm2-1.7b-instruct-q4_k_m.gguf',
    quantization: 'Q4_K_M',
  },
  {
    id: 'smollm2-360m',
    name: 'SmolLM2 360M',
    description: 'Ultra-light model. Fast responses, basic quality. Best for low-end devices.',
    sizeBytes: 229_000_000,
    sizeLabel: '229 MB',
    ramRequired: '~0.5 GB',
    url: 'https://huggingface.co/huggingface/SmolLM2-360M-Instruct-GGUF/resolve/main/smollm2-360m-instruct-q4_k_m.gguf',
    filename: 'smollm2-360m-instruct-q4_k_m.gguf',
    quantization: 'Q4_K_M',
  },
];

// ─── State ──────────────────────────────────────────────────────────────────

const MODEL_DIR = `${documentDirectory}models/`;

let downloadStatus: DownloadStatus = { state: 'idle' };
let activeDownload: DownloadResumable | null = null;
let statusListeners: Array<(status: DownloadStatus) => void> = [];

function notifyListeners() {
  statusListeners.forEach((l) => l(downloadStatus));
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function subscribeDownloadStatus(
  listener: (status: DownloadStatus) => void
): () => void {
  statusListeners.push(listener);
  listener(downloadStatus);
  return () => {
    statusListeners = statusListeners.filter((l) => l !== listener);
  };
}

export function getDownloadStatus(): DownloadStatus {
  return downloadStatus;
}

const isNative = Platform.OS !== 'web';

/**
 * Ensure the models directory exists.
 */
async function ensureModelDir(): Promise<void> {
  if (!isNative) return;
  const info = await getInfoAsync(MODEL_DIR);
  if (!info.exists) {
    await makeDirectoryAsync(MODEL_DIR, { intermediates: true });
  }
}

/**
 * Check if a model is already downloaded.
 */
export async function isModelDownloaded(model: ModelInfo): Promise<boolean> {
  if (!isNative) return false;
  const path = MODEL_DIR + model.filename;
  const info = await getInfoAsync(path);
  return info.exists && (info.size ?? 0) > 100_000;
}

/**
 * Get the local path for a downloaded model.
 */
export function getModelPath(model: ModelInfo): string {
  return MODEL_DIR + model.filename;
}

/**
 * Get the currently active/downloaded model, if any.
 */
export async function getActiveModel(): Promise<ModelInfo | null> {
  if (!isNative) return null;
  for (const model of AVAILABLE_MODELS) {
    if (await isModelDownloaded(model)) {
      return model;
    }
  }
  return null;
}

/**
 * Download a model with progress tracking.
 */
export async function downloadModel(model: ModelInfo): Promise<string> {
  if (!isNative) throw new Error('Downloads are only available on native platforms');
  if (activeDownload) {
    throw new Error('A download is already in progress');
  }

  await ensureModelDir();
  const destPath = MODEL_DIR + model.filename;

  // Check if already downloaded
  if (await isModelDownloaded(model)) {
    downloadStatus = { state: 'completed', path: destPath };
    notifyListeners();
    return destPath;
  }

  downloadStatus = { state: 'downloading', progress: 0 };
  notifyListeners();

  try {
    const callback = (data: DownloadProgressData) => {
      const progress = data.totalBytesExpectedToWrite > 0
        ? data.totalBytesWritten / data.totalBytesExpectedToWrite
        : 0;
      downloadStatus = { state: 'downloading', progress: Math.min(progress, 1) };
      notifyListeners();
    };

    activeDownload = createDownloadResumable(
      model.url,
      destPath,
      {},
      callback
    );

    const result = await activeDownload.downloadAsync();
    activeDownload = null;

    if (result && result.uri) {
      downloadStatus = { state: 'completed', path: result.uri };
      notifyListeners();
      return result.uri;
    }

    throw new Error('Download failed - no result URI');
  } catch (error: unknown) {
    activeDownload = null;
    const msg = error instanceof Error ? error.message : 'Unknown download error';
    downloadStatus = { state: 'error', message: msg };
    notifyListeners();
    throw error;
  }
}

/**
 * Cancel an in-progress download.
 */
export async function cancelDownload(): Promise<void> {
  if (activeDownload) {
    try {
      await activeDownload.pauseAsync();
    } catch {
      // Ignore pause errors
    }
    activeDownload = null;
  }
  downloadStatus = { state: 'idle' };
  notifyListeners();
}

/**
 * Delete a downloaded model to free space.
 */
export async function deleteModel(model: ModelInfo): Promise<void> {
  if (!isNative) return;
  const path = MODEL_DIR + model.filename;
  const info = await getInfoAsync(path);
  if (info.exists) {
    await deleteAsync(path, { idempotent: true });
  }
  downloadStatus = { state: 'idle' };
  notifyListeners();
}

/**
 * Get disk usage info for models directory.
 */
export async function getModelsSize(): Promise<number> {
  if (!isNative) return 0;
  let totalSize = 0;
  try {
    const dirInfo = await getInfoAsync(MODEL_DIR);
    if (!dirInfo.exists) return 0;

    const files = await readDirectoryAsync(MODEL_DIR);
    for (const file of files) {
      const fileInfo = await getInfoAsync(MODEL_DIR + file);
      if (fileInfo.exists && fileInfo.size) {
        totalSize += fileInfo.size;
      }
    }
  } catch {
    // Directory might not exist yet
  }
  return totalSize;
}

/**
 * Format bytes to human-readable string.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// ─── Device Memory & Storage ────────────────────────────────────────────────

export interface DeviceStorageInfo {
  freeSpace: number;
  totalSpace: number;
  freeSpaceLabel: string;
  totalSpaceLabel: string;
}

/**
 * Get device storage info (free/total disk space).
 */
export async function getDeviceStorageInfo(): Promise<DeviceStorageInfo> {
  if (!isNative) {
    return { freeSpace: 0, totalSpace: 0, freeSpaceLabel: 'N/A (Web)', totalSpaceLabel: 'N/A' };
  }
  try {
    const freeSpace = await getFreeDiskStorageAsync();
    const totalSpace = await getTotalDiskCapacityAsync();
    return {
      freeSpace,
      totalSpace,
      freeSpaceLabel: formatBytes(freeSpace),
      totalSpaceLabel: formatBytes(totalSpace),
    };
  } catch {
    return {
      freeSpace: 0,
      totalSpace: 0,
      freeSpaceLabel: 'Unknown',
      totalSpaceLabel: 'Unknown',
    };
  }
}

/**
 * Get the recommended model based on available device storage.
 * Recommends the best model that fits within available space
 * (with 500MB buffer for safety).
 */
export function getRecommendedModel(freeSpaceBytes: number): ModelInfo {
  const SAFETY_BUFFER = 500 * 1024 * 1024; // 500MB buffer
  const usableSpace = freeSpaceBytes - SAFETY_BUFFER;

  // Find the largest model that fits, prioritize quality
  const sortedBySize = [...AVAILABLE_MODELS].sort((a, b) => b.sizeBytes - a.sizeBytes);
  for (const model of sortedBySize) {
    if (model.sizeBytes <= usableSpace) {
      return model;
    }
  }
  // If nothing fits, return the smallest
  return AVAILABLE_MODELS[AVAILABLE_MODELS.length - 1];
}

/**
 * Check if a model fits on the device.
 */
export function modelFitsOnDevice(model: ModelInfo, freeSpaceBytes: number): boolean {
  const SAFETY_BUFFER = 500 * 1024 * 1024;
  return model.sizeBytes < (freeSpaceBytes - SAFETY_BUFFER);
}
