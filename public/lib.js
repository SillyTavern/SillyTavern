/**
 * Add all the libraries that you want to expose to the client here.
 * They are bundled and exposed by Webpack in the /lib.js file.
 */
import Fuse from 'fuse.js';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import localforage from 'localforage';
import Handlebars from 'handlebars';

/**
 * Expose the libraries to the 'window' object.
 * Needed for compatibility with old extensions.
 * Note: New extensions are encouraged to import the libraries directly from lib.js.
 */
export function initLibraryShims() {
    if (!window) {
        return;
    }
    if (!('Fuse' in window)) {
        // @ts-ignore
        window.Fuse = Fuse;
    }
    if (!('DOMPurify' in window)) {
        // @ts-ignore
        window.DOMPurify = DOMPurify;
    }
    if (!('hljs' in window)) {
        // @ts-ignore
        window.hljs = hljs;
    }
    if (!('localforage' in window)) {
        // @ts-ignore
        window.localforage = localforage;
    }
    if (!('Handlebars' in window)) {
        // @ts-ignore
        window.Handlebars = Handlebars;
    }
}

export default {
    Fuse,
    DOMPurify,
    hljs,
    localforage,
    Handlebars,
};

export {
    Fuse,
    DOMPurify,
    hljs,
    localforage,
    Handlebars,
};
