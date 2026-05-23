import { promises as fs } from 'fs';
import path from 'path';
import type { JobManifest } from './types';

const staleJobMs = 1000 * 60 * 60 * 6;
const cleanupDelayMs = 1000 * 60 * 10;
const cleanupTimers = new Map<string, NodeJS.Timeout>();

export function uploadRoot() {
  return process.env.UPLOAD_ROOT || path.join(process.cwd(), 'tmp');
}

export function jobDir(jobId: string) {
  if (!/^[a-z0-9-]+$/i.test(jobId)) {
    throw new Error('Invalid job id.');
  }
  return path.join(uploadRoot(), jobId);
}

export function manifestPath(jobId: string) {
  return path.join(jobDir(jobId), 'manifest.json');
}

export async function ensureUploadRoot() {
  await fs.mkdir(uploadRoot(), { recursive: true });
}

export async function writeManifest(manifest: JobManifest) {
  await fs.writeFile(manifestPath(manifest.jobId), JSON.stringify(manifest, null, 2), 'utf8');
}

export async function readManifest(jobId: string) {
  const raw = await fs.readFile(manifestPath(jobId), 'utf8');
  return JSON.parse(raw) as JobManifest;
}

export async function cleanupJob(jobId: string) {
  const timer = cleanupTimers.get(jobId);
  if (timer) cleanupTimers.delete(jobId);
  await fs.rm(jobDir(jobId), { recursive: true, force: true });
}

export function scheduleCleanup(jobId: string) {
  const existing = cleanupTimers.get(jobId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    cleanupJob(jobId).catch(() => undefined);
  }, cleanupDelayMs);
  cleanupTimers.set(jobId, timer);
}

export async function cleanupStaleJobs() {
  await ensureUploadRoot();
  const entries = await fs.readdir(uploadRoot(), { withFileTypes: true }).catch(() => []);
  const now = Date.now();

  await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const dir = path.join(uploadRoot(), entry.name);
        const stat = await fs.stat(dir).catch(() => null);
        if (stat && now - stat.mtimeMs > staleJobMs) {
          await fs.rm(dir, { recursive: true, force: true });
        }
      })
  );
}
