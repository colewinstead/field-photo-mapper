/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PinColor, PinNameMode } from '../lib/types';
import PhotoMap from './PhotoMap';
import {
  csvForPhotos,
  downloadBaseFilename,
  kmlPackageForPhotos,
  kmzForPhotos,
  saveBlob
} from './exporters';
import { processPhoto, revokePhotoUrls } from './photo';
import type { BrowserPhotoRecord } from './types';

type UploadState = 'idle' | 'uploading' | 'ready' | 'error';
const maxPhotosPerProject = 50;

export default function App() {
  const photosRef = useRef<BrowserPhotoRecord[]>([]);
  const [state, setState] = useState<UploadState>('idle');
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState('Choose JPG or HEIC photos to extract GPS data locally.');
  const [photos, setPhotos] = useState<BrowserPhotoRecord[]>([]);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [mapStyle, setMapStyle] = useState<'streets' | 'satellite'>('satellite');
  const [exportName, setExportName] = useState('field-photo-map');
  const [pinColor, setPinColor] = useState<PinColor>('red');
  const [pinScale, setPinScale] = useState(1.1);
  const [nameMode, setNameMode] = useState<PinNameMode>('filename');
  const [previewWidth, setPreviewWidth] = useState(560);

  useEffect(
    () => () => {
      revokePhotoUrls(photosRef.current);
    },
    []
  );

  const counts = useMemo(() => {
    const mapped = photos.filter((photo) => photo.status === 'mapped').length;
    const missing = photos.filter((photo) => photo.status === 'missing_gps').length;
    const failed = photos.filter((photo) => photo.status === 'error').length;
    return { mapped, missing, failed };
  }, [photos]);

  const estimatedMb = useMemo(() => {
    const bytes = photos.reduce((sum, photo) => sum + (photo.exportJpeg?.size ?? 0), 0);
    return (bytes + 100 * 1024) / (1024 * 1024);
  }, [photos]);

  function replacePhotos(next: BrowserPhotoRecord[]) {
    photosRef.current = next;
    setPhotos(next);
  }

  async function uploadFiles(fileList: FileList | File[]) {
    const selected = Array.from(fileList);
    const invalid = selected.find((file) => !/\.(jpe?g|heic|heif)$/i.test(file.name));
    if (invalid) {
      setState('error');
      setMessage(`${invalid.name} is not a supported JPG, HEIC, or HEIF photo.`);
      return;
    }
    if (!selected.length) {
      setState('error');
      setMessage('Choose at least one JPG, HEIC, or HEIF photo.');
      return;
    }
    if (selected.length > maxPhotosPerProject) {
      setState('error');
      setMessage(`The portable version supports up to ${maxPhotosPerProject} photos at a time.`);
      return;
    }

    revokePhotoUrls(photosRef.current);
    replacePhotos([]);
    setState('uploading');
    setProgress({ completed: 0, total: selected.length });

    const processed: BrowserPhotoRecord[] = [];
    for (let index = 0; index < selected.length; index += 1) {
      const file = selected[index];
      setMessage(`Processing ${index + 1} of ${selected.length}: ${file.name}`);
      await yieldToBrowser();

      try {
        processed.push(await processPhoto(file));
      } catch (error) {
        processed.push({
          id: makeId(),
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unable to process photo'
        });
      }

      replacePhotos([...processed]);
      setProgress({ completed: index + 1, total: selected.length });
    }

    const mapped = processed.filter((photo) => photo.status === 'mapped').length;
    const missing = processed.filter((photo) => photo.status === 'missing_gps').length;
    const failed = processed.filter((photo) => photo.status === 'error').length;
    setState('ready');
    setMessage(`${mapped} mapped, ${missing} missing GPS, ${failed} failed. Files stayed on this device.`);
  }

  async function download(type: 'kmz' | 'kmlzip' | 'csv') {
    try {
      const baseName = downloadBaseFilename(exportName);
      if (type === 'csv') {
        saveBlob(new Blob([csvForPhotos(photos)], { type: 'text/csv;charset=utf-8' }), `${baseName}.csv`);
        return;
      }

      setMessage(`Building ${type === 'kmz' ? 'KMZ' : 'KML package'} locally...`);
      const options = {
        pinColor,
        pinScale: clamp(pinScale, 0.6, 2.2),
        nameMode,
        previewWidth: Math.round(clamp(previewWidth, 240, 1200)),
        mediaFolder: type === 'kmz' ? 'files' : 'photos'
      };

      if (type === 'kmz') {
        saveBlob(await kmzForPhotos(photos, options), `${baseName}.kmz`);
      } else {
        saveBlob(
          await kmlPackageForPhotos(photos, options, baseName),
          `${baseName}-kml-photos.zip`
        );
      }
      setMessage('Export ready. Files stayed on this device.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Export failed.');
    }
  }

  return (
    <main className="appShell">
      <header className="topBar">
        <div className="brand">
          <h1>Field Photo Mapper <span className="portableBadge">Portable</span></h1>
          <span>Geotagged photo review and map exports, processed entirely on this device</span>
        </div>
      </header>

      <section className="workspace">
        <aside className="sidePanel">
          <div className="uploadPanel">
            <label
              className={`dropZone ${dragging ? 'dragging' : ''}`}
              onDragEnter={() => setDragging(true)}
              onDragLeave={() => setDragging(false)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                void uploadFiles(event.dataTransfer.files);
              }}
            >
              <input
                className="hiddenInput"
                type="file"
                accept=".jpg,.jpeg,.heic,.heif,image/jpeg,image/heic,image/heif"
                multiple
                onChange={(event) => {
                  if (event.target.files) void uploadFiles(event.target.files);
                  event.currentTarget.value = '';
                }}
              />
              <span>
                <strong>Drop photos here or click to browse</strong>
                JPG, HEIC, and HEIF files are processed locally and never uploaded.
              </span>
            </label>
            <div className="betaNotice">
              Portable cap: 50 photos per project. Map tiles require internet; photo processing does not.
            </div>

            <div className="actions">
              <button className="button" disabled={counts.mapped === 0 || state === 'uploading'} onClick={() => void download('kmz')}>
                Download KMZ
              </button>
              <button className="button secondary" disabled={counts.mapped === 0 || state === 'uploading'} onClick={() => void download('kmlzip')}>
                KML + Photos
              </button>
              <button className="button secondary" disabled={photos.length === 0 || state === 'uploading'} onClick={() => void download('csv')}>
                Download CSV
              </button>
            </div>

            {counts.mapped > 0 && (
              <div className="recommendation">
                <div>
                  <b>{estimatedMb > 20 ? 'KML package recommended' : 'KMZ size looks manageable'}</b>
                  <span>Prepared image data: {estimatedMb.toFixed(1)} MB. KML + Photos keeps images in a separate folder.</span>
                </div>
              </div>
            )}

            {progress.total > 0 && (
              <div className="progressBlock" aria-label="Processing progress">
                <div className="progressMeta">
                  <span>{state === 'uploading' ? 'Processing' : 'Complete'}</span>
                  <b>{Math.round((progress.completed / progress.total) * 100)}%</b>
                </div>
                <div className="progressTrack">
                  <div className="progressFill" style={{ width: `${Math.round((progress.completed / progress.total) * 100)}%` }} />
                </div>
                <div className="progressCount">{progress.completed} of {progress.total} photos</div>
              </div>
            )}
            <p className="statusLine" aria-live="polite">{message}</p>
          </div>

          <div className="optionsPanel">
            <div className="optionHeader">Preview</div>
            <div className="segmented" aria-label="Map style">
              <button className={mapStyle === 'streets' ? 'selected' : ''} type="button" onClick={() => setMapStyle('streets')}>Streets</button>
              <button className={mapStyle === 'satellite' ? 'selected' : ''} type="button" onClick={() => setMapStyle('satellite')}>Satellite</button>
            </div>

            <div className="optionHeader">Map Export</div>
            <label className="fieldLabel">File name<input value={exportName} onChange={(event) => setExportName(event.target.value)} /></label>
            <label className="fieldLabel">
              Placemark names
              <select value={nameMode} onChange={(event) => setNameMode(event.target.value as PinNameMode)}>
                <option value="filename">Filename</option>
                <option value="date_filename">Date + filename</option>
                <option value="sequence_filename">Number + filename</option>
                <option value="coordinates">Coordinates</option>
              </select>
            </label>
            <label className="fieldLabel">Popup picture width<input type="number" min="240" max="1200" step="40" value={previewWidth} onChange={(event) => setPreviewWidth(Number(event.target.value))} /></label>
            <div className="optionGrid">
              <label className="fieldLabel">
                Pin color
                <select value={pinColor} onChange={(event) => setPinColor(event.target.value as PinColor)}>
                  <option value="red">Red</option><option value="blue">Blue</option><option value="green">Green</option><option value="yellow">Yellow</option><option value="purple">Purple</option>
                </select>
              </label>
              <label className="fieldLabel">Pin size<input type="number" min="0.6" max="2.2" step="0.1" value={pinScale} onChange={(event) => setPinScale(Number(event.target.value))} /></label>
            </div>
          </div>

          <div className="summary">
            <div className="metric"><b>{counts.mapped}</b><span>Mapped</span></div>
            <div className="metric"><b>{counts.missing}</b><span>No GPS</span></div>
            <div className="metric"><b>{counts.failed}</b><span>Errors</span></div>
          </div>

          <div className="photoList">
            {photos.map((photo) => (
              <article className="photoRow" key={photo.id}>
                {photo.thumbnailUrl ? <img src={photo.thumbnailUrl} alt="" /> : <div className="thumbFallback">No preview</div>}
                <div>
                  <p className="photoName">{photo.filename}</p>
                  <p className="photoMeta">
                    <span className={photo.status === 'mapped' ? 'ok' : photo.status === 'error' ? 'failed' : 'missing'}>
                      {photo.status === 'mapped' ? 'Mapped' : photo.status === 'missing_gps' ? 'Missing GPS' : 'Error'}
                    </span>
                    {photo.dateTaken ? ` | ${photo.dateTaken}` : ''}
                    {typeof photo.latitude === 'number' && typeof photo.longitude === 'number' ? ` | ${photo.latitude.toFixed(6)}, ${photo.longitude.toFixed(6)}` : ''}
                    {photo.error ? ` | ${photo.error}` : ''}
                    {photo.warning ? ` | ${photo.warning}` : ''}
                  </p>
                </div>
              </article>
            ))}
          </div>

          <details className="licenseNotice">
            <summary>Third-party notices</summary>
            <p>Portable build: React 19.3.0 (MIT), Leaflet 1.9.4 (BSD-2-Clause), React Leaflet 5.0.0 (Hippocratic-2.1), exifr 7.1.3 (MIT), ExifReader 4.45.2 (MPL-2.0), JSZip 3.10.2 (MIT/GPL-3.0), heic-decode 2.1.0 (ISC), and libheif-js 1.23.2 (LGPL-3.0). Source and license links are documented in the project README.</p>
          </details>
        </aside>

        <section className="mapPane">
          <PhotoMap photos={photos} mapStyle={mapStyle} />
          {counts.mapped === 0 && <div className="emptyMap"><div><p>Mapped photo points appear here after selection. Photos without GPS remain in the CSV.</p></div></div>}
        </section>
      </section>
    </main>
  );
}

function clamp(value: number, min: number, max: number) {
  return Number.isFinite(value) ? Math.min(Math.max(value, min), max) : min;
}

function makeId() {
  return 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function yieldToBrowser() {
  return new Promise<void>((resolve) => window.setTimeout(resolve, 0));
}
