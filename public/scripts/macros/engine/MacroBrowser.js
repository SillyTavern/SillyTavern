/**
 * MacroBrowser - Dynamic documentation browser for macros.
 * Similar to SlashCommandBrowser but for the macro system.
 */

import { MacroRegistry, MacroCategory } from './MacroRegistry.js';
import { performFuzzySearch } from '../../power-user.js';
import { escapeRegex } from '/scripts/utils.js';

/** @typedef {import('./MacroRegistry.js').MacroDefinition} MacroDefinition */
/** @typedef {import('./MacroRegistry.js').MacroValueType} MacroValueType */

/**
 * Category display names and order for documentation.
 * @type {Record<string, { label: string, order: number }>}
 */
const CATEGORY_CONFIG = {
    [MacroCategory.NAMES]: { label: 'Names & Participants', order: 1 },
    [MacroCategory.UTILITY]: { label: 'Utilities', order: 2 },
    [MacroCategory.RANDOM]: { label: 'Randomization', order: 3 },
    [MacroCategory.TIME]: { label: 'Date & Time', order: 4 },
    [MacroCategory.VARIABLE]: { label: 'Variables', order: 5 },
    [MacroCategory.STATE]: { label: 'Runtime State', order: 6 },
    [MacroCategory.CHARACTER]: { label: 'Character Card & Persona Fields', order: 7 },
    [MacroCategory.CHAT]: { label: 'Chat History & Messages', order: 8 },
    [MacroCategory.PROMPTS]: { label: 'Prompt Templates', order: 9 },
    [MacroCategory.MISC]: { label: 'Miscellaneous', order: 10 },
};

/**
 * MacroBrowser class for displaying searchable macro documentation.
 */
export class MacroBrowser {
    /** @type {Map<string, MacroDefinition[]>} */
    macrosByCategory = new Map();

    /** @type {HTMLElement} */
    dom;

    /** @type {HTMLInputElement} */
    searchInput;

    /** @type {HTMLElement} */
    detailsPanel;

    /** @type {Map<string, HTMLElement>} */
    itemMap = new Map();

    /** @type {boolean} */
    isSorted = false;

    /**
     * Groups macros by category in registration order.
     * Excludes hidden aliases from the list.
     */
    #loadMacros() {
        this.macrosByCategory.clear();
        // Exclude hidden aliases - they won't show in the list
        const allMacros = MacroRegistry.getAllMacros({ excludeHiddenAliases: true });

