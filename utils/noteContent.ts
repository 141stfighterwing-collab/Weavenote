const IMG_TAG_REGEX = /<img\b[^>]*src=["']([^"']+)["'][^>]*>/gi;
const BROKEN_IMG_LINE_REGEX = /<img\b[^\n>]*\nsrc=["']([^"'\n]+)["'][^\n>]*/gi;
const MARKDOWN_IMAGE_REGEX = /!\[[^\]]*\]\([^\)]+\)/gi;

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
