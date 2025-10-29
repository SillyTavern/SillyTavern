import { eventSource, event_types, saveSettingsDebounced } from '../../../script.js';
import { extension_settings } from '../../extensions.js';
import { accountStorage } from '../../util/AccountStorage.js';

const extensionName = 'mobile-quick-layout';
const extensionSettingsKey = 'mobileQuickLayout';
const extensionFolderPath = `scripts/extensions/${extensionName}`;
const defaultSettings = {
    enabled: true,
    isEnabled: true,
};

const LAYOUT_MODES = {
    ENHANCED: 'enhanced',
    CLASSIC: 'classic',
};

const LAYOUT_STORAGE_KEY = 'mobileQuickLayoutMode';
const DRAWER_PREFERENCE_KEY = 'mobileQuickDrawerPreferences';
const CUSTOMIZATION_PANEL_STATE_KEY = 'mobileQuickCustomizationExpanded';

let hasAppReadyInitialized = false;
let rebindSettingsControls = null;
let requestRenderShortcuts = null;

primeInitialLayoutMode();

function ensureSettingsObject() {
    extension_settings[extensionSettingsKey] = extension_settings[extensionSettingsKey] || {};
    if (Object.keys(extension_settings[extensionSettingsKey]).length === 0) {
        Object.assign(extension_settings[extensionSettingsKey], defaultSettings);
        saveSettingsDebounced();
    }
    return extension_settings[extensionSettingsKey];
}

function primeInitialLayoutMode() {
    const root = document.documentElement;
    if (!root) return;

    const fallbackMode = LAYOUT_MODES.CLASSIC;
    try {
        const stored = safeGetItem(LAYOUT_STORAGE_KEY);
        const mode = stored === LAYOUT_MODES.ENHANCED ? LAYOUT_MODES.ENHANCED : fallbackMode;
        root.setAttribute('data-mobile-quick-layout', mode);
    } catch (error) {
        root.setAttribute('data-mobile-quick-layout', fallbackMode);
    }
}

function safeGetItem(key) {
    try {
        return accountStorage.getItem(key);
    } catch (e) {
        return null;
    }
}

function safeSetItem(key, value) {
    try {
        accountStorage.setItem(key, value);
    } catch (e) {
        // no-op
    }
}

function ensureSettingsScaffold() {
    const settingsColumn = document.getElementById('UI-Theme-Block');
    if (!settingsColumn) {
        return {
            layoutToggleInput: null,
            customizationSection: null,
            customizationList: null,
            customizationResetButton: null,
        };
    }

    let wrapper = document.getElementById('mobile-quick-settings');
    if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.id = 'mobile-quick-settings';
        wrapper.className = 'flex-container flexFlowColumn mobile-quick-layout-setting';

        const label = document.createElement('label');
        label.className = 'checkbox_label';
        label.setAttribute('for', 'mobile-quick-layout-toggle');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = 'mobile-quick-layout-toggle';

        const labelText = document.createElement('span');
        labelText.setAttribute('data-i18n', 'Use classic top controls');
        labelText.textContent = 'Use classic top controls';

        label.append(checkbox, labelText);

        const hint = document.createElement('small');
        hint.className = 'mobile-quick-layout-setting__hint';
        hint.setAttribute('data-i18n', 'Restores the default toolbar and hides the mobile quick panel.');
        hint.textContent = 'Restores the default toolbar and hides the mobile quick panel.';

        const customization = document.createElement('details');
        customization.id = 'mobile-quick-customization';
        customization.className = 'mobile-quick-customization';
        customization.hidden = true;

        const summary = document.createElement('summary');
        summary.className = 'mobile-quick-customization__summary';

        const title = document.createElement('span');
        title.className = 'mobile-quick-customization__title';
        title.setAttribute('data-i18n', 'Quick toolbar layout');
        title.textContent = 'Quick toolbar layout';

        const chevron = document.createElement('span');
        chevron.className = 'mobile-quick-customization__chevron';
        chevron.setAttribute('aria-hidden', 'true');

        summary.append(title, chevron);

        const content = document.createElement('div');
        content.className = 'mobile-quick-customization__content';

        const explanation = document.createElement('p');
        explanation.className = 'mobile-quick-customization__hint';
        explanation.setAttribute('data-i18n', 'Choose which drawers appear in the top toolbar. Others will show in the secondary panel.');
        explanation.textContent = 'Choose which drawers appear in the top toolbar. Others will show in the secondary panel.';

        const list = document.createElement('div');
        list.id = 'mobile-quick-customization-list';
        list.className = 'mobile-quick-customization__list';
        list.setAttribute('role', 'list');

        const resetButton = document.createElement('button');
        resetButton.type = 'button';
        resetButton.id = 'mobile-quick-customization-reset';
        resetButton.className = 'mobile-quick-customization__reset';
        resetButton.setAttribute('data-i18n', 'Restore defaults');
        resetButton.textContent = 'Restore defaults';

        content.append(explanation, list, resetButton);
        customization.append(summary, content);

        wrapper.append(label, hint, customization);

        settingsColumn.insertBefore(wrapper, settingsColumn.firstChild);
    }

    return {
        layoutToggleInput: wrapper.querySelector('#mobile-quick-layout-toggle'),
        customizationSection: wrapper.querySelector('#mobile-quick-customization'),
        customizationList: wrapper.querySelector('#mobile-quick-customization-list'),
        customizationResetButton: wrapper.querySelector('#mobile-quick-customization-reset'),
    };
}