        for (const macro of allMacros) {
            const category = macro.category || MacroCategory.MISC;
            if (!this.macrosByCategory.has(category)) {
                this.macrosByCategory.set(category, []);
            }
            this.macrosByCategory.get(category).push(macro);
        }
    }

    /**
     * Sorts macros within each category alphabetically.
     */
    #sortMacros() {
        for (const [, macros] of this.macrosByCategory) {
            macros.sort((a, b) => a.name.localeCompare(b.name));
        }
    }

    /**
     * Gets categories sorted by their configured order.
     * @returns {string[]}
     */
    #getSortedCategories() {
        return Array.from(this.macrosByCategory.keys())
            .sort((a, b) => getCategoryConfig(a).order - getCategoryConfig(b).order);
    }

    /**
     * Renders the browser into a parent element.
     * @param {HTMLElement} parent
     * @returns {HTMLElement}
     */
    renderInto(parent) {
        this.#loadMacros();

        const root = document.createElement('div');
        root.classList.add('macroBrowser');
        this.dom = root;

        // Search bar and sort button
        const toolbar = document.createElement('div');
        toolbar.classList.add('macro-toolbar');

        const searchLabel = document.createElement('label');
        searchLabel.classList.add('macro-search-label');
        searchLabel.textContent = 'Search: ';

        const searchInput = document.createElement('input');
        searchInput.type = 'search';
        searchInput.classList.add('macro-search-input', 'text_pole');
        searchInput.placeholder = 'Search macros by name or description...';
        searchInput.addEventListener('input', () => this.#handleSearch(searchInput.value));
        this.searchInput = searchInput;
        searchLabel.appendChild(searchInput);
        toolbar.appendChild(searchLabel);

        const sortBtn = document.createElement('button');
        sortBtn.classList.add('macro-sort-btn', 'menu_button');
        sortBtn.innerHTML = '<i class="fa-solid fa-arrow-down-a-z"></i> Sort A-Z';
        sortBtn.title = 'Sort macros alphabetically within each category';
        sortBtn.addEventListener('click', () => this.#toggleSort());
        toolbar.appendChild(sortBtn);

        root.appendChild(toolbar);

        // Container for list and details
        const container = document.createElement('div');
        container.classList.add('macro-container');

        // Macro list
        const listPanel = document.createElement('div');
        listPanel.classList.add('macro-list-panel');
        this.#renderList(listPanel);
        container.appendChild(listPanel);

        // Details panel
        const detailsPanel = document.createElement('div');
        detailsPanel.classList.add('macro-details-panel');
        detailsPanel.innerHTML = '<div class="macro-details-placeholder">Select a macro to view details</div>';
        this.detailsPanel = detailsPanel;
        container.appendChild(detailsPanel);

        root.appendChild(container);
        parent.appendChild(root);

        return root;
    }

    /**
     * Renders the macro list grouped by category.
     * @param {HTMLElement} listPanel
     */
    #renderList(listPanel) {
        listPanel.innerHTML = '';
        this.itemMap.clear();

        for (const category of this.#getSortedCategories()) {
            const macros = this.macrosByCategory.get(category);
            if (!macros || macros.length === 0) continue;

            // Category header
            const categoryHeader = document.createElement('div');
            categoryHeader.classList.add('macro-category-header');
            categoryHeader.textContent = getCategoryConfig(category).label;
            categoryHeader.dataset.category = category;
            listPanel.appendChild(categoryHeader);

            // Macro items
            for (const macro of macros) {
                const item = renderMacroItem(macro);
                item.addEventListener('click', () => this.#showDetails(macro, item));
                this.itemMap.set(macro.name, item);
                listPanel.appendChild(item);
            }
        }
    }

    /**
     * Shows details for a selected macro.
     * @param {MacroDefinition} macro
     * @param {HTMLElement} item
     */
    #showDetails(macro, item) {
        // Clear previous selection
        this.dom.querySelectorAll('.macro-item.selected').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');

        // Render details
        this.detailsPanel.innerHTML = '';
        this.detailsPanel.appendChild(renderMacroDetails(macro));
    }

    /**
     * Handles search input using fuzzy search.
     * @param {string} query
     */
    #handleSearch(query) {
        query = query.trim();

        // Clear details on search
        this.detailsPanel.innerHTML = '<div class="macro-details-placeholder">Select a macro to view details</div>';
        this.dom.querySelectorAll('.macro-item.selected').forEach(el => el.classList.remove('selected'));

        // If empty query, show all
        if (!query) {
            for (const item of this.itemMap.values()) {
                item.classList.remove('isFiltered');
            }
            this.dom.querySelectorAll('.macro-category-header').forEach(h => h.classList.remove('isFiltered'));
            return;
        }

        // Trim query of braces, as we don't have them in the macro names of the search definitions
        query = query.replace(/[{}]/g, '');

        // Build searchable data array from all macros
        const allMacros = MacroRegistry.getAllMacros();
        const searchData = allMacros.map(macro => ({
            name: macro.name,
            aliases: macro.aliases?.map(a => a.alias).join(' '),
            description: macro.description || '',
            category: getCategoryConfig(macro.category).label,
            argNames: macro.unnamedArgDefs.map(d => d.name).join(' '),
            argDescriptions: macro.unnamedArgDefs.map(d => d.description || '').join(' '),
        }));

        // Fuzzy search with weighted keys
        const keys = [
            { name: 'name', weight: 10 },
            { name: 'aliases', weight: 1 }, // No need to rank those high, if they are important (visible) they have their own entry
            { name: 'description', weight: 5 },
            { name: 'category', weight: 3 },
            { name: 'argNames', weight: 2 },
            { name: 'argDescriptions', weight: 1 },
        ];

        const results = performFuzzySearch('macro-browser', searchData, keys, query);
        const matchedNames = new Set(results.map(r => r.item.name));

        // Filter items based on fuzzy results
        for (const [name, item] of this.itemMap) {
            item.classList.toggle('isFiltered', !matchedNames.has(name));
        }

        // Hide empty category headers
        this.dom.querySelectorAll('.macro-category-header').forEach(header => {
            if (!(header instanceof HTMLElement)) return;
            const category = header.dataset.category;
            const hasVisible = Array.from(this.itemMap.values())
                .filter(item => item.dataset.macroName)
                .some(item => {
                    const macro = MacroRegistry.getMacro(item.dataset.macroName);
                    return macro?.category === category && !item.classList.contains('isFiltered');
                });
            header.classList.toggle('isFiltered', !hasVisible);
        });
    }

    /**
     * Toggles alphabetical sorting.
     */
    #toggleSort() {
        this.isSorted = !this.isSorted;

        if (this.isSorted) {
            this.#sortMacros();
        } else {
            this.#loadMacros(); // Reload to restore registration order
        }

        const listPanel = this.dom.querySelector('.macro-list-panel');
        if (!(listPanel instanceof HTMLElement)) return;

        this.#renderList(listPanel);
        // Re-apply current search filter
        if (this.searchInput?.value) {
            this.#handleSearch(this.searchInput.value);
        }

        // Update button state
        const sortBtn = this.dom.querySelector('.macro-sort-btn');
        sortBtn?.classList.toggle('active', this.isSorted);
    }

    /**
     * Handles keyboard shortcuts.
     * @param {KeyboardEvent} evt
     */
    #handleKeyDown(evt) {
        if (!evt.shiftKey && !evt.altKey && evt.ctrlKey && evt.key.toLowerCase() === 'f') {
            if (!this.dom.closest('body')) return;
            if (this.dom.closest('.mes') && !this.dom.closest('.last_mes')) return;
            evt.preventDefault();
            evt.stopPropagation();
            evt.stopImmediatePropagation();
            this.searchInput?.focus();
        }
    }
}

