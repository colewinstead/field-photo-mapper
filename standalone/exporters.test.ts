import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import type { KmzExportOptions } from '../lib/types';
import { csvForPhotos, downloadBaseFilename, kmlForPhotos, kmzForPhotos } from './exporters';
import type { BrowserPhotoRecord } from './types';

const options: KmzExportOptions = {
  pinColor: 'blue',
  pinScale: 1.3,
  nameMode: 'sequence_filename',
  previewWidth: 640,
  mediaFolder: 'files'
};

const mapped: BrowserPhotoRecord = {
  id: 'photo-1',
  filename: 'A&B, "field".jpg',
  mimeType: 'image/jpeg',
  size: 100,
  status: 'mapped',
  dateTaken: '2026-01-02T03:04:05',
  latitude: 40.1234567,
  longitude: -89.7654321,
  exportJpeg: new Blob(['jpeg'], { type: 'image/jpeg' })
};

describe('standalone exporters', () => {
  it('escapes CSV values and retains missing GPS rows', () => {
    const csv = csvForPhotos([
      mapped,
      { ...mapped, id: 'photo-2', filename: 'plain.jpg', status: 'missing_gps', latitude: undefined, longitude: undefined }
    ]);
    expect(csv).toContain('"A&B, ""field"".jpg"');
    expect(csv).toContain('plain.jpg,missing_gps');
  });

  it('creates mapped placemarks with escaped XML and selected styles', () => {
    const kml = kmlForPhotos([mapped], options);
    expect(kml).toContain('<name>001 - A&amp;B, &quot;field&quot;.jpg</name>');
    expect(kml).toContain('<scale>1.3</scale>');
    expect(kml).toContain('blue-pushpin.png');
    expect(kml).toContain('<coordinates>-89.7654321,40.1234567,0</coordinates>');
  });

  it('omits non-mapped photos from KML', () => {
    const kml = kmlForPhotos([{ ...mapped, status: 'missing_gps' }], options);
    expect(kml).not.toContain('<Placemark>');
  });

  it('packages doc.kml and mapped JPEGs in a KMZ', async () => {
    const blob = await kmzForPhotos([mapped], options);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    expect(zip.file('doc.kml')).not.toBeNull();
    expect(zip.file('files/photo-1-A_B_field_.jpg')).not.toBeNull();
  });

  it('sanitizes download filenames', () => {
    expect(downloadBaseFilename(' my/map.kmz ')).toBe('my_map');
    expect(downloadBaseFilename('***')).toBe('field-photo-map');
  });
});
