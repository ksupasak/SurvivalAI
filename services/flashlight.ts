/**
 * Flashlight Control Service
 *
 * Controls the device flashlight/torch for Morse code signaling.
 * Uses a subscriber pattern — the Morse screen renders a hidden CameraView
 * and subscribes to torch state changes to toggle `enableTorch`.
 */

import { Platform } from 'react-native';

export type TimingElement = {
  type: 'on' | 'off';
  duration: number;
};

// ─── Torch State Observable ──────────────────────────────────────────────────

let torchState = false;
let torchListeners: Array<(on: boolean) => void> = [];

function setTorch(on: boolean) {
  torchState = on;
  torchListeners.forEach((l) => l(on));
}

/**
 * Subscribe to torch on/off changes.
 * Returns an unsubscribe function.
 */
export function subscribeTorchState(listener: (on: boolean) => void): () => void {
  torchListeners.push(listener);
  listener(torchState);
  return () => {
    torchListeners = torchListeners.filter((l) => l !== listener);
  };
}

/**
 * Get current torch state.
 */
export function getTorchState(): boolean {
  return torchState;
}

// ─── Playback State ──────────────────────────────────────────────────────────

let playing = false;
let currentTimeoutId: ReturnType<typeof setTimeout> | null = null;
let abortRequested = false;
let currentWaitResolve: (() => void) | null = null;

/**
 * Turn the torch/flashlight ON.
 */
async function torchOn(): Promise<void> {
  setTorch(true);
}

/**
 * Turn the torch/flashlight OFF.
 */
async function torchOff(): Promise<void> {
  setTorch(false);
}

/**
 * Wait for a specified duration. Resolves immediately if aborted.
 */
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    currentWaitResolve = resolve;
    currentTimeoutId = setTimeout(() => {
      currentTimeoutId = null;
      currentWaitResolve = null;
      resolve();
    }, ms);
  });
}

/**
 * Play a Morse code timing sequence by controlling the flashlight.
 */
export async function playMorseSequence(
  sequence: TimingElement[],
  onProgress?: (index: number, total: number) => void
): Promise<void> {
  if (playing) {
    console.warn('[Flashlight] Already playing a sequence.');
    return;
  }

  playing = true;
  abortRequested = false;

  try {
    for (let i = 0; i < sequence.length; i++) {
      if (abortRequested) break;

      const element = sequence[i];

      if (onProgress) {
        onProgress(i, sequence.length);
      }

      if (element.type === 'on') {
        await torchOn();
      } else {
        await torchOff();
      }

      await wait(element.duration);
    }
  } finally {
    await torchOff();
    playing = false;
    abortRequested = false;
  }
}

/**
 * Stop the currently playing Morse code sequence.
 */
export function stopPlayback(): void {
  abortRequested = true;

  if (currentTimeoutId !== null) {
    clearTimeout(currentTimeoutId);
    currentTimeoutId = null;
  }

  // Resolve the pending wait so playMorseSequence can exit its loop
  if (currentWaitResolve) {
    currentWaitResolve();
    currentWaitResolve = null;
  }

  torchOff();
}

/**
 * Check if a Morse code sequence is currently being played.
 */
export function isPlaying(): boolean {
  return playing;
}
