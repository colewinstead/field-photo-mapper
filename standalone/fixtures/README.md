# Browser verification fixtures

The portable build is manually verified with fixtures from the MIT-licensed [exifr test suite](https://github.com/MikeKovarik/exifr/tree/master/test/fixtures):

- `IMG_20180725_163423.jpg`: JPEG containing known GPS and capture-date metadata.
- `noexif.jpg`: JPEG without EXIF metadata.
- `heic-single.heic`: small HEIC used to verify browser-side pixel decoding.
- `heic-iphone.heic`: HEIC containing known GPS/date metadata and decodable pixels.

The image binaries are not copied into this repository. This keeps third-party test photography out of release archives while retaining exact fixture names and provenance for repeatable verification.