function initializeMobileQuickLayout() {
    const settings = ensureSettingsObject();
    const enabled = settings.enabled ?? settings.isEnabled ?? true;
    if (!enabled) return;

    if (hasAppReadyInitialized) {
        if (typeof rebindSettingsControls === 'function') {
            const sync = rebindSettingsControls();
            if (typeof requestRenderShortcuts === 'function') {
                requestRenderShortcuts();
            }
            return sync;
        }
        return null;
    }

    hasAppReadyInitialized = true;

    let {
        layoutToggleInput,
        customizationSection,
        customizationList,
        customizationResetButton,
    } = ensureSettingsScaffold();

    const currentLayoutModeFromStorage = () => {
        try {
            const stored = safeGetItem(LAYOUT_STORAGE_KEY);
            return stored === LAYOUT_MODES.ENHANCED ? LAYOUT_MODES.ENHANCED : LAYOUT_MODES.CLASSIC;
        } catch (e) {
            return LAYOUT_MODES.CLASSIC;
        }
    };

    const persistLayoutMode = (mode) => {
        safeSetItem(LAYOUT_STORAGE_KEY, mode);
    };

    const loadDrawerPreferences = () => {
        try {
            const raw = safeGetItem(DRAWER_PREFERENCE_KEY);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (e) {
            return {};
        }
    };

    const persistDrawerPreferences = (preferences) => {
        try {
            safeSetItem(DRAWER_PREFERENCE_KEY, JSON.stringify(preferences));
        } catch (e) {
            // ignore
        }
    };

    const loadCustomizationPanelState = () => {
        try {
            const raw = safeGetItem(CUSTOMIZATION_PANEL_STATE_KEY);
            if (raw === 'true') return true;
            if (raw === 'false') return false;
        } catch (e) {
            // ignore
        }
        return null;
    };

    const persistCustomizationPanelState = (isOpen) => {
        try {
            if (typeof isOpen === 'boolean') {
                safeSetItem(CUSTOMIZATION_PANEL_STATE_KEY, String(isOpen));
            } else {
                safeSetItem(CUSTOMIZATION_PANEL_STATE_KEY, 'false');
            }
        } catch (e) {
            // ignore
        }
    };

    let currentLayoutMode = currentLayoutModeFromStorage();
    let drawerPreferences = loadDrawerPreferences();
    let customizationPanelState = loadCustomizationPanelState();
    const primaryButtons = new Map();
    let activeDrawerTarget = null;
    let suppressPanelClose = false;

    const getDrawerPreference = (targetId) => {
        const val = drawerPreferences?.[targetId];
        if (val === 'primary' || val === 'secondary' || val === 'hidden') return val;
        return undefined;
    };

    const setDrawerPreference = (targetId, priority) => {
        const allowed = new Set(['primary', 'secondary', 'hidden']);
        if (!allowed.has(priority)) {
            delete drawerPreferences[targetId];
        } else {
            drawerPreferences[targetId] = priority;
        }
        persistDrawerPreferences(drawerPreferences);
    };

    const resetDrawerPreferences = () => {
        drawerPreferences = {};
        persistDrawerPreferences(drawerPreferences);
    };

    const sanitizeIconClass = (iconClass = '') => {
        if (!iconClass) return 'fa-solid fa-gear';
        const blacklist = new Set(['drawer-icon', 'closedIcon', 'openIcon', 'drawer-toggle-icon']);
        const filtered = iconClass.split(/\s+/).map((c) => c.trim()).filter((c) => c && !blacklist.has(c));
        return filtered.length ? filtered.join(' ') : 'fa-solid fa-gear';
    };

    const createIconSpan = (iconClass) => {
        const iconSpan = document.createElement('span');
        iconSpan.classList.add('mobile-quick-icon');
        const classes = sanitizeIconClass(iconClass).split(/\s+/).map((c) => c.trim()).filter(Boolean);
        classes.forEach((cls) => iconSpan.classList.add(cls));
        if (!classes.some((cls) => cls.startsWith('fa-'))) iconSpan.classList.add('fa-solid', 'fa-gear');
        return iconSpan;
    };

    const createLabelSpan = (labelKey, fallbackLabel) => {
        const labelSpan = document.createElement('span');
        labelSpan.classList.add('mobile-quick-label');
        labelSpan.textContent = fallbackLabel || '';
        if (labelKey) labelSpan.setAttribute('data-i18n', labelKey);
        return labelSpan;
    };

    const updateLayoutMetrics = () => {
        try {
            const root = document.documentElement;
            if (!root) return;

            const isEnhanced = root.getAttribute('data-mobile-quick-layout') === LAYOUT_MODES.ENHANCED;
            const primaryWrap = document.querySelector('.mobile-quick-primary-wrap');
            const measuredHeight = isEnhanced ? Math.round(primaryWrap?.getBoundingClientRect?.().height ?? 0) : 0;
            const topValue = measuredHeight > 0 ? `${measuredHeight}px` : '';
            const heightValue = measuredHeight > 0 ? `calc(100vh - ${measuredHeight}px)` : '';

            const sheld = document.getElementById('sheld');
            if (sheld instanceof HTMLElement) {
                sheld.style.top = topValue;
                sheld.style.height = heightValue;
            }

            document.querySelectorAll('#top-settings-holder .drawer-content').forEach((drawerContent) => {
                if (drawerContent instanceof HTMLElement) {
                    drawerContent.style.top = topValue;
                    drawerContent.style.height = heightValue;
                }
            });
        } catch (e) {
            // no-op
        }
    };

    const clearPrimaryButtonStates = () => {
        primaryButtons.forEach((btn) => {
            btn.classList.remove('is-active');
            btn.setAttribute('aria-pressed', 'false');
        });
    };

    const setPrimaryButtonActive = (targetId, isActive) => {
        const btn = primaryButtons.get(targetId);
        if (!btn) return;
        btn.classList.toggle('is-active', Boolean(isActive));
        btn.setAttribute('aria-pressed', String(Boolean(isActive)));
    };

    const handleMobileShortcut = (event) => {
        const el = event.currentTarget;
        if (!el) return;
        const targetId = el.getAttribute('data-drawer-target');
        if (!targetId) return;

        const drawer = document.getElementById(targetId);
        if (!(drawer instanceof HTMLElement)) return;
        const toggle = drawer.querySelector('.drawer-toggle, .drawer-header');
        const drawerContent = drawer.querySelector('.drawer-content');
        if (!(toggle instanceof HTMLElement) || !(drawerContent instanceof HTMLElement)) return;

        event.preventDefault();

        const isCurrentlyClosed = drawerContent.classList.contains('closedDrawer');
        const isActiveTarget = activeDrawerTarget === targetId && !isCurrentlyClosed;
        const willOpen = !isActiveTarget;

        suppressPanelClose = true;

        if (willOpen) {
            activeDrawerTarget = targetId;
            clearPrimaryButtonStates();
        }

        if (typeof toggle.click === 'function') toggle.click();
        else toggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        if (willOpen) setPrimaryButtonActive(targetId, true);
        else {
            setPrimaryButtonActive(targetId, false);
            if (activeDrawerTarget === targetId) activeDrawerTarget = null;
        }

        toggle.classList.add('mobile-drawer-highlight');
        if (typeof toggle.focus === 'function') {
            toggle.focus({ preventScroll: true });
        }
        window.setTimeout(() => toggle.classList.remove('mobile-drawer-highlight'), 520);
        window.setTimeout(() => {
            suppressPanelClose = false;
            const isClosedNow = drawerContent.classList.contains('closedDrawer');
            if (isClosedNow) {
                if (activeDrawerTarget === targetId) activeDrawerTarget = null;
                setPrimaryButtonActive(targetId, false);
            } else {
                activeDrawerTarget = targetId;
                clearPrimaryButtonStates();
                setPrimaryButtonActive(targetId, true);
            }
        }, 160);
    };

    const createShortcutButton = (config, options = {}) => {
        const { targetId, iconClass, fallbackLabel } = config;
        if (!document.getElementById(targetId)) return null;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = options.className ?? 'mobile-quick-panel-button';
        button.setAttribute('data-drawer-target', targetId);
        button.setAttribute('aria-controls', targetId);
        button.setAttribute('aria-label', fallbackLabel || targetId);
        button.setAttribute('aria-pressed', 'false');
        button.appendChild(createIconSpan(iconClass));
        const labelSpan = createLabelSpan(null, fallbackLabel);
        if (options.labelHidden) labelSpan.classList.add('sr-only');
        button.appendChild(labelSpan);
        button.addEventListener('click', handleMobileShortcut);
        options.container?.appendChild(button);
        if ((button.className || '').includes('mobile-quick-button')) primaryButtons.set(targetId, button);
        return button;
    };

    const applyLayoutModeSideEffects = () => {
        try {
            document.documentElement.setAttribute('data-mobile-quick-layout', currentLayoutMode);
        } catch (e) {
            /* no-op */
        }
        const quickToggle = document.getElementById('mobile-quick-toggle');
        if (quickToggle) {
            if (currentLayoutMode === LAYOUT_MODES.CLASSIC) quickToggle.setAttribute('hidden', ''); else quickToggle.removeAttribute('hidden');
        }
        syncLayoutModeControls();
        updateLayoutMetrics();
    };

    const syncQuickPanelState = (isOpen) => {
        const quickToggle = document.getElementById('mobile-quick-toggle');
        const quickPanel = document.getElementById('mobile-quick-panel');
        if (!quickPanel) return;
        quickPanel.classList.toggle('is-open', Boolean(isOpen));
        if (isOpen) quickPanel.removeAttribute('hidden'); else quickPanel.setAttribute('hidden', '');
        if (quickToggle) {
            quickToggle.setAttribute('aria-expanded', String(Boolean(isOpen)));
            const icon = quickToggle.querySelector('.fa-solid');
            if (icon) {
                icon.classList.toggle('fa-circle-plus', !isOpen);
                icon.classList.toggle('fa-circle-minus', Boolean(isOpen));
            }
        }
        updateLayoutMetrics();
    };

    const renderShortcuts = () => {
        const topSettingsHolder = document.getElementById('top-settings-holder');
        const sendForm = document.getElementById('send_form');

        const quickPanel = document.getElementById('mobile-quick-panel') || (() => {
            const panel = document.createElement('div');
            panel.id = 'mobile-quick-panel';
            panel.className = 'mobile-quick-panel';
            panel.setAttribute('aria-live', 'polite');
            panel.setAttribute('role', 'region');
            panel.tabIndex = -1;
            const parent = sendForm ?? document.body;
            const anchor = parent.querySelector('#mobile-quick-primary-wrap');
            if (anchor && anchor.nextSibling) {
                parent.insertBefore(panel, anchor.nextSibling);
            } else {
                parent.appendChild(panel);
            }
            return panel;
        })();

        if (sendForm && quickPanel.parentElement !== sendForm) {
            const anchor = sendForm.querySelector('#mobile-quick-primary-wrap');
            if (anchor && anchor.nextSibling) sendForm.insertBefore(quickPanel, anchor.nextSibling); else sendForm.appendChild(quickPanel);
        }

        const primaryContainer = document.getElementById('mobile-quick-primary') || (() => {
            const wrap = document.createElement('div');
            wrap.id = 'mobile-quick-primary-wrap';
            wrap.className = 'mobile-quick-primary-wrap';
            const inner = document.createElement('div');
            inner.id = 'mobile-quick-primary';
            inner.className = 'mobile-quick-primary';
            wrap.appendChild(inner);
            const parent = topSettingsHolder ?? document.body;
            const reference = parent?.firstElementChild ?? null;
            if (reference) parent.insertBefore(wrap, reference); else parent.appendChild(wrap);
            return inner;
        })();

        if (topSettingsHolder) {
            const wrap = document.getElementById('mobile-quick-primary-wrap');
            if (wrap && wrap.parentElement !== topSettingsHolder) {
                const reference = topSettingsHolder.firstElementChild;
                if (reference) topSettingsHolder.insertBefore(wrap, reference); else topSettingsHolder.appendChild(wrap);
            }
        }
        const leftSendForm = document.getElementById('leftSendForm');
        if (leftSendForm && !document.getElementById('mobile-quick-toggle')) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.id = 'mobile-quick-toggle';
            btn.className = 'mobile-quick-toggle interactable';
            btn.setAttribute('aria-controls', 'mobile-quick-panel');
            btn.setAttribute('aria-expanded', 'false');
            const icon = document.createElement('span');
            icon.className = 'fa-solid fa-circle-plus';
            icon.setAttribute('aria-hidden', 'true');
            const sr = document.createElement('span');
            sr.className = 'sr-only';
            sr.setAttribute('data-i18n', 'Toggle quick panels');
            sr.textContent = 'Toggle quick panels';
            btn.appendChild(icon);
            btn.appendChild(sr);
            leftSendForm.insertBefore(btn, leftSendForm.firstChild);
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const isOpen = document.getElementById('mobile-quick-panel')?.classList.contains('is-open');
                syncQuickPanelState(!isOpen);
            });
        }

        const drawers = topSettingsHolder ? Array.from(topSettingsHolder.querySelectorAll(':scope > .drawer')) : [];
        const configs = drawers.map((drawer, index) => {
            if (!(drawer instanceof HTMLElement)) {
                return null;
            }
            const targetId = drawer.id;
            if (!targetId) return null;
            const toggleElement = drawer.querySelector('.drawer-toggle, .drawer-header');
            const iconElement = toggleElement instanceof HTMLElement ? toggleElement.querySelector('.drawer-icon, i') : drawer.querySelector('.drawer-icon, i');
            const iconClass = drawer.dataset.mobileIcon || (iconElement instanceof HTMLElement ? iconElement.className : '') || '';
            const fallbackLabel = drawer.dataset.mobileLabel
                || (toggleElement instanceof HTMLElement ? toggleElement.getAttribute('title') : toggleElement?.getAttribute?.('title'))
                || iconElement?.getAttribute?.('title')
                || (toggleElement?.textContent ? toggleElement.textContent.trim() : '')
                || (iconElement?.textContent ? iconElement.textContent.trim() : '')
                || targetId;
            const defaultPriority = ['rightNavHolder', 'ai-config-button', 'WI-SP-button', 'extensions-settings-button'].includes(targetId) ? 'primary' : 'secondary';
            const priority = getDrawerPreference(targetId) ?? defaultPriority;
            return { targetId, iconClass, fallbackLabel, priority, defaultPriority, order: index };
        }).filter(Boolean);

        primaryContainer.innerHTML = '';
        quickPanel.innerHTML = '';

        const primaryConfigs = configs.filter((c) => c.priority === 'primary').sort((a, b) => a.order - b.order);
        const secondaryConfigs = configs.filter((c) => c.priority !== 'primary').sort((a, b) => a.order - b.order);

        primaryConfigs.forEach((cfg) => {
            createShortcutButton(cfg, { container: primaryContainer, className: 'mobile-quick-button', labelHidden: true });
        });

        const panelButtons = document.createElement('div');
        panelButtons.className = 'mobile-quick-panel__buttons';
        quickPanel.appendChild(panelButtons);
        secondaryConfigs.forEach((cfg) => createShortcutButton(cfg, { container: panelButtons, className: 'mobile-quick-panel-button', labelHidden: true }));

        const modeBtn = document.createElement('button');
        modeBtn.type = 'button';
        modeBtn.className = 'mobile-quick-panel-button mobile-layout-toggle-button';
        const isClassic = currentLayoutMode === LAYOUT_MODES.CLASSIC;
        modeBtn.textContent = isClassic ? 'Switch to enhanced mobile layout' : 'Switch to classic layout';
        modeBtn.setAttribute('data-i18n', isClassic ? 'Switch to enhanced mobile layout' : 'Switch to classic layout');
        modeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            setLayoutMode(isClassic ? LAYOUT_MODES.ENHANCED : LAYOUT_MODES.CLASSIC);
        });
        panelButtons.appendChild(modeBtn);

        if (customizationSection && customizationList) {
            if (!Array.isArray(configs) || configs.length === 0) {
                customizationSection.setAttribute('hidden', '');
            } else {
                customizationSection.removeAttribute('hidden');
                if (customizationSection instanceof HTMLDetailsElement) {
                    if (typeof customizationPanelState === 'boolean') customizationSection.open = customizationPanelState;
                    else customizationSection.open = Object.keys(drawerPreferences || {}).length > 0;
                }

                customizationList.innerHTML = '';
                const frag = document.createDocumentFragment();
                const sorted = configs.slice().sort((a, b) => (a.fallbackLabel || '').localeCompare(b.fallbackLabel || ''));
                sorted.forEach((cfg) => {
                    const item = document.createElement('div');
                    item.className = 'mobile-quick-customization__item';
                    item.setAttribute('role', 'listitem');
                    const label = document.createElement('span');
                    label.className = 'mobile-quick-customization__label';
                    label.textContent = cfg.fallbackLabel || cfg.targetId;
                    label.setAttribute('data-drawer-id', cfg.targetId);
                    const select = document.createElement('select');
                    select.className = 'mobile-quick-customization__select';
                    select.dataset.drawerId = cfg.targetId;
                    select.dataset.defaultPriority = cfg.defaultPriority ?? 'secondary';
                    const optPrimary = document.createElement('option');
                    optPrimary.value = 'primary';
                    optPrimary.textContent = 'Top toolbar';
                    optPrimary.setAttribute('data-i18n', 'Top toolbar');
                    const optSecondary = document.createElement('option');
                    optSecondary.value = 'secondary';
                    optSecondary.textContent = 'Secondary panel';
                    optSecondary.setAttribute('data-i18n', 'Secondary panel');
                    const optHidden = document.createElement('option');
                    optHidden.value = 'hidden';
                    optHidden.textContent = 'Hidden';
                    select.append(optPrimary, optSecondary, optHidden);
                    const effective = getDrawerPreference(cfg.targetId) ?? cfg.priority ?? 'secondary';
                    if (select.querySelector(`option[value="${effective}"]`)) select.value = effective; else select.value = 'secondary';
                    select.addEventListener('change', (ev) => {
                        const target = ev.currentTarget;
                        if (!(target instanceof HTMLSelectElement)) return;
                        const val = target.value;
                        const defaultPriority = target.dataset.defaultPriority ?? cfg.defaultPriority ?? 'secondary';
                        if (val === defaultPriority) setDrawerPreference(cfg.targetId, undefined);
                        else setDrawerPreference(cfg.targetId, val);
                        renderShortcuts();
                    });
                    item.append(label, select);
                    frag.appendChild(item);
                });
                customizationList.appendChild(frag);
                if (customizationResetButton instanceof HTMLButtonElement) {
                    customizationResetButton.disabled = !Object.keys(drawerPreferences || {}).length;
                }
            }
        }

        if (currentLayoutMode === LAYOUT_MODES.CLASSIC) {
            primaryContainer.setAttribute('hidden', '');
            const msg = document.createElement('p');
            msg.className = 'mobile-quick-mode-message';
            msg.textContent = 'Mobile quick layout disabled';
            msg.setAttribute('data-i18n', 'Mobile quick layout disabled');
            quickPanel.appendChild(msg);
        }

        updateLayoutMetrics();
    };

    const syncLayoutModeControls = () => {
        if (!(layoutToggleInput instanceof HTMLInputElement)) {
            return;
        }
        const shouldCheck = currentLayoutMode === LAYOUT_MODES.CLASSIC;
        if (layoutToggleInput.checked !== shouldCheck) {
            layoutToggleInput.checked = shouldCheck;
        }
    };

    const setLayoutMode = (mode, { persist = true, force = false } = {}) => {
        const targetMode = mode === LAYOUT_MODES.ENHANCED ? LAYOUT_MODES.ENHANCED : LAYOUT_MODES.CLASSIC;
        if (!force && targetMode === currentLayoutMode) {
            applyLayoutModeSideEffects();
            return;
        }
        currentLayoutMode = targetMode;
        if (persist) persistLayoutMode(currentLayoutMode);
        applyLayoutModeSideEffects();
        renderShortcuts();
    };

    rebindSettingsControls = () => {
        const scaffold = ensureSettingsScaffold();
        layoutToggleInput = scaffold.layoutToggleInput;
        customizationSection = scaffold.customizationSection;
        customizationList = scaffold.customizationList;
        customizationResetButton = scaffold.customizationResetButton;

        if (layoutToggleInput instanceof HTMLInputElement && layoutToggleInput.dataset.mobileQuickBound !== 'true') {
            layoutToggleInput.addEventListener('change', (ev) => {
                const target = ev.currentTarget;
                const nextMode = target instanceof HTMLInputElement && target.checked ? LAYOUT_MODES.CLASSIC : LAYOUT_MODES.ENHANCED;
                setLayoutMode(nextMode);
            });
            layoutToggleInput.dataset.mobileQuickBound = 'true';
        }

        const detailsSection = customizationSection instanceof HTMLDetailsElement ? customizationSection : null;
        if (detailsSection && detailsSection.dataset.mobileQuickBound !== 'true') {
            detailsSection.addEventListener('toggle', () => {
                customizationPanelState = detailsSection.open;
                persistCustomizationPanelState(customizationPanelState);
            });
            detailsSection.dataset.mobileQuickBound = 'true';
        }

        const resetBtn = customizationResetButton instanceof HTMLButtonElement ? customizationResetButton : null;
        if (resetBtn && resetBtn.dataset.mobileQuickBound !== 'true') {
            resetBtn.addEventListener('click', () => {
                resetDrawerPreferences();
                renderShortcuts();
            });
            resetBtn.dataset.mobileQuickBound = 'true';
        }

        return scaffold;
    };

    requestRenderShortcuts = () => renderShortcuts();

    rebindSettingsControls();

    document.addEventListener('click', (ev) => {
        const quickPanel = document.getElementById('mobile-quick-panel');
        if (!quickPanel || !quickPanel.classList.contains('is-open')) return;
        if (suppressPanelClose) return;
        const target = ev.target;
        if (!(target instanceof Element)) {
            return;
        }
        const isToggle = target.closest('.mobile-quick-toggle');
        const insidePanel = target.closest('#mobile-quick-panel');
        const insidePrimary = target.closest('#mobile-quick-primary');
        if (!isToggle && !insidePanel && !insidePrimary) syncQuickPanelState(false);
    });

    document.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') {
            const quickPanel = document.getElementById('mobile-quick-panel');
            if (quickPanel && quickPanel.classList.contains('is-open')) {
                syncQuickPanelState(false);
                const quickToggle = document.getElementById('mobile-quick-toggle');
                quickToggle?.focus?.({ preventScroll: true });
            }
        }
    });

    applyLayoutModeSideEffects();
    renderShortcuts();

    const topSettingsHolder = document.getElementById('top-settings-holder');
    if (topSettingsHolder && 'MutationObserver' in window) {
        const observer = new MutationObserver((mutations) => {
            const shouldRebuild = mutations.some((mutation) => {
                const nodes = [...mutation.addedNodes, ...mutation.removedNodes];
                return nodes.some((node) => node instanceof HTMLElement && node.classList?.contains('drawer'));
            });
            if (shouldRebuild) renderShortcuts();
        });
        observer.observe(topSettingsHolder, { childList: true });
    }

    return null;
}

eventSource.on(event_types.APP_READY, initializeMobileQuickLayout);

eventSource.on(event_types.EXTENSION_SETTINGS_LOADED, () => {
    ensureSettingsObject();
    if (typeof rebindSettingsControls === 'function') {
        rebindSettingsControls();
        if (typeof requestRenderShortcuts === 'function') {
            requestRenderShortcuts();
        }
    } else {
        ensureSettingsScaffold();
    }
});

jQuery(() => {
    ensureSettingsObject();
    ensureSettingsScaffold();
    void extensionFolderPath;
});

export default {};
