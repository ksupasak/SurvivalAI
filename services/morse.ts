/**
 * Morse Code Encoding/Decoding Service
 *
 * Converts text to Morse code and vice versa.
 * Generates precise timing sequences for flashlight signaling.
 */

import {
  CHAR_TO_MORSE,
  MORSE_TO_CHAR,
  MORSE_TIMING,
  wpmToUnitMs,
} from '@/constants/morse-code';

export type TimingElement = {
  type: 'on' | 'off';
  duration: number; // in milliseconds
};

/**
 * Convert a text string to its Morse code representation.
 * Letters are separated by spaces, words are separated by ' / '.
 * Unknown characters are silently skipped.
 *
 * @param text - The text to encode
 * @returns Morse code string using dots (.) and dashes (-)
 */
export function textToMorse(text: string): string {
  const upper = text.toUpperCase();
  const words = upper.split(/\s+/);

  const morseWords = words.map((word) => {
    const morseChars: string[] = [];
    for (const char of word) {
      const morse = CHAR_TO_MORSE[char];
      if (morse && morse !== '/') {
        morseChars.push(morse);
      }
    }
    return morseChars.join(' ');
  });

  return morseWords.filter((w) => w.length > 0).join(' / ');
}

/**
 * Convert a Morse code string back to text.
 * Expects letters separated by spaces and words separated by ' / '.
 *
 * @param morse - Morse code string to decode
 * @returns Decoded text in uppercase
 */
export function morseToText(morse: string): string {
  const words = morse.split(' / ');

  const textWords = words.map((word) => {
    const chars = word.trim().split(/\s+/);
    return chars
      .map((code) => MORSE_TO_CHAR[code] || '')
      .join('');
  });

  return textWords.join(' ');
}

/**
 * Generate a precise on/off timing sequence for flashlight signaling.
 *
 * The sequence follows standard Morse timing:
 * - Dot: 1 unit ON
 * - Dash: 3 units ON
 * - Intra-character gap: 1 unit OFF (between dots/dashes within a letter)
 * - Inter-character gap: 3 units OFF (between letters)
 * - Inter-word gap: 7 units OFF (between words)
 *
 * @param text - The text to convert to a timing sequence
 * @param wpm - Words per minute (controls speed)
 * @returns Array of on/off timing elements with durations in milliseconds
 */
export function textToTimingSequence(text: string, wpm: number): TimingElement[] {
  const unitMs = wpmToUnitMs(wpm);
  const sequence: TimingElement[] = [];
  const upper = text.toUpperCase();
  const words = upper.split(/\s+/);

  for (let wordIndex = 0; wordIndex < words.length; wordIndex++) {
    const word = words[wordIndex];

    for (let charIndex = 0; charIndex < word.length; charIndex++) {
      const char = word[charIndex];
      const morse = CHAR_TO_MORSE[char];

      if (!morse || morse === '/') {
        continue;
      }

      // Process each dot/dash in the character's morse code
      for (let symbolIndex = 0; symbolIndex < morse.length; symbolIndex++) {
        const symbol = morse[symbolIndex];

        // ON for dot or dash
        if (symbol === '.') {
          sequence.push({ type: 'on', duration: MORSE_TIMING.DOT * unitMs });
        } else if (symbol === '-') {
          sequence.push({ type: 'on', duration: MORSE_TIMING.DASH * unitMs });
        }

        // Intra-character gap (between symbols within a character)
        if (symbolIndex < morse.length - 1) {
          sequence.push({ type: 'off', duration: MORSE_TIMING.INTRA_CHAR * unitMs });
        }
      }

      // Inter-character gap (between characters within a word)
      if (charIndex < word.length - 1) {
        sequence.push({ type: 'off', duration: MORSE_TIMING.INTER_CHAR * unitMs });
      }
    }

    // Inter-word gap (between words)
    if (wordIndex < words.length - 1) {
      sequence.push({ type: 'off', duration: MORSE_TIMING.INTER_WORD * unitMs });
    }
  }

  return sequence;
}

/**
 * Generate a quick SOS timing sequence.
 * SOS is the international distress signal: ... --- ...
 *
 * @param wpm - Words per minute (controls speed)
 * @returns Array of on/off timing elements for the SOS signal
 */
export function generateSOSSequence(wpm: number): TimingElement[] {
  return textToTimingSequence('SOS', wpm);
}
