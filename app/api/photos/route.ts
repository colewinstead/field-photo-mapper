import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { buildPhotoRecord, makeId } from '@/lib/photo';
import { cleanupStaleJobs, ensureUploadRoot, jobDir, manifestPath, readManifest, writeManifest } from '@/lib/storage';
import type { JobManifest } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const maxUploadMb = Number(process.env.MAX_UPLOAD_MB ?? 512);
const maxPhotosPerJob = Number(process.env.MAX_PHOTOS_PER_JOB ?? 50);
const allowedExtensions = /\.(jpe?g|heic|heif)$/i;

export async function POST(request: Request) {
  await cleanupStaleJobs();
  await ensureUploadRoot();

  const formData = await request.formData();
  const files = formData
    .getAll('photos')
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (!files.length) {
    return NextResponse.json({ error: 'No photos were uploaded.' }, { status: 400 });
  }

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > maxUploadMb * 1024 * 1024) {
    return NextResponse.json({ error: `Upload is larger than ${maxUploadMb} MB.` }, { status: 413 });
  }

  const invalid = files.find((file) => !allowedExtensions.test(file.name));
  if (invalid) {
    return NextResponse.json({ error: `${invalid.name} is not a supported JPG or HEIC photo.` }, { status: 400 });
  }

  const requestedJobId = formData.get('jobId');
  const jobId = typeof requestedJobId === 'string' && /^[a-z0-9-]+$/i.test(requestedJobId) ? requestedJobId : makeId();
  const dir = jobDir(jobId);
  await fs.mkdir(dir, { recursive: true });

  const existingManifest = await fs
    .access(manifestPath(jobId))
    .then(() => readManifest(jobId))
    .catch(() => null);

  if ((existingManifest?.photos.length ?? 0) + files.length > maxPhotosPerJob) {
    return NextResponse.json(
      { error: `This beta is limited to ${maxPhotosPerJob} photos per project. Premium batch sizes are coming soon.` },
      { status: 400 }
    );
  }

  const processedPhotos = await Promise.all(files.map((file) => buildPhotoRecord(file, dir)));
  const photos = [...(existingManifest?.photos ?? []), ...processedPhotos];
  const manifest: JobManifest = {
    jobId,
    createdAt: existingManifest?.createdAt ?? new Date().toISOString(),
    photos
  };
  await writeManifest(manifest);

  return NextResponse.json({
    jobId,
    photos,
    summary: {
      mapped: photos.filter((photo) => photo.status === 'mapped').length,
      missingGps: photos.filter((photo) => photo.status === 'missing_gps').length,
      errors: photos.filter((photo) => photo.status === 'error').length
    }
  });
}
