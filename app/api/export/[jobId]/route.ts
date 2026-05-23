import { NextResponse } from 'next/server';
import { csvForPhotos, kmlPackageForManifest, kmzForManifest } from '@/lib/exporters';
import { cleanupStaleJobs, readManifest, scheduleCleanup } from '@/lib/storage';
import type { KmzExportOptions, PinColor, PinNameMode } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = {
  params: {
    jobId: string;
  };
};

export async function GET(request: Request, { params }: Context) {
  await cleanupStaleJobs();

  const url = new URL(request.url);
  const type = url.searchParams.get('type') ?? 'kmz';

  try {
    const manifest = await readManifest(params.jobId);
    scheduleCleanup(params.jobId);

    if (type === 'csv') {
      const csv = csvForPhotos(manifest.photos);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="field-photo-mapper-${params.jobId}.csv"`
        }
      });
    }

    if (type !== 'kmz' && type !== 'kmlzip') {
      return NextResponse.json({ error: 'Unsupported export type.' }, { status: 400 });
    }

    const options = exportOptionsFromUrl(url);
    const baseFilename = downloadBaseFilename(url.searchParams.get('filename'), params.jobId);

    if (type === 'kmlzip') {
      const kmlZip = await kmlPackageForManifest(manifest, { ...options, mediaFolder: 'photos' }, baseFilename);
      return new NextResponse(new Uint8Array(kmlZip), {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${baseFilename}-kml-photos.zip"`
        }
      });
    }

    const kmz = await kmzForManifest(manifest, options);
    return new NextResponse(new Uint8Array(kmz), {
      headers: {
        'Content-Type': 'application/vnd.google-earth.kmz',
        'Content-Disposition': `attachment; filename="${baseFilename}.kmz"`
      }
    });
  } catch {
    return NextResponse.json({ error: 'Export not found or already cleaned up.' }, { status: 404 });
  }
}

function exportOptionsFromUrl(url: URL): KmzExportOptions {
  const pinColor = oneOf<PinColor>(url.searchParams.get('pinColor'), ['red', 'blue', 'green', 'yellow', 'purple'], 'red');
  const nameMode = oneOf<PinNameMode>(
    url.searchParams.get('nameMode'),
    ['filename', 'date_filename', 'sequence_filename', 'coordinates'],
    'filename'
  );
  const pinScale = clamp(Number(url.searchParams.get('pinScale') ?? 1.1), 0.6, 2.2);
  const previewWidth = Math.round(clamp(Number(url.searchParams.get('previewWidth') ?? 560), 240, 1200));

  return {
    pinColor,
    nameMode,
    pinScale,
    previewWidth,
    mediaFolder: 'files'
  };
}

function oneOf<T extends string>(value: string | null, allowed: T[], fallback: T) {
  return value && allowed.includes(value as T) ? (value as T) : fallback;
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function downloadBaseFilename(value: string | null, jobId: string) {
  return (value || `field-photo-mapper-${jobId}`)
    .replace(/\.(kmz|kml|zip)$/i, '')
    .replace(/[^a-z0-9._ -]+/gi, '_')
    .trim()
    .slice(0, 120) || `field-photo-mapper-${jobId}`;
}
