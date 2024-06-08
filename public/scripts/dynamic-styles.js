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
    /** @type {{baseSelector: string, rule: CSSStyleRule}[]} */
    const hoverRules = [];
    /** @type {Set<string>} */
    const focusRules = new Set();

    const PLACEHOLDER = ':__PLACEHOLDER__';

    /**
     * Processes the CSS rules and separates selectors for hover and focus
     * @param {CSSRuleList} rules - The CSS rules to process
     */
    function processRules(rules) {
        Array.from(rules).forEach(rule => {
            if (rule instanceof CSSImportRule) {
                // Make sure that @import rules are processed recursively
                processImportedStylesheet(rule.styleSheet);
            } else if (rule instanceof CSSStyleRule) {
                // Separate multiple selectors on a rule
                const selectors = rule.selectorText.split(',').map(s => s.trim());

                // We collect all hover and focus rules to be able to later decide which hover rules don't have a matching focus rule
                selectors.forEach(selector => {
                    if (selector.includes(':hover')) {
                        const baseSelector = selector.replace(':hover', PLACEHOLDER).trim();
                        hoverRules.push({ baseSelector, rule });
                    } else if (selector.includes(':focus')) {
                        // We need to make sure that we both remember existing :focus and :focus-within rules
                        const baseSelector = selector.replace(':focus-within', PLACEHOLDER).replace(':focus-visible', PLACEHOLDER).replace(':focus', PLACEHOLDER).trim();
                        focusRules.add(baseSelector);
                    }
                });
            } else if (rule instanceof CSSMediaRule || rule instanceof CSSSupportsRule) {
                // Recursively process nested rules
                processRules(rule.cssRules);
            }
        });
    }

    /**
     * Processes the CSS rules of an imported stylesheet recursively
     * @param {CSSStyleSheet} sheet - The imported stylesheet to process
     */
    function processImportedStylesheet(sheet) {
        if (sheet && sheet.cssRules) {
            processRules(sheet.cssRules);
        }
    }

    processRules(styleSheet.cssRules);

    /** @type {CSSStyleSheet} */
    let targetStyleSheet = null;

    // Now finally create the dynamic focus rules
    hoverRules.forEach(({ baseSelector, rule }) => {
        if (!focusRules.has(baseSelector)) {
            // Only initialize the dynamic stylesheet if needed
            targetStyleSheet ??= getDynamicStyleSheet({ fromExtension });

            // The closest keyboard-equivalent to :hover styling is utilizing the :focus-within for keyboards
            // So we take all :hover rules that don't have a manually defined focus rule yet, and create their
            // :focus-within counterpart, which will make the styling work the same for keyboard and mouse
            const focusSelector = rule.selectorText.replace(/:hover/g, ':focus-within');
            const focusRule = `${focusSelector} { ${rule.style.cssText} }`;

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
        subtree: true
    });

    // Process all stylesheets on initial load
    Array.from(document.styleSheets).forEach(sheet => {
        try {
            applyDynamicFocusStyles(sheet, { fromExtension: sheet.href.toLowerCase().includes('scripts/extensions') });
        } catch (e) {
            console.warn('Failed to process stylesheet on initial load:', e);
        }
    });
}
