import { createJimp } from '@jimp/core';
import { defaultPlugins } from 'jimp';
import { JimpMime } from 'jimp';

// Optimized image formats
import webp from '@jimp/wasm-webp';
import png from '@jimp/wasm-png';
import jpeg from '@jimp/wasm-jpeg';
import avif from '@jimp/wasm-avif';

// Other image formats
import bmp, { msBmp } from '@jimp/js-bmp';
import gif from '@jimp/js-gif';
import tiff from '@jimp/js-tiff';

// A custom jimp that uses WASM for optimized formats and JS for the rest
const Jimp = createJimp({
    formats: [webp, png, jpeg, avif, bmp, msBmp, gif, tiff],
    plugins: defaultPlugins,
});

export default Jimp;

export { Jimp, JimpMime };
