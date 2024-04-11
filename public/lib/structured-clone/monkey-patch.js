import structuredClone from './index.js';

if (!("structuredClone" in globalThis)) {
    console.debug("Monkey-patching structuredClone");
    globalThis.structuredClone = structuredClone;
}
