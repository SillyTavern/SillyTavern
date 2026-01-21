import { getParsedUA, isMobile } from './RossAscends-mods.js';

const isFirefox = () => /firefox/i.test(navigator.userAgent);

function sanitizeInlineQuotationOnCopy() {
    // STRG+C, STRG+V on firefox leads to duplicate double quotes when inline quotation elements are copied.
    // To work around this, take the selection and transform <q> to <span> before calling toString().
    document.addEventListener('copy', function (event) {
        if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) {
            return;
        }

        const selection = window.getSelection();
        if (!selection.anchorNode?.parentElement.closest('.mes_text')) {
            return;
        }

        const range = selection.getRangeAt(0).cloneContents();
        const tempDOM = document.createDocumentFragment();

        /**
         * Process a node, transforming <q> elements to <span> elements and preserving children.
         * @param {Node} node Input node
         * @returns {Node} Processed node
         */
        function processNode(node) {
            if (node.nodeType === Node.ELEMENT_NODE && node.nodeName.toLowerCase() === 'q') {
                // Transform <q> to <span>, preserve children
                const span = document.createElement('span');

                [...node.childNodes].forEach(child => {
                    const processedChild = processNode(child);
                    span.appendChild(processedChild);
                });

                return span;
            } else {
                // Nested structures containing <q> elements are unlikely
                return node.cloneNode(true);
            }
        }

        [...range.childNodes].forEach(child => {
            const processedChild = processNode(child);
            tempDOM.appendChild(processedChild);
        });

        const newRange = document.createRange();
        newRange.selectNodeContents(tempDOM);

        event.preventDefault();
        event.clipboardData.setData('text/plain', newRange.toString());
    });
}

function addSafariPatch() {
    const userAgent = getParsedUA();
    console.debug('User Agent', userAgent);
    const isMobileSafari = /iPad|iPhone|iPod/.test(navigator.platform) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isDesktopSafari = userAgent?.browser?.name === 'Safari' && userAgent?.platform?.type === 'desktop';
    const isIOS = userAgent?.os?.name === 'iOS';

    if (isIOS || isMobileSafari || isDesktopSafari) {
        document.body.classList.add('safari');
    }
}

function applyBrowserFixes() {
    if (isFirefox()) {
        sanitizeInlineQuotationOnCopy();
    }

    if (isMobile()) {
        const fixFunkyPositioning = () => {
            console.debug('[Mobile] Device viewport change detected.');
            document.documentElement.style.position = 'fixed';
            requestAnimationFrame(() => document.documentElement.style.position = '');
        };
        window.addEventListener('resize', fixFunkyPositioning);
        window.addEventListener('orientationchange', fixFunkyPositioning);
    }

    addSafariPatch();
}

export { isFirefox, applyBrowserFixes };
