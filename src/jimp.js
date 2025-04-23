import { createJimp } from '@jimp/core';

// Optimized image formats
import webp from '@jimp/wasm-webp';
import png from '@jimp/wasm-png';
import jpeg from '@jimp/wasm-jpeg';
import avif from '@jimp/wasm-avif';

// Other image formats
import bmp, { msBmp } from '@jimp/js-bmp';
import gif from '@jimp/js-gif';
import tiff from '@jimp/js-tiff';

// Plugins
import * as blit from '@jimp/plugin-blit';
import * as circle from '@jimp/plugin-circle';
import * as color from '@jimp/plugin-color';
import * as contain from '@jimp/plugin-contain';
import * as cover from '@jimp/plugin-cover';
import * as crop from '@jimp/plugin-crop';
import * as displace from '@jimp/plugin-displace';
import * as fisheye from '@jimp/plugin-fisheye';
import * as flip from '@jimp/plugin-flip';
import * as mask from '@jimp/plugin-mask';
import * as resize from '@jimp/plugin-resize';
import * as rotate from '@jimp/plugin-rotate';
import * as threshold from '@jimp/plugin-threshold';
import * as quantize from '@jimp/plugin-quantize';

const defaultPlugins = [
    blit.methods,
    circle.methods,
    color.methods,
    contain.methods,
    cover.methods,
    crop.methods,
    displace.methods,
    fisheye.methods,
    flip.methods,
    mask.methods,
    resize.methods,
    rotate.methods,
    threshold.methods,
    quantize.methods,
];

// A custom jimp that uses WASM for optimized formats and JS for the rest
const Jimp = createJimp({
    formats: [webp, png, jpeg, avif, bmp, msBmp, gif, tiff],
    plugins: [...defaultPlugins],
});

const JimpMime = {
    bmp: bmp().mime,
    gif: gif().mime,
    jpeg: jpeg().mime,
    png: png().mime,
    tiff: tiff().mime,
};

export default Jimp;

export { Jimp, JimpMime };
