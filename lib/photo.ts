import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import exifr from 'exifr';
import convert from 'heic-convert';
import sharp from 'sharp';
import { exiftool } from 'exiftool-vendored';
import type { PhotoRecord } from './types';

type ExifResult = {
  latitude?: number;
  longitude?: number;
  dateTaken?: string;
};

export function makeId() {
  return crypto.randomUUID();
}

export function safeFilename(filename: string) {
  const parsed = path.parse(filename);
  const name = parsed.name.replace(/[^a-z0-9._-]+/gi, '_').slice(0, 80) || 'photo';
  const ext = parsed.ext.replace(/[^a-z0-9.]+/gi, '').toLowerCase();
  return `${name}${ext || '.jpg'}`;
}

export async function saveUploadedFile(file: File, destinationDir: string) {
  const id = makeId();
  const storedFilename = `${id}-${safeFilename(file.name)}`;
  const originalPath = path.join(destinationDir, storedFilename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(originalPath, buffer);

  return {
    id,
    buffer,
    storedFilename,
    originalPath
  };
}

export async function readExif(buffer: Buffer, filePath: string, filename: string): Promise<ExifResult> {
  const tags = isHeic(filename)
    ? await readExifWithExiftool(filePath)
    : await exifr
        .parse(buffer, {
          gps: true,
          tiff: true,
          exif: true,
          xmp: true,
          translateValues: true,
          reviveValues: true
        })
        .catch(() => readExifWithExiftool(filePath));

  const latitude = asNumber(tags?.latitude ?? tags?.GPSLatitude);
  const longitude = asNumber(tags?.longitude ?? tags?.GPSLongitude);
  const dateValue = tags?.DateTimeOriginal ?? tags?.CreateDate ?? tags?.ModifyDate ?? tags?.DateTime;

  return {
    latitude,
    longitude,
    dateTaken: dateValue instanceof Date ? dateValue.toISOString() : dateValue ? String(dateValue) : undefined
  };
}

export async function createThumbnail(buffer: Buffer, destinationDir: string, id: string, filename: string) {
  const thumbnailPath = path.join(destinationDir, `${id}-thumb.jpg`);
  const imageBuffer = isHeic(filename) ? await heicToJpeg(buffer) : buffer;
  const image = sharp(imageBuffer, { failOn: 'none' }).rotate();
  const [exportThumbnail, displayThumbnail] = await Promise.all([
    withTimeout(
      image
        .clone()
        .resize({ width: 900, height: 675, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer(),
      30000
    ),
    withTimeout(
      image
        .clone()
        .resize({ width: 260, height: 180, fit: 'cover' })
        .jpeg({ quality: 68 })
        .toBuffer(),
      30000
    )
  ]);

  await fs.writeFile(thumbnailPath, exportThumbnail);

  return {
    thumbnailPath,
    thumbnailDataUrl: `data:image/jpeg;base64,${displayThumbnail.toString('base64')}`
  };
}

export async function buildPhotoRecord(file: File, destinationDir: string): Promise<PhotoRecord> {
  const saved = await saveUploadedFile(file, destinationDir);
  const baseRecord = {
    id: saved.id,
    filename: file.name,
    storedFilename: saved.storedFilename,
    originalPath: saved.originalPath,
    mimeType: file.type || 'application/octet-stream',
    size: file.size
  };

  try {
    const [exif, thumbnail] = await Promise.all([
      readExif(saved.buffer, saved.originalPath, file.name),
      createThumbnail(saved.buffer, destinationDir, saved.id, file.name).catch(() => undefined)
    ]);

    if (typeof exif.latitude !== 'number' || typeof exif.longitude !== 'number') {
      return {
        ...baseRecord,
        ...thumbnail,
        status: 'missing_gps',
        dateTaken: exif.dateTaken,
        error: 'No GPS coordinates found'
      };
    }

    return {
      ...baseRecord,
      ...thumbnail,
      status: 'mapped',
      dateTaken: exif.dateTaken,
      latitude: exif.latitude,
      longitude: exif.longitude
    };
  } catch (error) {
    return {
      ...baseRecord,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unable to read photo metadata'
    };
  }
}

function asNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

async function readExifWithExiftool(filePath: string): Promise<Record<string, unknown>> {
  const tags = await exiftool.read(filePath).catch(() => undefined);
  const dateValue =
    tags?.DateTimeOriginal ??
    tags?.CreateDate ??
    tags?.ModifyDate ??
    tags?.MediaCreateDate ??
    tags?.CreationDate;

  return {
    latitude: asNumber(tags?.GPSLatitude),
    longitude: asNumber(tags?.GPSLongitude),
    DateTimeOriginal: stringifyDateValue(dateValue)
  };
}

function stringifyDateValue(value: unknown) {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && 'toISOString' in value && typeof value.toISOString === 'function') {
    return value.toISOString();
  }
  return String(value);
}

function isHeic(filename: string) {
  return /\.(heic|heif)$/i.test(filename);
}

async function heicToJpeg(buffer: Buffer) {
  const output = await withTimeout(
    convert({
      buffer,
      format: 'JPEG',
      quality: 0.82
    }),
    30000
  );

  return Buffer.isBuffer(output) ? output : Buffer.from(new Uint8Array(output as ArrayBuffer | Uint8Array));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Image processing timed out')), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}
