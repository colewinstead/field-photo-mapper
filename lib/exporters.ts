import { promises as fs } from 'fs';
import path from 'path';
import JSZip from 'jszip';
import type { JobManifest, KmzExportOptions, PhotoRecord } from './types';

export function csvForPhotos(photos: PhotoRecord[]) {
  const headers = [
    'filename',
    'status',
    'date_taken',
    'latitude',
    'longitude',
    'error',
    'size_bytes',
    'mime_type'
  ];

  const rows = photos.map((photo) => [
    photo.filename,
    photo.status,
    photo.dateTaken ?? '',
    photo.latitude?.toString() ?? '',
    photo.longitude?.toString() ?? '',
    photo.error ?? '',
    photo.size.toString(),
    photo.mimeType
  ]);

  return [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\r\n') + '\r\n';
}

export async function kmzForManifest(manifest: JobManifest, options: KmzExportOptions) {
  const zip = new JSZip();
  const mappedPhotos = manifest.photos.filter(
    (photo) => photo.status === 'mapped' && typeof photo.latitude === 'number' && typeof photo.longitude === 'number'
  );

  const mediaFolder = zip.folder(options.mediaFolder);
  for (const photo of mappedPhotos) {
    if (!photo.thumbnailPath) continue;
    const thumbnail = await fs.readFile(photo.thumbnailPath).catch(() => null);
    if (thumbnail) {
      mediaFolder?.file(thumbnailName(photo), thumbnail);
    }
  }

  zip.file('doc.kml', kmlForPhotos(mappedPhotos, options));
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

export async function kmlPackageForManifest(manifest: JobManifest, options: KmzExportOptions, filename: string) {
  const zip = new JSZip();
  const mappedPhotos = manifest.photos.filter(
    (photo) => photo.status === 'mapped' && typeof photo.latitude === 'number' && typeof photo.longitude === 'number'
  );

  const mediaFolder = zip.folder(options.mediaFolder);
  for (const photo of mappedPhotos) {
    if (!photo.thumbnailPath) continue;
    const thumbnail = await fs.readFile(photo.thumbnailPath).catch(() => null);
    if (thumbnail) {
      mediaFolder?.file(thumbnailName(photo), thumbnail);
    }
  }

  zip.file(`${filename}.kml`, kmlForPhotos(mappedPhotos, options));
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

function kmlForPhotos(photos: PhotoRecord[], options: KmzExportOptions) {
  const placemarks = photos.map((photo, index) => {
    const thumb = photo.thumbnailPath
      ? `<img src="${escapeXml(options.mediaFolder)}/${escapeXml(thumbnailName(photo))}" width="${options.previewWidth}" /><br/>`
      : '';
    const pinName = placemarkName(photo, index, options.nameMode);
    const description = [
      '<![CDATA[',
      thumb,
      `<strong>${escapeHtml(photo.filename)}</strong><br/>`,
      photo.dateTaken ? `Date taken: ${escapeHtml(photo.dateTaken)}<br/>` : '',
      `Latitude: ${photo.latitude}<br/>`,
      `Longitude: ${photo.longitude}`,
      ']]>'
    ].join('');

    return `
    <Placemark>
      <name>${escapeXml(pinName)}</name>
      <styleUrl>#photoPin</styleUrl>
      <description>${description}</description>
      <ExtendedData>
        <Data name="filename"><value>${escapeXml(photo.filename)}</value></Data>
        <Data name="date_taken"><value>${escapeXml(photo.dateTaken ?? '')}</value></Data>
        <Data name="latitude"><value>${photo.latitude}</value></Data>
        <Data name="longitude"><value>${photo.longitude}</value></Data>
      </ExtendedData>
      <Point>
        <coordinates>${photo.longitude},${photo.latitude},0</coordinates>
      </Point>
    </Placemark>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Field Photo Mapper Export</name>
    <Style id="photoPin">
      <IconStyle>
        <scale>${options.pinScale}</scale>
        <Icon>
          <href>${escapeXml(pinHref(options.pinColor))}</href>
        </Icon>
      </IconStyle>
    </Style>
    ${placemarks.join('\n')}
  </Document>
</kml>
`;
}

function thumbnailName(photo: PhotoRecord) {
  return `${path.parse(photo.storedFilename).name}.jpg`;
}

function placemarkName(photo: PhotoRecord, index: number, mode: KmzExportOptions['nameMode']) {
  if (mode === 'date_filename') {
    return photo.dateTaken ? `${photo.dateTaken} - ${photo.filename}` : photo.filename;
  }

  if (mode === 'sequence_filename') {
    return `${String(index + 1).padStart(3, '0')} - ${photo.filename}`;
  }

  if (mode === 'coordinates') {
    return typeof photo.latitude === 'number' && typeof photo.longitude === 'number'
      ? `${photo.latitude.toFixed(6)}, ${photo.longitude.toFixed(6)}`
      : photo.filename;
  }

  return photo.filename;
}

function pinHref(color: KmzExportOptions['pinColor']) {
  const fileByColor = {
    red: 'red-pushpin.png',
    blue: 'blue-pushpin.png',
    green: 'grn-pushpin.png',
    yellow: 'ylw-pushpin.png',
    purple: 'purple-pushpin.png'
  };

  return `http://maps.google.com/mapfiles/kml/pushpin/${fileByColor[color]}`;
}

function csvEscape(value: string) {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
