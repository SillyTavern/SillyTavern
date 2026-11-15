import { registerCustomProvider } from '../../../custom-providers.js';

const owner = 'third-party/custom-provider-extension';
const handles = [];
const definition = (label, url, auth = { mode: 'bearer', required: true }) => ({ label, defaults: { custom_url: url }, models: { mode: 'discover', suggestions: [] }, auth });
// Provider B hides one control and is registered the way an extension normally does it: through the context, without an owner ID.
const definitionB = url => ({ ...definition('Provider B', url), controls: { hide: ['seed'] } });

export function onActivate() {
    if (handles.length) return;
    handles.push(registerCustomProvider(owner, 'a', definition('<b>Provider A</b>', 'https://fixture-a.invalid/v1')));
    handles.push(SillyTavern.getContext().customProviders.register('b', definitionB('https://fixture-b.invalid/v1')));
}
export function configure(a, b, auth) {
    handles[0].update(definition('<b>Provider A</b>', a, auth));
    handles[1].update(definitionB(b));
}
export function onDisable() {
    for (const handle of handles) handle.unregister();
    handles.length = 0;
}
