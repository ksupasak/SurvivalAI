/**
 * Audio Beacon Service
 *
 * Generates and plays an SOS tone pattern (··· ─── ···) as an audible
 * rescue beacon. The WAV file is generated programmatically (880 Hz sine wave)
 * and looped continuously until stopped.
 */

import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import {
  writeAsStringAsync,
  documentDirectory,
  EncodingType,
} from 'expo-file-system/legacy';

// ─── Audio Config ────────────────────────────────────────────────────────────

const SAMPLE_RATE = 22050;
const FREQUENCY = 880; // Hz – clear, attention-getting tone
const UNIT_MS = 150; // Base Morse timing unit

// SOS pattern: ··· ─── ···
// [isOn, durationInUnits]
const SOS_PATTERN: [boolean, number][] = [
  // S: dit dit dit
  [true, 1], [false, 1], [true, 1], [false, 1], [true, 1],
  // letter gap (3 units)
  [false, 3],
  // O: dah dah dah
  [true, 3], [false, 1], [true, 3], [false, 1], [true, 3],
  // letter gap (3 units)
  [false, 3],
  // S: dit dit dit
  [true, 1], [false, 1], [true, 1], [false, 1], [true, 1],
  // word gap before repeat (7 units)
  [false, 7],
];

// ─── State ───────────────────────────────────────────────────────────────────

let sound: Audio.Sound | null = null;
let active = false;

// ─── WAV Generation ──────────────────────────────────────────────────────────

function writeString(buf: Uint8Array, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    buf[offset + i] = str.charCodeAt(i);
  }
}

function generateSOSWav(): Uint8Array {
  // Calculate total duration
  let totalUnits = 0;
  for (const [, units] of SOS_PATTERN) totalUnits += units;

  const totalMs = totalUnits * UNIT_MS;
  const totalSamples = Math.floor((SAMPLE_RATE * totalMs) / 1000);
  const dataSize = totalSamples * 2; // 16-bit = 2 bytes per sample
  const fileSize = 44 + dataSize;

  const buffer = new Uint8Array(fileSize);
  const view = new DataView(buffer.buffer);

  // ── WAV header ──
  writeString(buffer, 0, 'RIFF');
  view.setUint32(4, fileSize - 8, true);
  writeString(buffer, 8, 'WAVE');

  // fmt chunk
  writeString(buffer, 12, 'fmt ');
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample

  // data chunk
  writeString(buffer, 36, 'data');
  view.setUint32(40, dataSize, true);

  // ── Generate samples ──
  let idx = 0;
  for (const [isOn, units] of SOS_PATTERN) {
    const durationMs = units * UNIT_MS;
    const numSamples = Math.floor((SAMPLE_RATE * durationMs) / 1000);

    for (let i = 0; i < numSamples && idx < totalSamples; i++, idx++) {
      let value = 0;
      if (isOn) {
        const t = i / SAMPLE_RATE;
        const sample = Math.sin(2 * Math.PI * FREQUENCY * t);

        // Fade envelope to avoid clicks
        let envelope = 1;
        const fadeSamples = Math.min(numSamples * 0.05, SAMPLE_RATE * 0.01);
        if (i < fadeSamples) envelope = i / fadeSamples;
        if (i > numSamples - fadeSamples) envelope = (numSamples - i) / fadeSamples;

        value = Math.floor(sample * envelope * 32767 * 0.8);
      }
      view.setInt16(44 + idx * 2, value, true);
    }
  }

  return buffer;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, bytes.length);
    for (let j = i; j < end; j++) {
      binary += String.fromCharCode(bytes[j]);
    }
  }
  return btoa(binary);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Start playing the SOS audio beacon on loop.
 */
export async function startAudioBeacon(): Promise<void> {
  if (active) return;
  if (Platform.OS === 'web') {
    console.log('[AudioBeacon] Not supported on web');
    return;
  }

  active = true;

  try {
    // Configure audio to play even in silent mode
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: false,
    });

    // Generate WAV and write to filesystem
    const wavBytes = generateSOSWav();
    const base64 = uint8ArrayToBase64(wavBytes);
    const fileUri = documentDirectory + 'sos_beacon.wav';
    await writeAsStringAsync(fileUri, base64, {
      encoding: EncodingType.Base64,
    });

    // Load and play on loop
    const { sound: s } = await Audio.Sound.createAsync(
      { uri: fileUri },
      { isLooping: true, volume: 1.0 }
    );
    sound = s;
    await sound.playAsync();
    console.log('[AudioBeacon] SOS tone playing');
  } catch (err) {
    console.error('[AudioBeacon] Error starting:', err);
    active = false;
  }
}

/**
 * Stop the SOS audio beacon.
 */
export async function stopAudioBeacon(): Promise<void> {
  active = false;
  if (sound) {
    try {
      await sound.stopAsync();
      await sound.unloadAsync();
    } catch (_) {
      // ignore cleanup errors
    }
    sound = null;
    console.log('[AudioBeacon] Stopped');
  }
}

/**
 * Check if the audio beacon is currently active.
 */
export function isAudioBeaconActive(): boolean {
  return active;
}
