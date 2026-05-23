export type PhotoStatus = 'mapped' | 'missing_gps' | 'error';

export type PhotoRecord = {
  id: string;
  filename: string;
  storedFilename: string;
  originalPath: string;
  thumbnailPath?: string;
  thumbnailDataUrl?: string;
  mimeType: string;
  size: number;
  status: PhotoStatus;
  dateTaken?: string;
  latitude?: number;
  longitude?: number;
  error?: string;
};

export type JobManifest = {
  jobId: string;
  createdAt: string;
  photos: PhotoRecord[];
};

export type PinColor = 'red' | 'blue' | 'green' | 'yellow' | 'purple';

export type PinNameMode = 'filename' | 'date_filename' | 'sequence_filename' | 'coordinates';

export type KmzExportOptions = {
  pinColor: PinColor;
  pinScale: number;
  nameMode: PinNameMode;
  previewWidth: number;
  mediaFolder: string;
};

export type UploadResponse = {
  jobId: string;
  photos: PhotoRecord[];
  summary: {
    mapped: number;
    missingGps: number;
    errors: number;
  };
};
