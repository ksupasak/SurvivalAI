/**
 * Morse Code Light Decoder
 *
 * Uses the device's ambient light sensor (expo-sensors LightSensor) to detect
 * flashing light patterns and decode them as Morse code in real time.
 *
 * The decoder uses adaptive timing: it calibrates the "dot" duration from
 * the first few short flashes detected, then classifies subsequent signals
 * relative to that baseline.
 */

import { LightSensor } from 'expo-sensors';
import { MORSE_TO_CHAR } from '@/constants/morse-code';

export type DecoderUpdate = {
  /** Morse symbols being built for the current character (e.g. ".-") */
  currentMorse: string;
  /** Full decoded text so far */
  decodedText: string;
  /** Full Morse string so far (space-separated characters, / for word gap) */
  decodedMorse: string;
  /** Whether the sensor currently reads "bright" */
  isLight: boolean;
  /** Raw lux reading */
  lux: number;
};

export type DecoderCallback = (update: DecoderUpdate) => void;

// ─── Decoder State ───────────────────────────────────────────────────────────

let subscription: ReturnType<typeof LightSensor.addListener> | null = null;
let callback: DecoderCallback | null = null;

// Detection state
let threshold = 100;
let isLight = false;
let lastTransitionTime = 0;
let currentMorse = '';
let decodedText = '';
let decodedMorse = '';
let silenceTimer: ReturnType<typeof setTimeout> | null = null;

// Adaptive timing — estimate dot duration from incoming signals
let dotDuration = 150; // initial estimate in ms
let recentShortPulses: number[] = [];

// ─── Internal Helpers ────────────────────────────────────────────────────────

function sensitivityToThreshold(sensitivity: number): number {
  // Higher sensitivity → lower lux threshold to trigger "on"
  // sensitivity 10 (low)  → 500 lux
  // sensitivity 100 (high) → 10 lux
  return Math.max(10, 510 - (sensitivity / 100) * 500);
}

function finalizeCharacter() {
  if (!currentMorse) return;
  const char = MORSE_TO_CHAR[currentMorse] || '?';
  decodedText += char;
  decodedMorse += (decodedMorse ? ' ' : '') + currentMorse;
  currentMorse = '';
}

function addWordGap() {
  finalizeCharacter();
  if (decodedText.length > 0 && !decodedText.endsWith(' ')) {
    decodedText += ' ';
    decodedMorse += ' / ';
  }
}

function trackShortPulse(duration: number) {
  recentShortPulses.push(duration);
  if (recentShortPulses.length > 8) recentShortPulses.shift();
  const avg =
    recentShortPulses.reduce((a, b) => a + b, 0) / recentShortPulses.length;
  dotDuration = Math.max(40, Math.min(400, avg));
}

function resetSilenceTimer() {
  if (silenceTimer) {
    clearTimeout(silenceTimer);
    silenceTimer = null;
  }
}

function startSilenceTimer() {
  resetSilenceTimer();
  // After extended silence, finalize whatever we have
  silenceTimer = setTimeout(() => {
    if (currentMorse) {
      addWordGap();
      emitUpdate(0);
    }
  }, dotDuration * 7);
}

function emitUpdate(lux: number) {
  if (callback) {
    callback({
      currentMorse,
      decodedText,
      decodedMorse,
      isLight,
      lux,
    });
  }
}

function processReading(lux: number) {
  const now = Date.now();
  const wasLight = isLight;
  isLight = lux > threshold;

  if (wasLight !== isLight) {
    const duration = now - lastTransitionTime;
    lastTransitionTime = now;

    if (!isLight && wasLight) {
      // Light just turned OFF → classify the ON duration
      resetSilenceTimer();
      if (duration < dotDuration * 2) {
        currentMorse += '.';
        trackShortPulse(duration);
      } else {
        currentMorse += '-';
      }
      // Start silence timer to detect end of character/word
      startSilenceTimer();
    } else if (isLight && !wasLight) {
      // Light just turned ON → classify the OFF duration
      resetSilenceTimer();
      if (duration > dotDuration * 5) {
        // Word gap
        addWordGap();
      } else if (duration > dotDuration * 2) {
        // Character gap
        finalizeCharacter();
      }
      // else: intra-character element gap, keep building
    }
  }

  emitUpdate(lux);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Start listening to the light sensor and decoding Morse.
 * @param cb  Called on every sensor reading with the latest decoded state
 * @param sensitivity  10–100, higher = more sensitive to dim light
 */
export function startDecoder(cb: DecoderCallback, sensitivity: number = 50): void {
  if (subscription) stopDecoder();

  callback = cb;
  threshold = sensitivityToThreshold(sensitivity);
  isLight = false;
  lastTransitionTime = Date.now();
  currentMorse = '';
  decodedText = '';
  decodedMorse = '';
  recentShortPulses = [];
  dotDuration = 150;

  LightSensor.setUpdateInterval(30); // ~33 readings/sec

  subscription = LightSensor.addListener(({ illuminance }) => {
    processReading(illuminance);
  });
}

/**
 * Stop the light sensor and finalize any pending Morse character.
 */
export function stopDecoder(): void {
  resetSilenceTimer();

  if (subscription) {
    subscription.remove();
    subscription = null;
  }

  // Finalize anything in progress
  if (currentMorse) {
    finalizeCharacter();
    if (callback) emitUpdate(0);
  }

  callback = null;
}

/**
 * Update the detection threshold while running.
 */
export function updateSensitivity(sensitivity: number): void {
  threshold = sensitivityToThreshold(sensitivity);
}

/**
 * Clear decoded text without stopping the decoder.
 */
export function clearDecoded(): void {
  currentMorse = '';
  decodedText = '';
  decodedMorse = '';
  if (callback) emitUpdate(0);
}
