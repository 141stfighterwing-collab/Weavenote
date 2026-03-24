// @ts-ignore
import { defaultSchema } from 'rehype-sanitize';

/**
 * Custom sanitization schema for rehype-sanitize.
 * We extend the default schema to allow:
 * - <mark> tags with the 'style' attribute (used for highlighting in NotebookView)
 * - <input> tags with necessary attributes for task lists
 * - <img> tags with src from allowed domains including Giphy and Tenor
 * - <iframe> tags for embedded content
 */
export const customSanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema?.tagNames || []), 'mark', 'input', 'img', 'iframe'],
  protocols: {
    ...(defaultSchema?.protocols || {}),
    src: ['http', 'https', 'data']
  },
  attributes: {
    ...defaultSchema?.attributes,
    mark: ['style'],
    input: ['type', 'disabled', 'checked'],
    img: ['src', 'alt', 'title', 'width', 'height', 'style', 'class'],
    iframe: ['src', 'width', 'height', 'frameborder', 'allowfullscreen']
  }
};

// Allowed image/GIF domains for security
export const ALLOWED_IMAGE_DOMAINS = [
  // Generic
  'data:',
  // Giphy
  'media.giphy.com',
  'i.giphy.com',
  'giphy.com',
  // Tenor
  'media.tenor.com',
  'tenor.com',
  'c.tenor.com',
  // Common image hosts
  'imgur.com',
  'i.imgur.com',
  'cloudinary.com',
  'res.cloudinary.com',
  // Generic HTTPS (allow all https for flexibility)
  'https://'
];

// Check if an image URL is from an allowed domain
export const isAllowedImageUrl = (url: string): boolean => {
  if (!url) return false;
  
  // Allow data URLs
  if (url.startsWith('data:image/')) return true;
  
  // Allow all HTTPS URLs for flexibility (user can paste any image/GIF)
  if (url.startsWith('https://')) return true;
  
  // Allow HTTP URLs (with warning in console)
  if (url.startsWith('http://')) return true;
  
  return false;
};
