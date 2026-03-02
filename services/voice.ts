/**
 * Voice Input/Output Service
 *
 * Provides text-to-speech (TTS) using expo-speech and placeholder
 * speech-to-text (STT) functions.
 *
 * TTS: Fully functional via expo-speech.
 * STT: Requires @react-native-voice/voice or expo-speech-recognition
 *       for real implementation. Placeholder functions are exported
 *       so the UI can be built against the interface.
 */

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
// NOTE: Real speech-to-text implementation requires a native module.
// Recommended options:
//
// 1. @react-native-voice/voice
//    - Most mature React Native STT library
//    - Supports streaming recognition
//    - npm install @react-native-voice/voice
//    - Requires native linking and microphone permissions
//
// 2. expo-speech-recognition (community)
//    - Expo-compatible wrapper
//    - May have limited platform support
//
// The functions below are placeholders that maintain the expected interface
// so the UI can be built and tested. Replace with real implementation
// when a STT library is integrated.

// STT state
let listening = false;
let onResultCallback: ((text: string) => void) | null = null;
let onErrorCallback: ((error: string) => void) | null = null;

/**
 * Start listening for speech input.
 *
 * PLACEHOLDER: This is a stub. Real implementation requires
 * @react-native-voice/voice or similar native STT library.
 *
 * @param onResult - Callback invoked with recognized text
 * @param onError - Callback invoked if recognition fails
 */
export function startListening(
  onResult: (text: string) => void,
  onError?: (error: string) => void
): void {
  if (listening) {
    console.warn('[Voice] Already listening');
    return;
  }

  listening = true;
  onResultCallback = onResult;
  onErrorCallback = onError ?? null;

  console.log(
    '[Voice] STT started (placeholder). Install @react-native-voice/voice for real speech recognition.'
  );

  // Simulate a timeout to show the placeholder is active
  // In real implementation, this would start the native speech recognizer
  setTimeout(() => {
    if (listening && onErrorCallback) {
      onErrorCallback(
        'Speech recognition is not available. Install @react-native-voice/voice to enable this feature.'
      );
      listening = false;
    }
  }, 2000);
}

/**
 * Stop listening for speech input.
 *
 * PLACEHOLDER: This is a stub.
 */
export function stopListening(): void {
  if (!listening) {
    return;
  }

  listening = false;
  onResultCallback = null;
  onErrorCallback = null;

  console.log('[Voice] STT stopped (placeholder)');
}

/**
 * Check if the STT engine is currently listening.
 */
export function isListening(): boolean {
  return listening;
}
