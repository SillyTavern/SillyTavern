import * as bridge from './bridge.js';

// Both interfaces use the same canonical SillyTavern runtime.
window.simpleUiBridge = bridge;

document.addEventListener('click', event => {
    if (!event.target.closest('#simple-ui-enable-button')) return;
    bridge.setMode('minimal');
});
