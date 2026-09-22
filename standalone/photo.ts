import ExifReader from 'exifreader';
import exifr from 'exifr';
import decode from 'heic-decode';
import { normalizeExifReaderMetadata, normalizeExifrMetadata } from './metadata';
import type { BrowserPhotoRecord, PhotoMetadata } from './types';

const heicDecodeTimeoutMs = 60000;

export async function processPhoto(file: File): Promise<BrowserPhotoRecord> {
  const id = makeId();
  const base = {
    id,
    filename: file.name,
    mimeType: file.type || mimeFromFilename(file.name),
    size: file.size
  };

  let metadata: PhotoMetadata = {};
  let metadataError: string | undefined;
  try {
    metadata = await readPhotoMetadata(file);
  } catch (error) {
    metadataError = messageFor(error, 'Unable to read photo metadata');
  }

  let previews: { thumbnailUrl: string; exportJpeg: Blob } | undefined;
  let previewError: string | undefined;
  try {
    previews = await createPreviews(file);
  } catch (error) {
    previewError = messageFor(error, 'Unable to create photo preview');
  }

  if (typeof metadata.latitude === 'number' && typeof metadata.longitude === 'number') {
    return {
      ...base,
      ...metadata,
      ...previews,
      status: 'mapped',
      warning: previewError ? `Preview unavailable: ${previewError}` : undefined
    };
  }

  if (metadataError && !previews) {
    return {
      ...base,
      status: 'error',
      error: metadataError
    };
  }

  return {
    ...base,
    ...metadata,
    ...previews,
    status: 'missing_gps',
    error: 'No GPS coordinates found',
    warning: previewError ? `Preview unavailable: ${previewError}` : undefined
  };
}

export async function readPhotoMetadata(file: File): Promise<PhotoMetadata> {
  let primaryError: unknown;
  let primary: PhotoMetadata = {};

  try {
    const tags = await exifr.parse(file, {
      gps: true,
      tiff: true,
      exif: true,
      xmp: true,
      translateValues: true,
      reviveValues: true
    });
    primary = normalizeExifrMetadata(tags);
    if (!isHeic(file.name) || hasCoordinates(primary)) return primary;
  } catch (error) {
    primaryError = error;
    if (!isHeic(file.name)) throw error;
  }

  try {
    const tags = await ExifReader.load(file, { expanded: true });
    const fallback = normalizeExifReaderMetadata(tags as unknown);
    return {
      latitude: fallback.latitude ?? primary.latitude,
      longitude: fallback.longitude ?? primary.longitude,
      dateTaken: primary.dateTaken ?? fallback.dateTaken
    };
  } catch (fallbackError) {
    if (hasUsefulMetadata(primary)) return primary;
    throw new Error(
      `HEIC metadata could not be read: ${messageFor(fallbackError, messageFor(primaryError, 'unsupported metadata'))}`
    );
  }
}

export function revokePhotoUrls(photos: BrowserPhotoRecord[]) {
  for (const photo of photos) {
    if (photo.thumbnailUrl) URL.revokeObjectURL(photo.thumbnailUrl);
  }
}

async function createPreviews(file: File) {
  const source = isHeic(file.name) ? await canvasForHeic(file) : await canvasForBrowserImage(file);
  const exportJpeg = await resizedJpeg(source, 900, 675, 'inside', 0.82);
  const thumbnail = await resizedJpeg(source, 260, 180, 'cover', 0.7);
  source.width = 1;
  source.height = 1;

  return {
    exportJpeg,
    thumbnailUrl: URL.createObjectURL(thumbnail)
  };
}

async function canvasForHeic(file: File) {
  const buffer = new Uint8Array(await file.arrayBuffer());
  const decoded = await withTimeout(
    decode({ buffer }),
    heicDecodeTimeoutMs,
    'HEIC decoding timed out after 60 seconds'
  );
  const canvas = document.createElement('canvas');
  canvas.width = decoded.width;
  canvas.height = decoded.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable');
  const pixels = new Uint8ClampedArray(decoded.data.length);
  pixels.set(decoded.data);
  context.putImageData(new ImageData(pixels, decoded.width, decoded.height), 0, 0);
  return canvas;
}

async function canvasForBrowserImage(file: File) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new Error('Canvas is unavailable');
  }
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
}

async function resizedJpeg(
  source: HTMLCanvasElement,
  maxWidth: number,
  maxHeight: number,
  fit: 'inside' | 'cover',
  quality: number
) {
  const sourceRatio = source.width / source.height;
  const targetRatio = maxWidth / maxHeight;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = source.width;
  let sourceHeight = source.height;
  let outputWidth: number;
  let outputHeight: number;

  if (fit === 'cover') {
    outputWidth = maxWidth;
    outputHeight = maxHeight;
    if (sourceRatio > targetRatio) {
      sourceWidth = source.height * targetRatio;
      sourceX = (source.width - sourceWidth) / 2;
    } else {
      sourceHeight = source.width / targetRatio;
      sourceY = (source.height - sourceHeight) / 2;
    }
  } else {
    const scale = Math.min(1, maxWidth / source.width, maxHeight / source.height);
    outputWidth = Math.max(1, Math.round(source.width * scale));
    outputHeight = Math.max(1, Math.round(source.height * scale));
  }

  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable');
  context.drawImage(
    source,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    outputWidth,
    outputHeight
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('JPEG encoding failed'))),
      'image/jpeg',
      quality
    );
  });
}

function hasUsefulMetadata(metadata: PhotoMetadata) {
  return (
    (typeof metadata.latitude === 'number' && typeof metadata.longitude === 'number') ||
    Boolean(metadata.dateTaken)
  );
}

function hasCoordinates(metadata: PhotoMetadata) {
  return typeof metadata.latitude === 'number' && typeof metadata.longitude === 'number';
}

function makeId() {
  if ('randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function isHeic(filename: string) {
  return /\.(heic|heif)$/i.test(filename);
}

function mimeFromFilename(filename: string) {
  if (/\.heic$/i.test(filename)) return 'image/heic';
  if (/\.heif$/i.test(filename)) return 'image/heif';
  return 'image/jpeg';
}

function messageFor(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      }
    );
  });
}
