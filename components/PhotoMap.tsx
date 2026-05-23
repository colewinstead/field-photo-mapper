'use client';

/* eslint-disable @next/next/no-img-element */

import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { useEffect, useMemo } from 'react';
import type { PhotoRecord } from '@/lib/types';

const markerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function FitBounds({ photos }: { photos: PhotoRecord[] }) {
  const map = useMap();

  useEffect(() => {
    const points = photos
      .filter(
        (photo) =>
          photo.status === 'mapped' &&
          typeof photo.latitude === 'number' &&
          typeof photo.longitude === 'number'
      )
      .map((photo) => [photo.latitude as number, photo.longitude as number] as [number, number]);

    if (points.length === 1) {
      map.setView(points[0], 16);
    } else if (points.length > 1) {
      map.fitBounds(points, { padding: [40, 40], maxZoom: 17 });
    }
  }, [map, photos]);

  return null;
}

export default function PhotoMap({ photos, mapStyle }: { photos: PhotoRecord[]; mapStyle: 'streets' | 'satellite' }) {
  const mappedPhotos = useMemo(
    () =>
      photos.filter(
        (photo) =>
          photo.status === 'mapped' &&
          typeof photo.latitude === 'number' &&
          typeof photo.longitude === 'number'
      ),
    [photos]
  );

  return (
    <MapContainer className="map" center={[39.5, -98.35]} zoom={4} scrollWheelZoom>
      {mapStyle === 'satellite' ? (
        <TileLayer
          attribution='Tiles &copy; Esri'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />
      ) : (
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
      )}
      <FitBounds photos={photos} />
      {mappedPhotos.map((photo) => (
        <Marker
          icon={markerIcon}
          key={photo.id}
          position={[photo.latitude as number, photo.longitude as number]}
        >
          <Popup>
            <div className="popupText">
              {photo.thumbnailDataUrl && <img className="popupThumb" src={photo.thumbnailDataUrl} alt="" />}
              <b>{photo.filename}</b>
              {photo.dateTaken && <div>{photo.dateTaken}</div>}
              <div>{photo.latitude?.toFixed(6)}, {photo.longitude?.toFixed(6)}</div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
