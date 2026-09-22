import JSZip from 'jszip';
import type { KmzExportOptions } from '../lib/types';
import type { BrowserPhotoRecord } from './types';

export function csvForPhotos(photos: BrowserPhotoRecord[]) {
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
    photo.error ?? photo.warning ?? '',
    photo.size.toString(),
    photo.mimeType
  ]);
  return [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\r\n') + '\r\n';
}

export function kmlForPhotos(photos: BrowserPhotoRecord[], options: KmzExportOptions) {
  const mappedPhotos = photos.filter(isMapped);
  const placemarks = mappedPhotos.map((photo, index) => {
    const mediaName = photo.exportJpeg ? thumbnailName(photo) : undefined;
    const thumbnail = mediaName
      ? `<img src="${escapeXml(options.mediaFolder)}/${escapeXml(mediaName)}" width="${options.previewWidth}" /><br/>`
      : '';
    const description = [
      '<![CDATA[',
      thumbnail,
      `<strong>${escapeHtml(photo.filename)}</strong><br/>`,
      photo.dateTaken ? `Date taken: ${escapeHtml(photo.dateTaken)}<br/>` : '',
      `Latitude: ${photo.latitude}<br/>`,
      `Longitude: ${photo.longitude}`,
      ']]>'
    ].join('');

    return `
    <Placemark>
      <name>${escapeXml(placemarkName(photo, index, options.nameMode))}</name>
      <styleUrl>#photoPin</styleUrl>
      <description>${description}</description>
      <ExtendedData>
        <Data name="filename"><value>${escapeXml(photo.filename)}</value></Data>
        <Data name="date_taken"><value>${escapeXml(photo.dateTaken ?? '')}</value></Data>
        <Data name="latitude"><value>${photo.latitude}</value></Data>
        <Data name="longitude"><value>${photo.longitude}</value></Data>
      </ExtendedData>
      <Point><coordinates>${photo.longitude},${photo.latitude},0</coordinates></Point>
    </Placemark>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Field Photo Mapper Export</name>
    <Style id="photoPin">
      <IconStyle>
        <scale>${options.pinScale}</scale>
        <Icon><href>${escapeXml(pinHref(options.pinColor))}</href></Icon>
      </IconStyle>
    </Style>
    ${placemarks.join('\n')}
  </Document>
</kml>
`;
}

export async function kmzForPhotos(photos: BrowserPhotoRecord[], options: KmzExportOptions) {
  const zip = new JSZip();
  await addPhotos(zip, photos, options.mediaFolder);
  zip.file('doc.kml', kmlForPhotos(photos, options));
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

export async function kmlPackageForPhotos(
  photos: BrowserPhotoRecord[],
  options: KmzExportOptions,
  filename: string
) {
  const zip = new JSZip();
  await addPhotos(zip, photos, options.mediaFolder);
  zip.file(`${filename}.kml`, kmlForPhotos(photos, options));
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

export function downloadBaseFilename(value: string) {
  const trimmed = value.trim();
  const sanitized = trimmed
    .replace(/\.(kmz|kml|zip)$/i, '')
    .replace(/[^a-z0-9._ -]+/gi, '_')
    .replace(/^[._ -]+|[._ -]+$/g, '')
    .slice(0, 120);
  return sanitized || 'field-photo-map';
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function addPhotos(zip: JSZip, photos: BrowserPhotoRecord[], folderName: string) {
  const folder = zip.folder(folderName);
  for (const photo of photos.filter(isMapped)) {
    if (photo.exportJpeg) folder?.file(thumbnailName(photo), photo.exportJpeg);
  }
}

function isMapped(photo: BrowserPhotoRecord) {
  return (
    photo.status === 'mapped' &&
    typeof photo.latitude === 'number' &&
    typeof photo.longitude === 'number'
  );
}

function thumbnailName(photo: BrowserPhotoRecord) {
  const stem = photo.filename.replace(/\.[^.]+$/, '').replace(/[^a-z0-9._-]+/gi, '_').slice(0, 80) || 'photo';
  return `${photo.id}-${stem}.jpg`;
}

function placemarkName(
  photo: BrowserPhotoRecord,
  index: number,
  mode: KmzExportOptions['nameMode']
) {
  if (mode === 'date_filename') return photo.dateTaken ? `${photo.dateTaken} - ${photo.filename}` : photo.filename;
  if (mode === 'sequence_filename') return `${String(index + 1).padStart(3, '0')} - ${photo.filename}`;
  if (mode === 'coordinates') return `${photo.latitude!.toFixed(6)}, ${photo.longitude!.toFixed(6)}`;
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
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
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
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
