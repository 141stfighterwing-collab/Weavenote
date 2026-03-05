// @ts-ignore
import { defaultSchema } from 'rehype-sanitize';

/**
 * Custom sanitization schema for rehype-sanitize.
 * We extend the default schema to allow:
 * - <mark> tags with the 'style' attribute (used for highlighting in NotebookView)
 * - <input> tags with necessary attributes for task lists
 */
export const customSanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema?.tagNames || []), 'mark', 'input', 'img'],
  protocols: {
    ...(defaultSchema?.protocols || {}),
    src: ['http', 'https', 'data']
  },
  attributes: {
    ...defaultSchema?.attributes,
    mark: ['style'],
    input: ['type', 'disabled', 'checked'],
    img: ['src', 'alt', 'title', 'width', 'height']
  }
};
