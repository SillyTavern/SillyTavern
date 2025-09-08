/** @type {CSSStyleSheet} */
let dynamicStyleSheet = null;
/** @type {CSSStyleSheet} */
let dynamicExtensionStyleSheet = null;

/**
 * An observer that will check if any new stylesheets are added to the head
 * @type {MutationObserver}
 */
const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
        if (mutation.type !== 'childList') return;

        mutation.addedNodes.forEach(node => {
            if (node instanceof HTMLLinkElement && node.tagName === 'LINK' && node.rel === 'stylesheet') {
                node.addEventListener('load', () => {
                    try {
                        applyDynamicFocusStyles(node.sheet);
                    } catch (e) {
                        console.warn('Failed to process new stylesheet:', e);
                    }
                });
            }
        });
    });
});

/**
 * Generates dynamic focus styles based on the given stylesheet, taking its hover styles as reference
 *
 * @param {CSSStyleSheet} styleSheet - The stylesheet to process
 * @param {object} [options] - Optional configuration options
 * @param {boolean} [options.fromExtension=false] - Indicates if the styles are from an extension
 */
function applyDynamicFocusStyles(styleSheet, { fromExtension = false } = {}) {
    /** @typedef {{ type: 'media'|'supports'|'container', conditionText: string }} WrapperCond */
    /** @type {{baseSelector: string, rule: CSSStyleRule, wrappers: WrapperCond[]}[]} */
    const hoverRules = [];
    /** @type {Set<string>} */
    const focusRules = new Set();

    const PLACEHOLDER = ':__PLACEHOLDER__';

    /**
     * Builds a stable signature string for a chain of wrapper conditions so we can distinguish
     * identical selectors under different contexts (e.g., different @media queries)
     * @param {WrapperCond[]} wrappers
     * @returns {string}
     */
    function wrapperSignature(wrappers) {
        return wrappers.map(w => `${w.type}:${w.conditionText}`).join(';');
    }

    /**
     * Processes the CSS rules and separates selectors for hover and focus
     * @param {CSSRuleList} rules - The CSS rules to process
     * @param {WrapperCond[]} wrappers - Current chain of wrapper conditions (@media/@supports/etc.)
     */
    function processRules(rules, wrappers = []) {
        Array.from(rules).forEach(rule => {
            if (rule instanceof CSSImportRule) {
                // Make sure that @import rules are processed recursively
                // If the @import has media conditions, treat them as wrappers as well
                /** @type {WrapperCond[]} */
                const extra = (rule.media && rule.media.mediaText) ? [{ type: 'media', conditionText: rule.media.mediaText }] : [];
                processImportedStylesheet(rule.styleSheet, [...wrappers, ...extra]);
            } else if (rule instanceof CSSStyleRule) {
                // Separate multiple selectors on a rule
                const selectors = rule.selectorText.split(',').map(s => s.trim());

                // We collect all hover and focus rules to be able to later decide which hover rules don't have a matching focus rule
                selectors.forEach(selector => {
                    const isHover = selector.includes(':hover'), isFocus = selector.includes(':focus');
                    if (isHover && isFocus) {
                        // We currently do nothing here. Rules containing both hover and focus are very specific and should never be automatically touched
                    }
                    else if (isHover) {
                        const baseSelector = selector.replace(/:hover/g, PLACEHOLDER).trim();
                        hoverRules.push({ baseSelector, rule, wrappers: [...wrappers] });
                    } else if (isFocus) {
                        // We need to make sure that we remember all existing :focus, :focus-within and :focus-visible rules
                        const baseSelector = selector.replace(/:focus(-within|-visible)?/g, PLACEHOLDER).trim();
                        focusRules.add(`${baseSelector}|${wrapperSignature(wrappers)}`);
                    }
                });
            } else if (rule instanceof CSSMediaRule) {
                // Recursively process nested @media rules
                processRules(rule.cssRules, [...wrappers, { type: 'media', conditionText: rule.conditionText }]);
            } else if (rule instanceof CSSSupportsRule) {
                // Recursively process nested @supports rules
                processRules(rule.cssRules, [...wrappers, { type: 'supports', conditionText: rule.conditionText }]);
            } else if (rule instanceof window.CSSContainerRule) {
                // Recursively process nested @container rules (if supported by the browser)
                // Note: conditionText contains the query like "(min-width: 300px)" or "style(color)"
                // Using 'container' as the type ensures uniqueness separate from @media/@supports
                processRules(rule.cssRules, [...wrappers, { type: 'container', conditionText: rule.conditionText }]);
            }
        });
    }

    /**
     * Processes the CSS rules of an imported stylesheet recursively
     * @param {CSSStyleSheet} sheet - The imported stylesheet to process
     * @param {WrapperCond[]} wrappers - Wrapper conditions inherited from (at)import media
     */
    function processImportedStylesheet(sheet, wrappers = []) {
        if (sheet && sheet.cssRules) {
            processRules(sheet.cssRules, wrappers);
        }
    }

    processRules(styleSheet.cssRules, []);

    /** @type {CSSStyleSheet} */
    let targetStyleSheet = null;

    // Now finally create the dynamic focus rules
    hoverRules.forEach(({ baseSelector, rule, wrappers }) => {
        if (!focusRules.has(`${baseSelector}|${wrapperSignature(wrappers)}`)) {
            // Only initialize the dynamic stylesheet if needed
            targetStyleSheet ??= getDynamicStyleSheet({ fromExtension });

            // The closest keyboard-equivalent to :hover styling is utilizing the :focus-visible rule from modern browsers.
            // It let's the browser decide whether a focus highlighting is expected and makes sense.
            // So we take all :hover rules that don't have a manually defined focus rule yet, and create their
            // :focus-visible counterpart, which will make the styling work the same for keyboard and mouse.
            // If something like :focus-within or a more specific selector like `.blah:has(:focus-visible)` for elements inside,
            // it should be manually defined in CSS.
            const focusSelector = rule.selectorText.replace(/:hover/g, ':focus-visible');
            let focusRule = `${focusSelector} { ${rule.style.cssText} }`;

            // Wrap the generated rule into the same @media/@supports/@container chain (if any)
            if (wrappers.length > 0) {
                // Build nested blocks from outermost to innermost
                // Example: @media (x) { @supports (y) { <rule> } }
                focusRule = wrappers.reduceRight((inner, w) => {
                    if (w.type === 'media') return `@media ${w.conditionText} { ${inner} }`;
                    if (w.type === 'supports') return `@supports ${w.conditionText} { ${inner} }`;
                    if (w.type === 'container') return `@container ${w.conditionText} { ${inner} }`;
                    return inner;
                }, focusRule);
            }

            try {
                targetStyleSheet.insertRule(focusRule, targetStyleSheet.cssRules.length);
            } catch (e) {
                console.warn('Failed to insert focus rule:', e);
            }
        }
    });
}

