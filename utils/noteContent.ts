const IMG_TAG_REGEX = /<img\b[^>]*src=["']([^"']+)["'][^>]*>/gi;
const BROKEN_IMG_LINE_REGEX = /<img\b[^\n>]*\nsrc=["']([^"'\n]+)["'][^\n>]*/gi;
const MARKDOWN_IMAGE_REGEX = /!\[[^\]]*\]\([^\)]+\)/gi;
const TASK_CHECKBOX_REGEX = /^(\s*(?:[-*+]|\d+\.)\s+\[)([ xX])(\])(?=\s|$)/gm;

export const normalizeNoteContentImages = (content: string): string => {
  if (!content) return '';

  let normalized = content.replace(BROKEN_IMG_LINE_REGEX, (_match, src: string) => `\n\n![](${src})\n\n`);
  normalized = normalized.replace(IMG_TAG_REGEX, (_match, src: string) => `\n\n![](${src})\n\n`);

  return normalized;
};

export const stripImagesFromNoteContent = (content: string): string => {
  if (!content) return '';

  return normalizeNoteContentImages(content)
    .replace(MARKDOWN_IMAGE_REGEX, '')
    .replace(IMG_TAG_REGEX, '');
};

export const toggleTaskCheckboxAtIndex = (content: string, checkboxIndex: number): string | null => {
  if (typeof content !== 'string' || !Number.isInteger(checkboxIndex) || checkboxIndex < 0) return null;

  let currentIndex = 0;
  let didToggle = false;

  const updatedContent = content.replace(
    TASK_CHECKBOX_REGEX,
    (_match, prefix: string, status: string, suffix: string) => {
      if (currentIndex !== checkboxIndex) {
        currentIndex += 1;
        return `${prefix}${status}${suffix}`;
      }

      currentIndex += 1;
      didToggle = true;
      const normalizedStatus = status.toLowerCase() === 'x' ? ' ' : 'x';
      return `${prefix}${normalizedStatus}${suffix}`;
    }
  );

  return didToggle ? updatedContent : null;
};
