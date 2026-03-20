/**
 * Random drop name generator using EFF Diceware wordlist
 * @see https://www.eff.org/deeplinks/2016/07/new-wordlists-random-passphrases
 */

import wordlist from './wordlist.json';

// The EFF Diceware wordlist contains 7776 memorable words
export const WORDS: readonly string[] = wordlist;

/**
 * Get a cryptographically secure random integer in range [0, max)
 */
function secureRandomInt(max: number): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0]! % max;
}

/**
 * Generate a random drop name from the EFF Diceware wordlist
 * @param wordCount - Number of words to include (default 4)
 * @returns A kebab-case name like "abacus-abide-ablaze-able"
 */
export function generateRandomDropName(wordCount: number = 4): string {
  const words: string[] = [];
  const availableWords = [...WORDS];

  for (let i = 0; i < wordCount && availableWords.length > 0; i++) {
    const index = secureRandomInt(availableWords.length);
    words.push(availableWords[index]!);
    // Remove to avoid duplicates (sampling without replacement)
    availableWords.splice(index, 1);
  }

  return words.join('-');
}

/**
 * Generate multiple unique drop name suggestions
 * @param count - Number of suggestions to generate
 * @param wordCount - Number of words per name
 * @returns Array of unique kebab-case names
 */
export function generateDropNameSuggestions(count: number = 4, wordCount: number = 4): string[] {
  const names = new Set<string>();

  while (names.size < count) {
    names.add(generateRandomDropName(wordCount));
  }

  return Array.from(names);
}
