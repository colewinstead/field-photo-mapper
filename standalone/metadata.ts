import type { PhotoMetadata } from './types';

export function normalizeExifrMetadata(tags: unknown): PhotoMetadata {
  if (!tags || typeof tags !== 'object') return {};
  const values = tags as Record<string, unknown>;
  return {
    latitude: finiteNumber(values.latitude ?? values.GPSLatitude),
    longitude: finiteNumber(values.longitude ?? values.GPSLongitude),
    dateTaken: normalizeDate(
      values.DateTimeOriginal ?? values.CreateDate ?? values.ModifyDate ?? values.DateTime
    )
  };
}

export function normalizeExifReaderMetadata(tags: unknown): PhotoMetadata {
  if (!tags || typeof tags !== 'object') return {};
  const values = tags as Record<string, unknown>;
  const gps = objectValue(values.gps);
  const exif = objectValue(values.exif);

  return {
    latitude: finiteNumber(tagValue(gps.Latitude) ?? tagValue(values.GPSLatitude)),
    longitude: finiteNumber(tagValue(gps.Longitude) ?? tagValue(values.GPSLongitude)),
    dateTaken: normalizeDate(
      tagValue(exif.DateTimeOriginal) ??
        tagValue(values.DateTimeOriginal) ??
        tagValue(exif.CreateDate) ??
        tagValue(values.CreateDate) ??
        tagValue(values.ModifyDate)
    )
  };
}

function tagValue(tag: unknown) {
  if (!tag || typeof tag !== 'object') return tag;
  const value = tag as Record<string, unknown>;
  return value.value ?? value.description;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function normalizeDate(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw instanceof Date) return Number.isNaN(raw.valueOf()) ? undefined : raw.toISOString();
  if (typeof raw !== 'string' && typeof raw !== 'number') return undefined;
  const text = String(raw).trim();
  if (!text) return undefined;
  const exifMatch = text.match(/^(\d{4}):(\d{2}):(\d{2})[ T](.*)$/);
  return exifMatch ? `${exifMatch[1]}-${exifMatch[2]}-${exifMatch[3]}T${exifMatch[4]}` : text;
}

function finiteNumber(value: unknown) {
  const raw = Array.isArray(value) && value.length === 1 ? value[0] : value;
  const number = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : Number.NaN;
  return Number.isFinite(number) ? number : undefined;
}