/**
 * Gets the macro help content.
 * If experimental_macro_engine is enabled, returns a placeholder for the browser.
 * Otherwise returns the static template content.
 *
 * @returns {string} HTML string for help content
 */
export function getMacrosHelp() {
    // Return a placeholder that will be replaced with the browser
    return '<div class="macroHelp"><i class="fa-solid fa-spinner fa-spin"></i> Loading macro documentation...</div>';
}

/**
 * Gets display config for a category.
 * @param {string} category
 * @returns {{ label: string, order: number }}
 */
function getCategoryConfig(category) {
    return CATEGORY_CONFIG[category] ?? { label: category, order: 100 };
}

/**
 * Formats a macro signature with its arguments.
 * Uses displayOverride if available, otherwise auto-generates from args.
 * Optional args are shown in [brackets].
 * @param {MacroDefinition} macro
 * @returns {string}
 */
export function formatMacroSignature(macro) {
    // Use displayOverride if provided
    if (macro.displayOverride) {
        if (macro.aliasOf) {
            // Replace all occurrences of the macro name with the alias for this list
            const escapedMainName = escapeRegex(macro.aliasOf);
            return macro.displayOverride.replace(new RegExp(`(?<=[\\b{\\s])${escapedMainName}(?=[\\b}:\\s])`, 'g'), `${macro.name}`);
        }
        return macro.displayOverride;
    }

    const parts = [macro.name];

    // Add all unnamed args (required + optional)
    for (let i = 0; i < macro.unnamedArgDefs.length; i++) {
        const argDef = macro.unnamedArgDefs[i];
        const argName = argDef?.sampleValue || argDef?.name || `arg${i + 1}`;
        // Wrap optional args in brackets
        parts.push(argDef?.optional ? `[${argName}]` : argName);
    }

    // Add list args indicator
    if (macro.list) {
        const hasMin = macro.list.min > 0;
        const hasMax = macro.list.max !== null;
        if (hasMin && hasMax && macro.list.min === macro.list.max) {
            // Fixed number of list items
            for (let i = 0; i < macro.list.min; i++) {
                parts.push(`item${i + 1}`);
            }
        } else {
            // Variable list
            parts.push('item1', 'item2', '...');
        }
    }

    return `{{${parts.join('::')}}}`;
}

