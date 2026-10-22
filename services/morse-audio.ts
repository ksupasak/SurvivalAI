/**
 * Morse over sound — transmit through the speaker, receive through the mic.
 *
 * This exists alongside the light-based Morse support because sound works on
 * both platforms. The light decoder depends on an ambient light sensor, which
 * Android has and iOS does not expose at all, so on iOS audio is the only
 * Morse channel that actually functions.
 *
 * Sending reuses the tone synthesis already proven by the SOS audio beacon:
 * build a mono 16-bit WAV from the timing sequence and play it.
 *
 * Receiving uses the recorder's metering, which reports input level in dBFS.
 * That is a loudness reading, not a tone detector — a loud noise that is not a
 * beep still registers. Good enough to decode a clear tone in a quiet room,
 * not a substitute for a real frequency filter.
 */

import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import {
  documentDirectory,
  writeAsStringAsync,
  EncodingType,
} from 'expo-file-system/legacy';
import { textToTimingSequence, type TimingElement } from '@/services/morse';
import { pushReading } from '@/services/morse-decoder';

// ─── Tone settings ───────────────────────────────────────────────────────────

/** 600 Hz is the traditional CW sidetone and sits clear of most room noise. */
const FREQUENCY = 600;
const SAMPLE_RATE = 44100;

// ─── WAV synthesis ───────────────────────────────────────────────────────────

function writeString(buf: Uint8Array, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    buf[offset + i] = str.charCodeAt(i);
  }
}

/** Build a mono 16-bit PCM WAV that beeps along the given on/off sequence. */
function generateMorseWav(sequence: TimingElement[]): Uint8Array {
  const totalMs = sequence.reduce((sum, el) => sum + el.duration, 0);
  const totalSamples = Math.floor((SAMPLE_RATE * totalMs) / 1000);
  const dataSize = totalSamples * 2;
  const fileSize = 44 + dataSize;

  const buffer = new Uint8Array(fileSize);
  const view = new DataView(buffer.buffer);

  writeString(buffer, 0, 'RIFF');
  view.setUint32(4, fileSize - 8, true);
  writeString(buffer, 8, 'WAVE');

  writeString(buffer, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);

  writeString(buffer, 36, 'data');
  view.setUint32(40, dataSize, true);

  let idx = 0;
  for (const element of sequence) {
    const numSamples = Math.floor((SAMPLE_RATE * element.duration) / 1000);

    for (let i = 0; i < numSamples && idx < totalSamples; i++, idx++) {
      let value = 0;
      if (element.type === 'on') {
        const sample = Math.sin((2 * Math.PI * FREQUENCY * i) / SAMPLE_RATE);

        // Ramp the edges, or each symbol starts and ends with an audible click.
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
  return global.btoa(binary);
}

// ─── Sending ─────────────────────────────────────────────────────────────────

let playback: Audio.Sound | null = null;

/** True while a transmission is sounding. */
export function isPlayingMorse(): boolean {
  return playback !== null;
}

/**
 * Sound out `text` as Morse through the speaker.
 *
 * @param text  Message to send; characters with no Morse equivalent are skipped
 * @param wpm   Sending speed in words per minute
 * @param onDone  Called when the transmission finishes or is stopped
 */
export async function playMorseAudio(
  text: string,
  wpm: number,
  onDone?: () => void
): Promise<void> {
  if (Platform.OS === 'web') return;

  await stopMorseAudio();

  const sequence = textToTimingSequence(text, wpm);
  if (sequence.length === 0) {
    onDone?.();
    return;
  }

  const wav = generateMorseWav(sequence);
  const uri = `${documentDirectory}morse_tx.wav`;
  await writeAsStringAsync(uri, uint8ArrayToBase64(wav), {
    encoding: EncodingType.Base64,
  });

  // Play through the speaker rather than the earpiece, and keep sounding even
  // if the ringer switch is silenced — this is a signalling feature.
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
  });

  const { sound } = await Audio.Sound.createAsync({ uri }, { volume: 1.0 });
  playback = sound;

  sound.setOnPlaybackStatusUpdate((status) => {
    if (status.isLoaded && status.didJustFinish) {
      stopMorseAudio().finally(() => onDone?.());
    }
  });

  await sound.playAsync();
}

/** Stop a transmission in progress. Safe to call when nothing is playing. */
export async function stopMorseAudio(): Promise<void> {
  if (!playback) return;
  const sound = playback;
  playback = null;
  try {
    await sound.stopAsync();
    await sound.unloadAsync();
  } catch {
    /* already stopped or unloaded */
  }
}

// ─── Receiving ───────────────────────────────────────────────────────────────

let recording: Audio.Recording | null = null;

/** True while the microphone is being sampled for Morse. */
export function isListeningForMorse(): boolean {
  return recording !== null;
}

/**
 * Metering is reported in dBFS, where 0 is the loudest the input can be and
 * quiet rooms sit near -60 or below. The decoder compares against thresholds
 * on a 0–1000 scale, so map the useful part of that range onto it.
 */
function dbToLevel(db: number): number {
  const FLOOR_DB = -60;
  if (!Number.isFinite(db)) return 0;
  const clamped = Math.max(FLOOR_DB, Math.min(0, db));
  return ((clamped - FLOOR_DB) / -FLOOR_DB) * 1000;
}

/**
 * Start sampling the microphone and feeding levels into the Morse decoder.
 * The caller should have started the decoder first.
 *
 * @returns false when permission was refused or audio is unavailable
 */
export async function startAudioMorseListening(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (recording) return true;

  try {
    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) return false;

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const rec = new Audio.Recording();
    await rec.prepareToRecordAsync({
      ...Audio.RecordingOptionsPresets.LOW_QUALITY,
      isMeteringEnabled: true,
    });

    // ~30 samples a second, matching what the light sensor path provides.
    rec.setProgressUpdateInterval(33);
    rec.setOnRecordingStatusUpdate((status) => {
      if (status.isRecording && typeof status.metering === 'number') {
        pushReading(dbToLevel(status.metering));
      }
    });

    await rec.startAsync();
    recording = rec;
    return true;
  } catch (e) {
    console.warn('[MorseAudio] Could not start listening:', e);
    recording = null;
    return false;
  }
}

/** Stop sampling the microphone. Safe to call when not listening. */
export async function stopAudioMorseListening(): Promise<void> {
  if (!recording) return;
  const rec = recording;
  recording = null;
  try {
    rec.setOnRecordingStatusUpdate(null);
    await rec.stopAndUnloadAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
  } catch {
    /* already stopped */
  }
}
