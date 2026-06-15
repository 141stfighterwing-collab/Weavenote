export interface OptimizedImageResult {
  dataUrl: string;
  width: number;
  height: number;
  originalBytes: number;
  optimizedBytes: number;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

export async function optimizeImageForNote(file: File): Promise<OptimizedImageResult> {
  const img = await loadImage(file);

  const maxDimension = 1600;
  const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas unavailable for image optimization');
  }

  ctx.drawImage(img, 0, 0, width, height);

  const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const quality = outputType === 'image/png' ? undefined : 0.82;
  const dataUrl = canvas.toDataURL(outputType, quality);
  const optimizedBytes = Math.round((dataUrl.length * 3) / 4);

  return {
    dataUrl,
    width,
    height,
    originalBytes: file.size,
    optimizedBytes,
  };
}

export function buildResizableImageHtml(dataUrl: string, fileName: string, width: number, height: number): string {
  const safeName = fileName.replace(/"/g, '&quot;');
  return `<img src="${dataUrl}" alt="${safeName}" data-wsh-image="true" data-original-width="${width}" data-original-height="${height}" style="max-width:100%;width:min(${width}px,100%);height:auto;resize:both;overflow:auto;display:block;border-radius:8px;margin:8px 0;cursor:default;" />`;
}
