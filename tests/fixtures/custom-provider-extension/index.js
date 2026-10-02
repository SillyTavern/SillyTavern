import { registerCustomProvider } from '../../../custom-providers.js';

const owner = 'third-party/custom-provider-extension';
const handles = [];
const definition = (label, url) => ({ label, defaults: { custom_url: url }, models: { mode: 'discover', suggestions: [] }, auth: { mode: 'bearer', required: true } });

export function onActivate() {
    if (handles.length) return;
    handles.push(registerCustomProvider(owner, 'a', definition('<b>Provider A</b>', 'https://fixture-a.invalid/v1')));
    handles.push(registerCustomProvider(owner, 'b', definition('Provider B', 'https://fixture-b.invalid/v1')));
}
export function configure(a, b) {
    handles[0].update(definition('<b>Provider A</b>', a));
    handles[1].update(definition('Provider B', b));
}
export function onDisable() {
    for (const handle of handles) handle.unregister();
    handles.length = 0;
}
