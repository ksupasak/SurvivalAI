// International Morse Code lookup
export const CHAR_TO_MORSE: Record<string, string> = {
  'A': '.-',    'B': '-...',  'C': '-.-.',  'D': '-..',
  'E': '.',     'F': '..-.',  'G': '--.',   'H': '....',
  'I': '..',    'J': '.---',  'K': '-.-',   'L': '.-..',
  'M': '--',    'N': '-.',    'O': '---',   'P': '.--.',
  'Q': '--.-',  'R': '.-.',   'S': '...',   'T': '-',
  'U': '..-',   'V': '...-',  'W': '.--',   'X': '-..-',
  'Y': '-.--',  'Z': '--..',
  '0': '-----', '1': '.----', '2': '..---', '3': '...--',
  '4': '....-', '5': '.....', '6': '-....', '7': '--...',
  '8': '---..', '9': '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', '!': '-.-.--',
  '/': '-..-.',  '(': '-.--.',  ')': '-.--.-', '&': '.-...',
  ':': '---...', ';': '-.-.-.', '=': '-...-',  '+': '.-.-.',
  '-': '-....-', '_': '..--.-', '"': '.-..-.', '$': '...-..-',
  '@': '.--.-.', ' ': '/',
};

export const MORSE_TO_CHAR: Record<string, string> = Object.fromEntries(
  Object.entries(CHAR_TO_MORSE)
    .filter(([key]) => key !== ' ')
    .map(([key, value]) => [value, key])
);

// Timing constants (in units, where 1 unit = base time at given WPM)
export const MORSE_TIMING = {
  DOT: 1,           // Duration of a dot
  DASH: 3,          // Duration of a dash
  INTRA_CHAR: 1,    // Gap between dots/dashes within a character
  INTER_CHAR: 3,    // Gap between characters
  INTER_WORD: 7,    // Gap between words
};

// Convert WPM to unit duration in milliseconds
// Standard PARIS timing: "PARIS" = 50 units, so 1 WPM = 1200ms per unit
export function wpmToUnitMs(wpm: number): number {
  return 1200 / wpm;
}

// Quick access patterns
export const QUICK_MESSAGES: { label: string; text: string; icon: string }[] = [
  { label: 'SOS', text: 'SOS', icon: 'alert-circle' },
  { label: 'HELP', text: 'HELP', icon: 'hand-left' },
  { label: 'WATER', text: 'WATER', icon: 'water' },
  { label: 'FOOD', text: 'FOOD', icon: 'fast-food' },
  { label: 'MEDICAL', text: 'MEDICAL', icon: 'medkit' },
  { label: 'YES', text: 'YES', icon: 'checkmark-circle' },
  { label: 'NO', text: 'NO', icon: 'close-circle' },
  { label: 'OK', text: 'OK', icon: 'thumbs-up' },
];
