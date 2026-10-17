/**
 * Converts spoken punctuation words into actual punctuation symbols.
 * Handles common punctuation commands with word boundaries to avoid
 * replacing ordinary speech.
 */
export function formatSpokenPunctuation(rawText: string): string {
  if (!rawText) return '';

  let text = rawText;

  // Replacements with regex word boundaries (\b)
  const rules: [RegExp, string][] = [
    [/\b(full stop|period)\b/gi, '.'],
    [/\bcomma\b/gi, ','],
    [/\bquestion mark\b/gi, '?'],
    [/\b(exclamation mark|exclamation point)\b/gi, '!'],
    [/\bcolon\b/gi, ':'],
    [/\bsemicolon\b/gi, ';'],
    [/\b(hyphen|dash)\b/gi, '-'],
    [/\bnew line\b/gi, '\n'],
    [/\bnew paragraph\b/gi, '\n\n'],
  ];

  for (const [regex, replacement] of rules) {
    text = text.replace(regex, replacement);
  }

  // Clean up spacing around punctuation:
  // e.g. "word ." -> "word."
  text = text.replace(/\s+([.,!?:;])/g, '$1');

  // Ensure space after punctuation if followed by a letter/digit
  text = text.replace(/([.,!?:;])([A-Za-z0-9])/g, '$1 $2');

  // Capitalize sentence beginnings
  text = text.replace(/(?:^|[.!?]\s+)([a-z])/g, (match, letter) =>
    match.slice(0, -1) + letter.toUpperCase()
  );

  return text;
}

export const SUPPORTED_LANGUAGES = [
  { code: 'en-US', label: 'English (United States)', nativeName: 'English (US)', flag: '🇺🇸' },
  { code: 'en-IN', label: 'English (India)', nativeName: 'English (India)', flag: '🇮🇳' },
  { code: 'ta-IN', label: 'Tamil (India)', nativeName: 'தமிழ்', flag: '🇮🇳' },
  { code: 'hi-IN', label: 'Hindi (India)', nativeName: 'हिन्दी', flag: '🇮🇳' },
  { code: 'es-ES', label: 'Spanish (Spain)', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'fr-FR', label: 'French (France)', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'de-DE', label: 'German (Germany)', nativeName: 'Deutsch', flag: '🇩🇪' },
];
