/**
 * Voice Input/Output Service
 *
 * TTS via expo-speech, STT via expo-speech-recognition.
 *
 * Both are native-only. STT additionally needs a custom dev client, so
 * `isSttAvailable()` reports whether the module is actually present and every
 * entry point fails soft when it is not.
 */

import { Platform } from 'react-native';
import * as Speech from 'expo-speech';

// ─── Text-to-Speech (TTS) ───────────────────────────────────────────────────

/**
 * Speak the given text aloud using the device's text-to-speech engine.
 *
 * @param text - The text to speak
 * @param options - Optional speech configuration
 */
export async function speak(
  text: string,
  options?: {
    language?: string;
    pitch?: number;
    rate?: number;
  }
): Promise<void> {
  return new Promise((resolve, reject) => {
    Speech.speak(text, {
      language: options?.language ?? 'en-US',
      pitch: options?.pitch ?? 1.0,
      rate: options?.rate ?? 0.9,
      onDone: () => resolve(),
      onError: (error) => reject(error),
      onStopped: () => resolve(),
    });
  });
}

/**
 * Stop any currently active speech output.
 */
export function stopSpeaking(): void {
  Speech.stop();
}

/**
 * Check if the TTS engine is currently speaking.
 *
 * @returns true if speech is in progress
 */
export async function isSpeaking(): Promise<boolean> {
  return Speech.isSpeakingAsync();
}

// ─── Speech-to-Text (STT) ──────────────────────────────────────────────────
//
// Backed by expo-speech-recognition, which wraps SFSpeechRecognizer on iOS and
// android.speech.SpeechRecognizer on Android. Requires a custom dev client —
// the module is not present in Expo Go, so every entry point degrades to a
// clear "unavailable" error rather than throwing.

export type SttErrorCode =
  | 'unavailable'
  | 'permission-denied'
  | 'no-speech'
  | 'network'
  | 'language-not-supported'
  | 'unknown';

export interface SttError {
  code: SttErrorCode;
  message: string;
}

/** BCP-47 tags for the app's supported locales, for the recognizer. */
const STT_LANGUAGE_TAGS: Record<string, string> = {
  en: 'en-US', th: 'th-TH', es: 'es-ES', fr: 'fr-FR',
  zh: 'zh-CN', ja: 'ja-JP', ko: 'ko-KR', ar: 'ar-SA',
  ru: 'ru-RU', de: 'de-DE', pt: 'pt-BR', hi: 'hi-IN',
  it: 'it-IT', nl: 'nl-NL', tr: 'tr-TR', pl: 'pl-PL',
  vi: 'vi-VN', id: 'id-ID', uk: 'uk-UA', sv: 'sv-SE',
};

export function toSpeechLanguageTag(locale: string): string {
  return STT_LANGUAGE_TAGS[locale] ?? 'en-US';
}

type SpeechModule = typeof import('expo-speech-recognition').ExpoSpeechRecognitionModule;
type Subscription = { remove: () => void };

let _module: SpeechModule | null = null;
let _moduleResolved = false;

/** Native-only and dev-client-only; resolve lazily so web and Expo Go survive. */
function getSpeechModule(): SpeechModule | null {
  if (_moduleResolved) return _module;
  _moduleResolved = true;
  if (Platform.OS === 'web') return null;
  try {
    _module = require('expo-speech-recognition').ExpoSpeechRecognitionModule;
  } catch {
    _module = null;
  }
  return _module;
}

/** True when speech recognition can actually run on this build. */
export function isSttAvailable(): boolean {
  return getSpeechModule() !== null;
}

// STT state
let listening = false;
let subscriptions: Subscription[] = [];

function teardown(): void {
  subscriptions.forEach((sub) => {
    try {
      sub.remove();
    } catch {
      /* listener already detached */
    }
  });
  subscriptions = [];
  listening = false;
}

/** Map the library's error codes onto ours, so callers can localise messages. */
function mapErrorCode(code: string): SttErrorCode {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'permission-denied';
    case 'no-speech':
      return 'no-speech';
    case 'network':
      return 'network';
    case 'language-not-supported':
      return 'language-not-supported';
    default:
      return 'unknown';
  }
}

export interface StartListeningOptions {
  /** App locale code, e.g. 'en' or 'th'. Mapped to a BCP-47 tag. */
  locale?: string;
  /** Emit partial transcripts while the user is still speaking. Default true. */
  interimResults?: boolean;
  /** Keep recognising after a pause instead of stopping at the first result. */
  continuous?: boolean;
}

/**
 * Start listening for speech input.
 *
 * `onResult` fires for interim transcripts too; `isFinal` marks the last one
 * for an utterance. Recognition stops on its own after a final result unless
 * `continuous` is set.
 */
export async function startListening(
  onResult: (text: string, isFinal: boolean) => void,
  onError?: (error: SttError) => void,
  options?: StartListeningOptions
): Promise<void> {
  if (listening) {
    console.warn('[Voice] Already listening');
    return;
  }

  const speech = getSpeechModule();
  if (!speech) {
    onError?.({
      code: 'unavailable',
      message: 'Speech recognition is not available on this build.',
    });
    return;
  }

  try {
    const permission = await speech.requestPermissionsAsync();
    if (!permission.granted) {
      onError?.({
        code: 'permission-denied',
        message: 'Microphone and speech recognition permission are required.',
      });
      return;
    }
  } catch (e) {
    onError?.({ code: 'unknown', message: String(e) });
    return;
  }

  listening = true;

  subscriptions.push(
    speech.addListener('result', (event) => {
      const transcript = event.results?.[0]?.transcript ?? '';
      if (transcript) onResult(transcript, event.isFinal);
    })
  );

  subscriptions.push(
    speech.addListener('error', (event) => {
      const code = mapErrorCode(event.error);
      teardown();
      onError?.({ code, message: event.message || event.error });
    })
  );

  subscriptions.push(
    speech.addListener('end', () => {
      teardown();
    })
  );

  try {
    speech.start({
      lang: toSpeechLanguageTag(options?.locale ?? 'en'),
      interimResults: options?.interimResults ?? true,
      continuous: options?.continuous ?? false,
      addsPunctuation: true,
    });
  } catch (e) {
    teardown();
    onError?.({ code: 'unknown', message: String(e) });
  }
}

/** Stop listening and let the recognizer return one last final result. */
export function stopListening(): void {
  if (!listening) return;
  const speech = getSpeechModule();
  try {
    speech?.stop();
  } catch {
    /* recognizer already stopped */
  }
}

/** Stop listening immediately, discarding any pending result. */
export function abortListening(): void {
  if (!listening) return;
  const speech = getSpeechModule();
  try {
    speech?.abort();
  } catch {
    /* recognizer already stopped */
  }
  teardown();
}

/**
 * Check if the STT engine is currently listening.
 */
export function isListening(): boolean {
  return listening;
}
