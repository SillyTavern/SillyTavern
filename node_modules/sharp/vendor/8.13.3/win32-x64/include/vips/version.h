/* Macros for the header version.
 */

#ifndef VIPS_VERSION_H
#define VIPS_VERSION_H

#define VIPS_VERSION		"8.13.3"
#define VIPS_VERSION_STRING	"8.13.3"
#define VIPS_MAJOR_VERSION	(8)
#define VIPS_MINOR_VERSION	(13)
#define VIPS_MICRO_VERSION	(3)

/* The ABI version, as used for library versioning.
 */
#define VIPS_LIBRARY_CURRENT	(57)
#define VIPS_LIBRARY_REVISION	(3)
#define VIPS_LIBRARY_AGE	(15)

#define VIPS_CONFIG		"enable debug: false, enable deprecated: false, enable modules: false, enable RAD load/save: false, enable Analyze7 load/save: false, enable PPM load/save: false, enable GIF load: true, use fftw for FFTs: false, accelerate loops with ORC: true, ICC profile support with lcms: true, zlib: true, text rendering with pangocairo: true, font file support with fontconfig: true, EXIF metadata support with libexif: true, JPEG load/save with libjpeg: true, JXL load/save with libjxl: false (dynamic module: false), JPEG2000 load/save with OpenJPEG: false, PNG load/save with libspng: true, PNG load/save with libpng: false, selected quantisation package: imagequant, TIFF load/save with libtiff: true, image pyramid save with libgsf: true, HEIC/AVIF load/save with libheif: true (dynamic module: false), WebP load/save with libwebp: true, PDF load with PDFium: false, PDF load with poppler-glib: false (dynamic module: false), SVG load with librsvg: true, EXR load with OpenEXR: false, OpenSlide load: false (dynamic module: false), Matlab load with libmatio: false, NIfTI load/save with niftiio: false, FITS load/save with cfitsio: false, GIF save with cgif: true, selected Magick package: none (dynamic module: false), Magick API version: none, Magick load: false, Magick save: false"

/* Not really anything to do with versions, but this is a handy place to put
 * it.
 */
#define VIPS_ENABLE_DEPRECATED 0

#endif /*VIPS_VERSION_H*/