/**
 * Retrieves the stylesheet that should be used for dynamic rules
 *
 * @param {object} options - The options object
 * @param {boolean} [options.fromExtension=false] - Indicates whether the rules are coming from extensions
 * @return {CSSStyleSheet} The dynamic stylesheet
 */
function getDynamicStyleSheet({ fromExtension = false } = {}) {
    if (fromExtension) {
        if (!dynamicExtensionStyleSheet) {
            const styleSheetElement = document.createElement('style');
            styleSheetElement.setAttribute('id', 'dynamic-extension-styles');
            document.head.appendChild(styleSheetElement);
            dynamicExtensionStyleSheet = styleSheetElement.sheet;
        }
        return dynamicExtensionStyleSheet;
    } else {
        if (!dynamicStyleSheet) {
            const styleSheetElement = document.createElement('style');
            styleSheetElement.setAttribute('id', 'dynamic-styles');
            document.head.appendChild(styleSheetElement);
            dynamicStyleSheet = styleSheetElement.sheet;
        }
        return dynamicStyleSheet;
    }
}

/**
 * Initializes dynamic styles for ST
 */
export function initDynamicStyles() {
    // Start observing the head for any new added stylesheets
    observer.observe(document.head, {
        childList: true,
        subtree: true,
    });

    // Process all stylesheets on initial load
    Array.from(document.styleSheets).forEach(sheet => {
        try {
            applyDynamicFocusStyles(sheet, { fromExtension: sheet.href?.toLowerCase().includes('scripts/extensions') == true });
        } catch (e) {
            console.warn('Failed to process stylesheet on initial load:', e);
        }
    });
}
