# Third-Party Notices for the Portable Build

The standalone HTML build includes the following libraries. Exact versions are locked in `package-lock.json` and displayed inside the portable application.

| Component | Version | License | Source and license |
| --- | ---: | --- | --- |
| React / React DOM | 18.3.1 | MIT | [facebook/react](https://github.com/facebook/react) |
| Leaflet | 1.9.4 | BSD-2-Clause | [Leaflet/Leaflet](https://github.com/Leaflet/Leaflet) |
| React Leaflet | 4.2.1 | Hippocratic-2.1 | [PaulLeCam/react-leaflet](https://github.com/PaulLeCam/react-leaflet) |
| exifr | 7.1.3 | MIT | [MikeKovarik/exifr](https://github.com/MikeKovarik/exifr) |
| ExifReader | 4.45.2 | MPL-2.0 | [mattiasw/ExifReader](https://github.com/mattiasw/ExifReader) |
| JSZip | 3.10.2 | MIT or GPL-3.0 | [Stuk/jszip](https://github.com/Stuk/jszip) |
| heic-decode | 2.1.0 | ISC | [catdad-experiments/heic-decode](https://github.com/catdad-experiments/heic-decode) |
| libheif-js | 1.23.2 | LGPL-3.0 | [catdad-experiments/libheif-js](https://github.com/catdad-experiments/libheif-js) |

The complete license text for each installed package is available in that package's published source and npm distribution. The portable file embeds the `libheif-js` WebAssembly bundle so HEIC pixels can be decoded without a server, worker, or separate runtime file.