/**
 * Creates a DOM element for a macro's source indicator (extension/third-party icons).
 * @param {MacroDefinition} macro
 * @returns {HTMLElement}
 */
export function createSourceIndicator(macro) {
    const src = document.createElement('span');
    src.classList.add('macro-source', 'fa-solid');

    if (macro.source.isExtension) {
        src.classList.add('isExtension', 'fa-cubes');
        src.classList.add(macro.source.isThirdParty ? 'isThirdParty' : 'isCore');
    } else {
        src.classList.add('isCore', 'fa-star-of-life');
    }

    const titleParts = [
        macro.source.isExtension ? 'Extension' : 'Core',
        macro.source.isThirdParty ? 'Third Party' : (macro.source.isExtension ? 'Built-in' : null),
        macro.source.name,
    ].filter(Boolean);
    src.title = titleParts.join('\n');

    return src;
}

/**
 * Creates a DOM element for alias indicator icon.
 * @param {MacroDefinition} macro
 * @returns {HTMLElement|null}
 */
export function createAliasIndicator(macro) {
    if (!macro.aliasOf) return null;

    const icon = document.createElement('span');
    icon.classList.add('macro-alias-indicator', 'fa-solid', 'fa-arrow-turn-up');
    icon.title = `Alias of {{${macro.aliasOf}}}`;
    return icon;
}

/**
 * Creates a type badge element. Supports single type or array of types.
 * @param {MacroValueType|MacroValueType[]} type - Single type or array of accepted types.
 * @returns {HTMLElement}
 */
export function createTypeBadge(type) {
    const badge = document.createElement('span');
    badge.classList.add('macro-arg-type');

    if (Array.isArray(type)) {
        badge.textContent = type.join(' | ');
        badge.title = `Accepts: ${type.join(', ')}`;
    } else {
        badge.textContent = type;
    }

    return badge;
}

/**
 * Renders a single macro item for the list.
 * Order: [signature] [description (shrinks)] [alias icon?] [source icon]
 * @param {MacroDefinition} macro
 * @returns {HTMLElement}
 */
function renderMacroItem(macro) {
    const item = document.createElement('div');
    item.classList.add('macro-item');
    if (macro.aliasOf) item.classList.add('isAlias');
    item.dataset.macroName = macro.name;

    // Signature (fixed width, truncates if too long)
    const signature = document.createElement('code');
    signature.classList.add('macro-signature');
    signature.textContent = formatMacroSignature(macro);
    item.appendChild(signature);

    // Description preview (shrinks to fit, truncates)
    const desc = document.createElement('span');
    desc.classList.add('macro-desc-preview');
    desc.textContent = macro.description || '<no description>';
    item.appendChild(desc);

    // Alias indicator (if this is an alias entry)
    const aliasIcon = createAliasIndicator(macro);
    if (aliasIcon) item.appendChild(aliasIcon);

    // Source indicator (fixed, stays at right edge)
    item.appendChild(createSourceIndicator(macro));

    return item;
}

/**
 * Renders detailed information for a macro.
 * Can optionally highlight the current argument being typed.
 * @param {MacroDefinition} macro
 * @param {Object} [options]
 * @param {number} [options.currentArgIndex=-1] - Index of argument to highlight (-1 for none).
 * @param {boolean} [options.showCategory=true] - Whether to show category badge.
 * @returns {HTMLElement}
 */
