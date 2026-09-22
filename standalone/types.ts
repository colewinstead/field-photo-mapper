import type { PhotoStatus } from '../lib/types';

export type BrowserPhotoRecord = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  status: PhotoStatus;
  dateTaken?: string;
  latitude?: number;
  longitude?: number;
  error?: string;
  warning?: string;
  thumbnailUrl?: string;
  exportJpeg?: Blob;
};

export type PhotoMetadata = {
  latitude?: number;
  longitude?: number;
  dateTaken?: string;
};
