'use client';

/* eslint-disable @next/next/no-img-element */

import dynamic from 'next/dynamic';
import { useMemo, useRef, useState } from 'react';
import type { PhotoRecord, PinColor, PinNameMode, UploadResponse } from '@/lib/types';

const PhotoMap = dynamic(() => import('@/components/PhotoMap'), { ssr: false });

type UploadState = 'idle' | 'uploading' | 'ready' | 'error';
const maxPhotosPerJob = 50;

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>('idle');
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState('Upload JPG or HEIC photos to extract GPS data.');
  const [jobId, setJobId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [mapStyle, setMapStyle] = useState<'streets' | 'satellite'>('satellite');
  const [kmzName, setKmzName] = useState('field-photo-map');
  const [pinColor, setPinColor] = useState<PinColor>('red');
  const [pinScale, setPinScale] = useState(1.1);
  const [nameMode, setNameMode] = useState<PinNameMode>('filename');
  const [previewWidth, setPreviewWidth] = useState(560);
  const [allowLargeKmz, setAllowLargeKmz] = useState(false);

  const counts = useMemo(() => {
    const mapped = photos.filter((photo) => photo.status === 'mapped').length;
    const missing = photos.filter((photo) => photo.status === 'missing_gps').length;
    const failed = photos.filter((photo) => photo.status === 'error').length;
    return { mapped, missing, failed };
  }, [photos]);

  const exportEstimate = useMemo(() => {
    const mapped = photos.filter((photo) => photo.status === 'mapped').length;
    const perPhotoMb = previewWidth >= 900 ? 0.18 : previewWidth >= 650 ? 0.14 : 0.1;
    const estimatedMb = mapped * perPhotoMb + 0.1;
    return {
      estimatedMb,
      suggestKmlPackage: mapped > 150 || estimatedMb > 20
    };
  }, [photos, previewWidth]);

  async function uploadFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter((file) =>
      /\.(jpe?g|heic|heif)$/i.test(file.name)
    );

    if (!files.length) {
      setState('error');
      setMessage('Choose at least one JPG, HEIC, or HEIF photo.');
      return;
    }

    if (files.length > maxPhotosPerJob) {
      setState('error');
      setMessage(`This beta supports up to ${maxPhotosPerJob} photos at a time. Premium batch sizes are coming soon.`);
      return;
    }

    setState('uploading');
    setMessage(`Processing ${files.length} photo${files.length === 1 ? '' : 's'}...`);
    setPhotos([]);
    const nextJobId = makeClientJobId();
    setJobId(nextJobId);
    setProgress({ completed: 0, total: files.length });

    try {
      let latestPayload: UploadResponse | null = null;

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        setMessage(`Processing ${index + 1} of ${files.length}: ${file.name}`);

        const formData = new FormData();
        formData.append('jobId', nextJobId);
        formData.append('photos', file);

        const response = await fetch('/api/photos', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error ?? `Upload failed while processing ${file.name}.`);
        }

        latestPayload = (await response.json()) as UploadResponse;
        setPhotos(latestPayload.photos);
        setProgress({ completed: index + 1, total: files.length });
      }

      if (!latestPayload) throw new Error('Upload failed.');
      setJobId(latestPayload.jobId);
      setState('ready');
      setMessage(
        `${latestPayload.summary.mapped} mapped, ${latestPayload.summary.missingGps} missing GPS, ${latestPayload.summary.errors} failed.`
      );
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Upload failed.');
    }
  }

  function onDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    uploadFiles(event.dataTransfer.files);
  }

  function download(type: 'kmz' | 'kmlzip' | 'csv') {
    if (!jobId) return;
    const params = new URLSearchParams({ type });

    if (type === 'kmz' || type === 'kmlzip') {
      params.set('filename', kmzName);
      params.set('pinColor', pinColor);
      params.set('pinScale', pinScale.toString());
      params.set('nameMode', nameMode);
      params.set('previewWidth', previewWidth.toString());
    }

    window.location.href = `/api/export/${jobId}?${params.toString()}`;
  }

  return (
    <main className="appShell">
      <header className="topBar">
        <div className="brand">
          <h1>Field Photo Mapper</h1>
          <span>Geotagged photo review, KMZ export, and CSV status reporting</span>
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
              onDrop={onDrop}
            >
              <input
                ref={inputRef}
                className="hiddenInput"
                type="file"
                accept=".jpg,.jpeg,.heic,.heif,image/jpeg,image/heic,image/heif"
                multiple
                onChange={(event) => {
                  if (event.target.files) uploadFiles(event.target.files);
                  event.currentTarget.value = '';
                }}
              />
              <span>
                <strong>Drop photos here or click to browse</strong>
                JPG, HEIC, and HEIF files are processed temporarily on this server.
              </span>
            </label>
            <div className="betaNotice">
              Beta cap: 50 photos per project and 512 MB per request. Premium larger batches coming soon.
            </div>

            <div className="actions">
              <button
                className="button"
                disabled={
                  !jobId ||
                  counts.mapped === 0 ||
                  state === 'uploading' ||
                  (exportEstimate.suggestKmlPackage && !allowLargeKmz)
                }
                onClick={() => download('kmz')}
              >
                Download KMZ
              </button>
              <button
                className="button secondary"
                disabled={!jobId || counts.mapped === 0 || state === 'uploading'}
                onClick={() => download('kmlzip')}
              >
                KML + Photos
              </button>
              <button
                className="button secondary"
                disabled={!jobId || photos.length === 0 || state === 'uploading'}
                onClick={() => download('csv')}
              >
                Download CSV
              </button>
            </div>
            {counts.mapped > 0 && (
              <div className={`recommendation ${exportEstimate.suggestKmlPackage ? 'visible' : ''}`}>
                <div>
                  <b>{exportEstimate.suggestKmlPackage ? 'KML package recommended' : 'KMZ size looks manageable'}</b>
                  <span>
                    Estimated export size: {exportEstimate.estimatedMb.toFixed(1)} MB. KML + Photos keeps images in a separate folder.
                  </span>
                </div>
                {exportEstimate.suggestKmlPackage && (
                  <label className="checkboxLabel">
                    <input
                      type="checkbox"
                      checked={allowLargeKmz}
                      onChange={(event) => setAllowLargeKmz(event.target.checked)}
                    />
                    Allow embedded KMZ anyway
                  </label>
                )}
              </div>
            )}
            {progress.total > 0 && (
              <div className="progressBlock" aria-label="Processing progress">
                <div className="progressMeta">
                  <span>{state === 'uploading' ? 'Processing' : 'Complete'}</span>
                  <b>{Math.round((progress.completed / progress.total) * 100)}%</b>
                </div>
                <div className="progressTrack">
                  <div
                    className="progressFill"
                    style={{ width: `${Math.round((progress.completed / progress.total) * 100)}%` }}
                  />
                </div>
                <div className="progressCount">
                  {progress.completed} of {progress.total} photos
                </div>
              </div>
            )}
            <p className="statusLine">{message}</p>
          </div>

          <div className="optionsPanel">
            <div className="optionHeader">Preview</div>
            <div className="segmented" aria-label="Map style">
              <button
                className={mapStyle === 'streets' ? 'selected' : ''}
                type="button"
                onClick={() => setMapStyle('streets')}
              >
                Streets
              </button>
              <button
                className={mapStyle === 'satellite' ? 'selected' : ''}
                type="button"
                onClick={() => setMapStyle('satellite')}
              >
                Satellite
              </button>
            </div>

            <div className="optionHeader">KMZ Export</div>
            <label className="fieldLabel">
              File name
              <input
                value={kmzName}
                onChange={(event) => setKmzName(event.target.value)}
                placeholder="field-photo-map"
              />
            </label>

            <label className="fieldLabel">
              Placemark names
              <select value={nameMode} onChange={(event) => setNameMode(event.target.value as PinNameMode)}>
                <option value="filename">Filename</option>
                <option value="date_filename">Date + filename</option>
                <option value="sequence_filename">Number + filename</option>
                <option value="coordinates">Coordinates</option>
              </select>
            </label>

            <label className="fieldLabel">
              Popup picture width
              <input
                type="number"
                min="240"
                max="1200"
                step="40"
                value={previewWidth}
                onChange={(event) => setPreviewWidth(Number(event.target.value))}
              />
            </label>

            <div className="optionGrid">
              <label className="fieldLabel">
                Pin color
                <select value={pinColor} onChange={(event) => setPinColor(event.target.value as PinColor)}>
                  <option value="red">Red</option>
                  <option value="blue">Blue</option>
                  <option value="green">Green</option>
                  <option value="yellow">Yellow</option>
                  <option value="purple">Purple</option>
                </select>
              </label>

              <label className="fieldLabel">
                Pin size
                <input
                  type="number"
                  min="0.6"
                  max="2.2"
                  step="0.1"
                  value={pinScale}
                  onChange={(event) => setPinScale(Number(event.target.value))}
                />
              </label>
            </div>

          </div>

          <div className="summary">
            <div className="metric">
              <b>{counts.mapped}</b>
              <span>Mapped</span>
            </div>
            <div className="metric">
              <b>{counts.missing}</b>
              <span>No GPS</span>
            </div>
            <div className="metric">
              <b>{counts.failed}</b>
              <span>Errors</span>
            </div>
          </div>

          <div className="photoList">
            {photos.map((photo) => (
              <article className="photoRow" key={photo.id}>
                {photo.thumbnailDataUrl ? (
                  <img src={photo.thumbnailDataUrl} alt="" />
                ) : (
                  <div className="thumbFallback">No preview</div>
                )}
                <div>
                  <p className="photoName">{photo.filename}</p>
                  <p className="photoMeta">
                    <span className={photo.status === 'mapped' ? 'ok' : photo.status === 'error' ? 'failed' : 'missing'}>
                      {photo.status === 'mapped'
                        ? 'Mapped'
                        : photo.status === 'missing_gps'
                          ? 'Missing GPS'
                          : 'Error'}
                    </span>
                    {photo.dateTaken ? ` | ${photo.dateTaken}` : ''}
                    {typeof photo.latitude === 'number' && typeof photo.longitude === 'number'
                      ? ` | ${photo.latitude.toFixed(6)}, ${photo.longitude.toFixed(6)}`
                      : ''}
                    {photo.error ? ` | ${photo.error}` : ''}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </aside>

        <section className="mapPane">
          <PhotoMap photos={photos} mapStyle={mapStyle} />
          {counts.mapped === 0 && (
            <div className="emptyMap">
              <div>
                <p>Mapped photo points appear here after upload. Photos without GPS are still included in the CSV.</p>
              </div>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function makeClientJobId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  const randomPart = Array.from({ length: 4 }, () => Math.random().toString(36).slice(2)).join('-');
  return `${Date.now().toString(36)}-${randomPart}`;
}
