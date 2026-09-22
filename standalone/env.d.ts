/// <reference types="vite/client" />

declare module 'heic-decode' {
  type DecodeResult = {
    width: number;
    height: number;
    data: Uint8ClampedArray;
  };

  export default function decode(options: { buffer: Uint8Array }): Promise<DecodeResult>;
}