export function renderMacroDetails(macro, options = {}) {
    const { currentArgIndex = -1, showCategory = true } = options;
    const details = document.createElement('div');
    details.classList.add('macro-details');

    // Header with name and source
    const header = document.createElement('div');
    header.classList.add('macro-details-header');

    const nameEl = document.createElement('code');
    nameEl.classList.add('macro-details-name');
    nameEl.textContent = formatMacroSignature(macro);
    header.appendChild(nameEl);

    header.appendChild(createSourceIndicator(macro));
    details.appendChild(header);

    // Category badge (optional)
    if (showCategory) {
        const categoryBadge = document.createElement('span');
        categoryBadge.classList.add('macro-category-badge');
        categoryBadge.textContent = getCategoryConfig(macro.category).label;
        details.appendChild(categoryBadge);
    }

    // If this is an alias, show what it's an alias of
    if (macro.aliasOf) {
        const aliasOfSection = document.createElement('div');
        aliasOfSection.classList.add('macro-alias-of');
        aliasOfSection.innerHTML = `<i class="fa-solid fa-arrow-turn-up"></i> Alias of <code>{{${macro.aliasOf}}}</code>`;
        details.appendChild(aliasOfSection);
    }

    // Description
    const descSection = document.createElement('div');
    descSection.classList.add('macro-details-section');
    const descLabel = document.createElement('div');
    descLabel.classList.add('macro-details-label');
    descLabel.textContent = 'Description';
    descSection.appendChild(descLabel);
    const descText = document.createElement('div');
    descText.classList.add('macro-details-text');
    descText.textContent = macro.description || '<no description>';
    descSection.appendChild(descText);
    details.appendChild(descSection);

    // Arguments section (if any)
    if (macro.unnamedArgDefs.length > 0 || macro.list) {
        const argsSection = document.createElement('div');
        argsSection.classList.add('macro-details-section');
        const argsLabel = document.createElement('div');
        argsLabel.classList.add('macro-details-label');
        argsLabel.textContent = 'Arguments';
        argsSection.appendChild(argsLabel);

        const argsList = document.createElement('ul');
        argsList.classList.add('macro-args-list');

        // Unnamed args (required + optional)
        for (let i = 0; i < macro.unnamedArgDefs.length; i++) {
            const argDef = macro.unnamedArgDefs[i];
            const argItem = document.createElement('li');
            argItem.classList.add('macro-arg-item');
            if (argDef?.optional) argItem.classList.add('isOptional');
            if (currentArgIndex === i) argItem.classList.add('current');

            const argName = document.createElement('code');
            argName.classList.add('macro-arg-name');
            argName.textContent = argDef?.name || `arg${i + 1}`;
            argItem.appendChild(argName);

            argItem.appendChild(createTypeBadge(argDef.type ?? 'string'));

            const argRequiredLabel = document.createElement('span');
            argRequiredLabel.classList.add(argDef?.optional ? 'macro-arg-optional' : 'macro-arg-required');
            if (argDef?.optional && argDef.defaultValue !== undefined) {
                argRequiredLabel.textContent = `(optional, default: ${argDef.defaultValue === '' ? '<empty string>' : argDef.defaultValue})`;
            } else {
                argRequiredLabel.textContent = argDef?.optional ? '(optional)' : '(required)';
            }
            argItem.appendChild(argRequiredLabel);

            if (argDef?.description) {
                const argDesc = document.createElement('span');
                argDesc.classList.add('macro-arg-desc');
                argDesc.textContent = ` — ${argDef.description}`;
                argItem.appendChild(argDesc);
            }

            if (argDef?.sampleValue) {
                const sample = document.createElement('span');
                sample.classList.add('macro-arg-sample');
                sample.textContent = ` (e.g. ${argDef.sampleValue})`;
                argItem.appendChild(sample);
            }

            argsList.appendChild(argItem);
        }

        // List args
        if (macro.list) {
            const listItem = document.createElement('li');
            listItem.classList.add('macro-arg-item', 'macro-arg-list');
            if (currentArgIndex >= macro.maxArgs) listItem.classList.add('current');

            const listName = document.createElement('code');
            listName.classList.add('macro-arg-name');
            listName.textContent = 'item1::item2::...';
            listItem.appendChild(listName);

            const listInfo = document.createElement('span');
            listInfo.classList.add('macro-arg-list-info');

            const minMax = [];
            if (macro.list.min > 0) minMax.push(`min: ${macro.list.min}`);
            if (macro.list.max !== null) minMax.push(`max: ${macro.list.max}`);

            if (minMax.length > 0) {
                listInfo.textContent = ` (list, ${minMax.join(', ')})`;
            } else {
                listInfo.textContent = ' (variable-length list)';
            }
            listItem.appendChild(listInfo);

            argsList.appendChild(listItem);
        }

        argsSection.appendChild(argsList);
        details.appendChild(argsSection);
    }

    // Returns section (always show - at minimum shows the type)
    {
        const returnsSection = document.createElement('div');
        returnsSection.classList.add('macro-details-section');
        const returnsLabel = document.createElement('div');
        returnsLabel.classList.add('macro-details-label');
        returnsLabel.textContent = 'Returns';
        returnsSection.appendChild(returnsLabel);

        const returnsContent = document.createElement('div');
        returnsContent.classList.add('macro-returns-content');

        // Add return type badge
        const returnTypeBadge = createTypeBadge(macro.returnType);
        returnsContent.appendChild(returnTypeBadge);

        // Add description text if provided
        if (macro.returns) {
            const returnsText = document.createElement('span');
            returnsText.classList.add('macro-details-text');
            returnsText.textContent = macro.returns;
            returnsContent.appendChild(returnsText);
        }

        returnsSection.appendChild(returnsContent);
        details.appendChild(returnsSection);
    }

    // Example usage section (if any)
    if (macro.exampleUsage && macro.exampleUsage.length > 0) {
        const exampleSection = document.createElement('div');
        exampleSection.classList.add('macro-details-section');
        const exampleLabel = document.createElement('div');
        exampleLabel.classList.add('macro-details-label');
        exampleLabel.textContent = 'Example Usage';
        exampleSection.appendChild(exampleLabel);

        const exampleList = document.createElement('ul');
        exampleList.classList.add('macro-example-list');
        for (const example of macro.exampleUsage) {
            const li = document.createElement('li');
            const code = document.createElement('code');
            code.textContent = example;
            li.appendChild(code);
            exampleList.appendChild(li);
        }
        exampleSection.appendChild(exampleList);
        details.appendChild(exampleSection);
    }

    // Aliases section (if this macro has aliases)
    if (macro.aliases && macro.aliases.length > 0) {
        const aliasSection = document.createElement('div');
        aliasSection.classList.add('macro-details-section');
        const aliasLabel = document.createElement('div');
        aliasLabel.classList.add('macro-details-label');
        aliasLabel.textContent = 'Aliases';
        aliasSection.appendChild(aliasLabel);

        const aliasList = document.createElement('ul');
        aliasList.classList.add('macro-alias-list');
        for (const { alias, visible } of macro.aliases) {
            const li = document.createElement('li');
            li.classList.add('macro-alias-item');
            if (!visible) li.classList.add('isHidden');

            const code = document.createElement('code');
            code.textContent = `{{${alias}}}`;
            li.appendChild(code);

            if (!visible) {
                const hiddenBadge = document.createElement('span');
                hiddenBadge.classList.add('macro-alias-hidden-badge');
                hiddenBadge.textContent = '(deprecated)';
                hiddenBadge.title = 'This alias is deprecated and will not be shown in documentation or autocomplete';
                li.appendChild(hiddenBadge);
            }

            aliasList.appendChild(li);
        }
        aliasSection.appendChild(aliasList);
        details.appendChild(aliasSection);
    }

    return details;
}
