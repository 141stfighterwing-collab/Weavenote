export const STOP_WORDS = new Set(['the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'in', 'it', 'to', 'for', 'of', 'with', 'as', 'by', 'from', 'that', 'but', 'or', 'not', 'are', 'be', 'this', 'will', 'can', 'if', 'has', 'have', 'had', 'was', 'were', 'been']);

const WORD_CLEANUP_REGEX = /[^\w\s]/g;
const WHITESPACE_REGEX = /\s+/;

/**
 * Extracts meaningful words from a text string.
 * - Converts to lowercase
 * - Removes non-alphanumeric characters (except spaces)
 * - Splits by whitespace
 * - Filters out stop words and short words (length <= 3)
 *
 * @param text The input text to process
 * @returns An array of filtered words
 */
export const getWords = (text: string | null | undefined): string[] => {
    if (!text) return [];

    return text.toLowerCase()
        .replace(WORD_CLEANUP_REGEX, '')
        .split(WHITESPACE_REGEX)
        .filter(w => w.length > 3 && !STOP_WORDS.has(w));
};
