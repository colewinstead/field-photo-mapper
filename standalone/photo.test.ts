import { describe, expect, it } from 'vitest';
import { normalizeExifReaderMetadata, normalizeExifrMetadata } from './metadata';

describe('standalone metadata normalization', () => {
  it('normalizes exifr GPS and Date values', () => {
    expect(
      normalizeExifrMetadata({ latitude: 40.5, longitude: -89.25, DateTimeOriginal: new Date('2026-01-02T03:04:05Z') })
    ).toEqual({ latitude: 40.5, longitude: -89.25, dateTaken: '2026-01-02T03:04:05.000Z' });
  });

  it('normalizes ExifReader expanded GPS and date values', () => {
    expect(
      normalizeExifReaderMetadata({
        gps: { Latitude: 40.5, Longitude: -89.25 },
        exif: { DateTimeOriginal: { description: '2026:01:02 03:04:05' } }
      })
    ).toEqual({ latitude: 40.5, longitude: -89.25, dateTaken: '2026-01-02T03:04:05' });
  });

  it('returns empty metadata for malformed parser output', () => {
    expect(normalizeExifrMetadata(undefined)).toEqual({});
    expect(normalizeExifReaderMetadata('bad')).toEqual({});
  });
});
