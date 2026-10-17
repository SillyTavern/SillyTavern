import { extension_settings } from './extensions.js';
import { event_types, eventSource, getRequestHeaders, saveSettingsDebounced } from '../script.js';
import { VIDEO_EXTENSIONS } from './constants.js';
import { t } from './i18n.js';
import { callGenericPopup, Popup, POPUP_TYPE } from './popup.js';
import { renderTemplateAsync } from './templates.js';
import { humanFileSize, timestampToMoment } from './utils.js';

/** @type {typeof import('toastr')} */
const dataMaidToastr = toastr;

const BACKUP_RETENTION_DEFAULT = 5;
const BACKUP_RETENTION_MAX = 1000;
const STARTUP_CLEANUP_DELAY = 5000;
const STARTUP_CLEANUP_LOCK_KEY = 'dataMaidStartupCleanupLock';
const STARTUP_CLEANUP_LOCK_DURATION = 10 * 60 * 1000;
let dataMaidScanInProgress = false;

/**
 * @typedef {object} DataMaidSettings
 * @property {Record<string, boolean>} autoDelete
 * @property {{chat: number, settings: number}} backupRetention
 * @property {{enabled: boolean, intervalDays: number, intervalHours: number, lastRun: number|null}} startupAutoDelete
 */


/** @type {Record<string, {name: string, description: string}>} */
const DATA_MAID_CATEGORIES = {
    get files() {
        return {
            name: t`Files`,
            description: t`Files that are not associated with chat messages or Data Bank. WILL DELETE MANUAL UPLOADS!`,
        };
    },
    get images() {
        return {
            name: t`Images`,
            description: t`Images that are not associated with chat messages. WILL DELETE MANUAL UPLOADS!`,
        };
    },
    get chats() {
        return {
            name: t`Chats`,
            description: t`Chat files associated with deleted characters.`,
        };
    },
    get groupChats() {
        return {
            name: t`Group Chats`,
            description: t`Chat files associated with deleted groups.`,
        };
    },
    get avatarThumbnails() {
        return {
            name: t`Avatar Thumbnails`,
            description: t`Thumbnails for avatars of missing or deleted characters.`,
        };
    },
    get backgroundThumbnails() {
        return {
            name: t`Background Thumbnails`,
            description: t`Thumbnails for missing or deleted backgrounds.`,
        };
    },
    get personaThumbnails() {
        return {
            name: t`Persona Thumbnails`,
            description: t`Thumbnails for missing or deleted personas.`,
        };
    },
    get chatBackups() {
        return {
            name: t`Chat Backups`,
            description: t`Automatically generated chat backups.`,
        };
    },
    get settingsBackups() {
        return {
            name: t`Settings Backups`,
            description: t`Automatically generated settings backups.`,
        };
    },
};

/** @type {DataMaidSettings} */
const DATA_MAID_DEFAULT_SETTINGS = {
    autoDelete: Object.fromEntries(
        Object.keys(DATA_MAID_CATEGORIES).map(key => [key, false]),
    ),
    backupRetention: {
        chat: BACKUP_RETENTION_DEFAULT,
        settings: BACKUP_RETENTION_DEFAULT,
    },
    startupAutoDelete: {
        enabled: false,
        intervalDays: 1,
        intervalHours: 0,
        lastRun: null,
    },
};

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function acquireStartupCleanupLock() {
    try {
        const now = Date.now();
        const currentLock = JSON.parse(localStorage.getItem(STARTUP_CLEANUP_LOCK_KEY) ?? 'null');
        if (currentLock?.expiresAt > now) {
            return null;
        }

        const token = `${now}-${Math.random()}`;
        localStorage.setItem(STARTUP_CLEANUP_LOCK_KEY, JSON.stringify({
            token,
            expiresAt: now + STARTUP_CLEANUP_LOCK_DURATION,
        }));
        return JSON.parse(localStorage.getItem(STARTUP_CLEANUP_LOCK_KEY) ?? 'null')?.token === token
            ? token
            : null;
    } catch (error) {
        console.error('Unable to acquire the startup Clean-Up lock:', error);
        return null;
    }
}

/**
 * @param {string} token
 */
function releaseStartupCleanupLock(token) {
    try {
        const currentLock = JSON.parse(localStorage.getItem(STARTUP_CLEANUP_LOCK_KEY) ?? 'null');
        if (currentLock?.token === token) {
            localStorage.removeItem(STARTUP_CLEANUP_LOCK_KEY);
        }
    } catch (error) {
        console.error('Unable to release the startup Clean-Up lock:', error);
    }
}

/**
 * @typedef {object} DataMaidReportResult
 * @property {import('../../src/endpoints/data-maid.js').DataMaidSanitizedReport} report - The sanitized report of the Data Maid.
 * @property {string} token - The token to use for the Data Maid report.
 */

/**
 * Data Maid Dialog class for managing the cleanup dialog interface.
 */
class DataMaidDialog {
    constructor() {
        this.token = null;
        this.container = null;
        this.settings = this.getSettings();

        this.DATA_MAID_CATEGORIES = DATA_MAID_CATEGORIES;
    }

    /**
     * Initializes and returns the persisted Clean-Up preferences.
     * @returns {DataMaidSettings}
     */
    getSettings() {
        /** @type {Record<string, any>} */
        const settingsStore = extension_settings;
        const persistedSettings = isRecord(settingsStore.dataMaid) ? settingsStore.dataMaid : {};
        /** @type {Record<string, unknown>} */
        const persistedAutoDelete = isRecord(persistedSettings.autoDelete) ? persistedSettings.autoDelete : {};
        /** @type {Record<string, unknown>} */
        const persistedRetention = isRecord(persistedSettings.backupRetention) ? persistedSettings.backupRetention : {};
        /** @type {Record<string, unknown>} */
        const persistedStartup = isRecord(persistedSettings.startupAutoDelete) ? persistedSettings.startupAutoDelete : {};

        /** @type {Record<string, boolean>} */
        const autoDelete = {};
        for (const category of Object.keys(DATA_MAID_DEFAULT_SETTINGS.autoDelete)) {
            autoDelete[category] = persistedAutoDelete?.[category] === true;
        }

        /**
         * @param {'chat'|'settings'} category
         * @returns {number}
         */
        const getRetention = (category) => {
            const value = persistedRetention?.[category];
            return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= BACKUP_RETENTION_MAX
                ? value
                : DATA_MAID_DEFAULT_SETTINGS.backupRetention[category];
        };

        const settings = {
            autoDelete,
            backupRetention: {
                chat: getRetention('chat'),
                settings: getRetention('settings'),
            },
            startupAutoDelete: {
                enabled: persistedStartup?.enabled === true,
                intervalDays: typeof persistedStartup?.intervalDays === 'number'
                    && Number.isInteger(persistedStartup.intervalDays)
                    && persistedStartup.intervalDays >= 0
                    && persistedStartup.intervalDays <= 3650
                    ? persistedStartup.intervalDays
                    : DATA_MAID_DEFAULT_SETTINGS.startupAutoDelete.intervalDays,
                intervalHours: typeof persistedStartup?.intervalHours === 'number'
                    && Number.isInteger(persistedStartup.intervalHours)
                    && persistedStartup.intervalHours >= 0
                    && persistedStartup.intervalHours <= 23
                    ? persistedStartup.intervalHours
                    : DATA_MAID_DEFAULT_SETTINGS.startupAutoDelete.intervalHours,
                lastRun: typeof persistedStartup?.lastRun === 'number'
                    && Number.isInteger(persistedStartup.lastRun)
                    && persistedStartup.lastRun >= 0
                    ? persistedStartup.lastRun
                    : DATA_MAID_DEFAULT_SETTINGS.startupAutoDelete.lastRun,
            },
        };
        settingsStore.dataMaid = settings;
        return settings;
    }

    /**
     * Returns a promise that resolves to the Data Maid report.
     * @returns {Promise<DataMaidReportResult>}
     * @private
     */
    async getReport() {
        const response = await fetch('/api/data-maid/report', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ strict: Object.values(this.settings.autoDelete).some(Boolean) }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(error || `Error fetching Data Maid report: ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Finalizes the Data Maid process by sending a request to the server.
     * @returns {Promise<void>}
     * @private
     */
    async finalize() {
        const response = await fetch('/api/data-maid/finalize', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ token: this.token }),
        });

        if (!response.ok) {
            throw new Error(`Error finalizing Data Maid: ${response.statusText}`);
        }
    }

    /**
     * Sets up the dialog UI elements and event listeners.
     * @private
     */
    async setupDialogUI() {
        const template = await renderTemplateAsync('dataMaidDialog');
        const container = document.createElement('div');
        this.container = container;
        container.classList.add('dataMaidDialogContainer');
        container.innerHTML = template;

        this.setupAutoDeleteSettings();
        /** @type {HTMLButtonElement|null} */
        const startButton = container.querySelector('.dataMaidStartButton');
        if (!startButton) {
            throw new Error('Data Maid scan button was not found in the dialog template.');
        }
        startButton.addEventListener('click', () => this.handleScanClick());
    }

    /**
     * Wires the per-category automatic deletion preferences.
     * @private
     */
    setupAutoDeleteSettings() {
        const container = this.container;
        if (!container) {
            throw new Error('Data Maid dialog is not initialized.');
        }

        /** @type {NodeListOf<HTMLInputElement>} */
        const categoryCheckboxes = container.querySelectorAll('.dataMaidAutoDelete');
        categoryCheckboxes.forEach(checkbox => {
            const category = checkbox.dataset.category;
            if (!category) {
                throw new Error('Data Maid category checkbox is missing its category.');
            }
            /** @type {HTMLInputElement|null} */
            const retentionInput = container.querySelector(`.dataMaidBackupRetention[data-category="${category}"]`);
            checkbox.checked = this.settings.autoDelete[category] === true;
            if (retentionInput) {
                const retentionKey = category === 'chatBackups' ? 'chat' : 'settings';
                retentionInput.value = String(this.settings.backupRetention[retentionKey]);
                retentionInput.disabled = !checkbox.checked;
                retentionInput.addEventListener('change', () => {
                    const value = Number(retentionInput.value);
                    if (!Number.isInteger(value) || value < 0 || value > BACKUP_RETENTION_MAX) {
                        retentionInput.value = String(this.settings.backupRetention[retentionKey]);
                        return;
                    }

                    this.settings.backupRetention[retentionKey] = value;
                    saveSettingsDebounced();
                });
            }

            checkbox.addEventListener('change', async () => {
                if (checkbox.checked) {
                    const categorySettings = this.DATA_MAID_CATEGORIES[category];
                    const categoryName = categorySettings?.name ?? category;
                    const categoryDescription = categorySettings?.description ?? '';
                    const retentionDescription = category === 'chatBackups'
                        ? t`Chat backups will be kept up to the configured number per character. Current setting: ${this.settings.backupRetention.chat}.`
                        : category === 'settingsBackups'
                            ? t`Settings backups will be kept up to the configured number. Current setting: ${this.settings.backupRetention.settings}.`
                            : '';
                    const confirmed = await Popup.show.confirm(
                        t`Enable automatic deletion?`,
                        `<p>${t`Enabling this checkbox will automatically delete the following items when you run Clean-Up.`}</p>
                        <div class="dataMaidAutoDeleteWarningDetails">
                            <strong>「${categoryName}」</strong>
                            <div class="info-block hint margin0">${categoryDescription}</div>
                        </div>
                        ${retentionDescription ? `<p><small>${retentionDescription}</small></p>` : ''}`,
                    );
                    if (!confirmed) {
                        checkbox.checked = false;
                        return;
                    }
                }

                this.settings.autoDelete[category] = checkbox.checked;
                if (retentionInput) {
                    retentionInput.disabled = !checkbox.checked;
                }
                saveSettingsDebounced();
            });
        });

        const startupSettings = this.settings.startupAutoDelete;
        /** @type {HTMLInputElement|null} */
        const startupCheckbox = container.querySelector('.dataMaidStartupAutoDelete');
        if (!startupCheckbox) {
            throw new Error('Data Maid startup cleanup checkbox was not found in the dialog template.');
        }
        /** @type {NodeListOf<HTMLInputElement>} */
        const intervalInputs = container.querySelectorAll('.dataMaidStartupInterval');
        startupCheckbox.checked = startupSettings.enabled;
        intervalInputs.forEach(input => {
            const key = input.dataset.interval;
            if (key !== 'intervalDays' && key !== 'intervalHours') {
                throw new Error('Data Maid startup cleanup interval input has an invalid interval key.');
            }
            input.value = String(startupSettings[key]);
            input.disabled = !startupSettings.enabled;
            input.addEventListener('change', () => {
                /** @type {HTMLInputElement|null} */
                const daysInput = container.querySelector('[data-interval="intervalDays"]');
                /** @type {HTMLInputElement|null} */
                const hoursInput = container.querySelector('[data-interval="intervalHours"]');
                if (!daysInput || !hoursInput) {
                    throw new Error('Data Maid startup cleanup interval inputs were not found in the dialog template.');
                }
                const days = Number(daysInput.value);
                const hours = Number(hoursInput.value);
                if (!Number.isInteger(days) || days < 0 || days > 3650 || !Number.isInteger(hours) || hours < 0 || hours > 23) {
                    daysInput.value = String(startupSettings.intervalDays);
                    hoursInput.value = String(startupSettings.intervalHours);
                    return;
                }

                startupSettings.intervalDays = days;
                startupSettings.intervalHours = hours;
                saveSettingsDebounced();
            });
        });
        startupCheckbox.addEventListener('change', async () => {
            if (startupCheckbox.checked) {
                const confirmed = await Popup.show.confirm(
                    t`Enable automatic deletion on startup?`,
                    `<p>${t`When enabled, Clean-Up will scan and automatically delete items in the selected categories after startup, once the configured interval has elapsed.`}</p>
                    <div class="dataMaidAutoDeleteWarningDetails info-block warning">${t`Deleted items cannot be restored. Make sure to back up your data in advance.`}</div>`,
                );
                if (!confirmed) {
                    startupCheckbox.checked = false;
                    return;
                }
            }

            startupSettings.enabled = startupCheckbox.checked;
            intervalInputs.forEach(input => {
                input.disabled = !startupSettings.enabled;
            });
            saveSettingsDebounced();
        });
    }

    /**
     * Handles the scan button click event.
     * @private
     */
    async handleScanClick() {
        if (dataMaidScanInProgress) {
            dataMaidToastr.warning(t`The scan is already running. Please wait for it to finish.`);
            return;
        }

        try {
            const resultsList = this.container.querySelector('.dataMaidResultsList');
            if (!resultsList) {
                throw new Error('Data Maid results list was not found in the dialog template.');
            }
            resultsList.innerHTML = '';
            this.showSpinner();
            dataMaidScanInProgress = true;

            const report = await this.getReport();
            this.token = report.token;

            const autoDelete = this.getAutoDeleteHashes(report.report);
            let deletedHashes = new Set();
            let deletionSucceeded = true;
            if (autoDelete.hashes.length > 0) {
                deletionSucceeded = await this.delete(autoDelete.hashes);
                if (deletionSucceeded) {
                    deletedHashes = new Set(autoDelete.hashes);
                    dataMaidToastr.info(t`Automatically deleted ${deletedHashes.size} items.`);
                } else {
                    dataMaidToastr.error(t`Automatic deletion failed. Review the scan results and try again.`);
                }
            }

            if (deletedHashes.size > 0) {
                for (const items of Object.values(report.report)) {
                    for (let index = items.length - 1; index >= 0; index--) {
                        if (deletedHashes.has(items[index].hash)) {
                            items.splice(index, 1);
                        }
                    }
                }
            }

            const backupCategories = ['chatBackups', 'settingsBackups'];
            const skippedCategories = deletionSucceeded
                ? autoDelete.categories.filter(category => !backupCategories.includes(category))
                : [];
            await this.renderReport(report, resultsList, skippedCategories);
        } catch (error) {
            const hasAutoDeleteEnabled = Object.values(this.settings.autoDelete).some(Boolean);
            dataMaidToastr.error(hasAutoDeleteEnabled
                ? t`Automatic deletion was skipped because the scan could not be completed.`
                : t`An error has occurred. Check the console for details.`);
            console.error('Error generating Data Maid report:', error);
        } finally {
            this.hideSpinner();
            dataMaidScanInProgress = false;
        }
    }

    /**
     * Runs the configured automatic cleanup after startup when its interval has elapsed.
     */
    async runStartupAutoDelete() {
        const settings = this.settings.startupAutoDelete;
        const interval = (settings.intervalDays * 24 + settings.intervalHours) * 60 * 60 * 1000;
        if (!settings.enabled || !Object.values(this.settings.autoDelete).some(Boolean)) {
            return;
        }
        if (settings.lastRun !== null && Date.now() - settings.lastRun < interval) {
            return;
        }
        if (dataMaidScanInProgress) {
            return;
        }

        const lockToken = acquireStartupCleanupLock();
        if (!lockToken) {
            return;
        }

        dataMaidScanInProgress = true;
        try {
            const report = await this.getReport();
            this.token = report.token;
            const autoDelete = this.getAutoDeleteHashes(report.report);
            if (autoDelete.hashes.length > 0) {
                if (!await this.delete(autoDelete.hashes)) {
                    dataMaidToastr.error(t`Startup automatic Clean-Up failed. It will be retried on the next startup.`);
                    return;
                }
                dataMaidToastr.info(t`Automatically deleted ${autoDelete.hashes.length} items.`);
            }

            settings.lastRun = Date.now();
            saveSettingsDebounced();
        } catch (error) {
            dataMaidToastr.error(t`Startup automatic Clean-Up failed. It will be retried on the next startup.`);
            console.error('Error running startup automatic Clean-Up:', error);
        } finally {
            if (this.token) {
                try {
                    await this.finalize();
                } catch (error) {
                    console.error('Error finalizing startup Clean-Up:', error);
                }
            }
            dataMaidScanInProgress = false;
            releaseStartupCleanupLock(lockToken);
        }
    }

    /**
     * Selects the report entries configured for automatic deletion.
     * @param {import('../../src/endpoints/data-maid.js').DataMaidSanitizedReport} report
     * @returns {{hashes: string[], categories: string[]}}
     * @private
     */
    getAutoDeleteHashes(report) {
        const hashes = [];
        const categories = [];

        const reportCategories = /** @type {Array<keyof typeof report>} */ (Object.keys(report));
        for (const category of reportCategories) {
            const items = report[category];
            if (!this.settings.autoDelete[category]) {
                continue;
            }

            switch (category) {
                case 'chatBackups': {
                    /** @type {Map<string, import('../../src/endpoints/data-maid.js').DataMaidSanitizedRecord[]>} */
                    const backupsByCharacter = new Map();
                    let hasUnrecognizedBackups = false;
                    for (const item of items) {
                        const match = /^(.+)_\d{8}-\d{6}\.jsonl$/i.exec(item.name);
                        if (!match) {
                            hasUnrecognizedBackups = true;
                            continue;
                        }
                        const backups = backupsByCharacter.get(match[1]) ?? [];
                        backups.push(item);
                        backupsByCharacter.set(match[1], backups);
                    }
                    for (const backups of backupsByCharacter.values()) {
                        backups.sort((a, b) => (b.mtime ?? 0) - (a.mtime ?? 0));
                        hashes.push(...backups.slice(this.settings.backupRetention.chat).map(item => item.hash));
                    }
                    if (!hasUnrecognizedBackups) {
                        categories.push(category);
                    }
                    break;
                }
                case 'settingsBackups': {
                    const backups = [...items].sort((a, b) => (b.mtime ?? 0) - (a.mtime ?? 0));
                    hashes.push(...backups.slice(this.settings.backupRetention.settings).map(item => item.hash));
                    categories.push(category);
                    break;
                }
                default: {
                    hashes.push(...items.map(item => item.hash));
                    categories.push(category);
                    break;
                }
            }
        }

        return { hashes, categories };
    }

    /**
     * Shows the loading spinner and hides the placeholder.
     * @private
     */
    showSpinner() {
        const spinner = this.container.querySelector('.dataMaidSpinner');
        const placeholder = this.container.querySelector('.dataMaidPlaceholder');
        placeholder.classList.add('displayNone');
        spinner.classList.remove('displayNone');
    }

    /**
     * Hides the loading spinner.
     * @private
     */
    hideSpinner() {
        const spinner = this.container.querySelector('.dataMaidSpinner');
        spinner.classList.add('displayNone');
    }

    /**
     * Renders the Data Maid report into the results list.
     * @param {DataMaidReportResult} report
     * @param {Element} resultsList
     * @param {string[]} [skippedCategories=[]]
     * @private
     */
    async renderReport(report, resultsList, skippedCategories = []) {
        for (const [prop, data] of Object.entries(this.DATA_MAID_CATEGORIES)) {
            if (skippedCategories.includes(prop)) {
                continue;
            }
            const category = await this.renderCategory(prop, data.name, data.description, report.report[prop]);
            if (!category) {
                continue;
            }
            resultsList.appendChild(category);
        }
        this.displayEmptyPlaceholder();
    }

    /**
     * Displays a placeholder message if no items are found in the results list.
     * @private
     */
    displayEmptyPlaceholder() {
        const resultsList = this.container.querySelector('.dataMaidResultsList');
        if (resultsList.children.length === 0) {
            const placeholder = this.container.querySelector('.dataMaidPlaceholder');
            placeholder.classList.remove('displayNone');
            placeholder.textContent = t`No items found to clean up. Come back later!`;
        }
    }

    /**
     * Renders a single Data Maid category into a DOM element.
     * @param {string} prop Property name for the category
     * @param {string} name Name of the category
     * @param {string} description Description of the category
     * @param {import('../../src/endpoints/data-maid.js').DataMaidSanitizedRecord[]} items List of items in the category
     * @return {Promise<Element|null>} A promise that resolves to a DOM element containing the rendered category
     * @private
     */
    async renderCategory(prop, name, description, items) {
        if (!Array.isArray(items) || items.length === 0) {
            return null;
        }

        const viewModel = {
            name: name,
            description: description,
            totalSize: humanFileSize(items.reduce((sum, item) => sum + item.size, 0)),
            totalItems: items.length,
            items: items.sort((a, b) => b.mtime - a.mtime).map(item => ({
                ...item,
                size: humanFileSize(item.size),
                date: timestampToMoment(item.mtime).format('L LT'),
            })),
        };

        const template = await renderTemplateAsync('dataMaidCategory', viewModel);
        const categoryElement = document.createElement('div');
        categoryElement.innerHTML = template;
        categoryElement.querySelectorAll('.dataMaidItemView').forEach(button => {
            button.addEventListener('click', async () => {
                const item = button.closest('.dataMaidItem');
                const hash = item?.getAttribute('data-hash');
                const itemName = items.find(i => i.hash === hash)?.name;
                if (hash) {
                    await this.view(prop, hash, itemName);
                }
            });
        });
        categoryElement.querySelectorAll('.dataMaidItemDownload').forEach(button => {
            button.addEventListener('click', async () => {
                const item = button.closest('.dataMaidItem');
                const hash = item?.getAttribute('data-hash');
                if (hash) {
                    await this.download(items, hash);
                }
            });
        });
        categoryElement.querySelectorAll('.dataMaidDeleteAll').forEach(button => {
            button.addEventListener('click', async (event) => {
                event.stopPropagation();
                const confirm = await Popup.show.confirm(t`Are you sure?`, t`This will permanently delete all files in this category. THIS CANNOT BE UNDONE!`);
                if (!confirm) {
                    return;
                }

                const hashes = items.map(item => item.hash).filter(hash => hash);
                await this.delete(hashes);

                categoryElement.remove();
                this.displayEmptyPlaceholder();
            });
        });
        categoryElement.querySelectorAll('.dataMaidItemDelete').forEach(button => {
            button.addEventListener('click', async () => {
                const item = button.closest('.dataMaidItem');
                const hash = item?.getAttribute('data-hash');
                if (hash) {
                    const confirm = await Popup.show.confirm(t`Are you sure?`, t`This will permanently delete the file. THIS CANNOT BE UNDONE!`);
                    if (!confirm) {
                        return;
                    }
                    if (await this.delete([hash])) {
                        item.remove();
                        items.splice(items.findIndex(i => i.hash === hash), 1);
                        if (items.length === 0) {
                            categoryElement.remove();
                            this.displayEmptyPlaceholder();
                        }
                    }
                }
            });
        });
        return categoryElement;
    }

    /**
     * Constructs the URL for viewing an item by its hash.
     * @param {string} hash Hash of the item to view
     * @returns {string} URL to view the item
     * @private
     */
    getViewUrl(hash) {
        return `/api/data-maid/view?hash=${encodeURIComponent(hash)}&token=${encodeURIComponent(this.token)}`;
    }

    /**
     * Downloads an item by its hash.
     * @param {import('../../src/endpoints/data-maid.js').DataMaidSanitizedRecord[]} items List of items in the category
     * @param {string} hash Hash of the item to download
     * @private
     */
    async download(items, hash) {
        const item = items.find(i => i.hash === hash);
        if (!item) {
            return;
        }
        const url = this.getViewUrl(hash);
        const a = document.createElement('a');
        a.href = url;
        a.download = item?.name || hash;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    /**
     * Opens the item view for a specific hash.
     * @param {string} prop Property name for the category
     * @param {string} hash Item hash to view
     * @param {string} name Name of the item to view
     * @private
     */
    async view(prop, hash, name) {
        const url = this.getViewUrl(hash);
        const isImage = ['images', 'avatarThumbnails', 'backgroundThumbnails'].includes(prop);
        const element = isImage
            ? await this.getViewElement(url, name)
            : await this.getTextViewElement(url);
        await callGenericPopup(element, POPUP_TYPE.DISPLAY, '', { large: true, wide: true });
    }

    /**
     * Deletes an item by its file path hash.
     * @param {string[]} hashes Hashes of items to delete
     * @return {Promise<boolean>} True if the deletion was successful, false otherwise
     * @private
     */
    async delete(hashes) {
        try {
            const response = await fetch('/api/data-maid/delete', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({ hashes: hashes, token: this.token }),
            });

            if (!response.ok) {
                throw new Error(`Error deleting item: ${response.statusText}`);
            }

            return true;
        } catch (error) {
            console.error('Error deleting item:', error);
            return false;
        }
    }

    /**
     * Gets a media element for viewing images or videos.
     * @param {string} url View URL
     * @param {string} name Name of the file
     * @returns {Promise<HTMLElement>} Image element
     * @private
     */
    async getViewElement(url, name) {
        const isVideo = VIDEO_EXTENSIONS.includes(name.split('.').pop());
        const mediaElement = document.createElement(isVideo ? 'video' : 'img');
        if (mediaElement instanceof HTMLVideoElement) {
            mediaElement.controls = true;
        }
        mediaElement.src = url;
        mediaElement.classList.add('dataMaidImageView');
        return mediaElement;
    }

    /**
     * Gets an iframe element for viewing text content.
     * @param {string} url View URL
     * @returns {Promise<HTMLTextAreaElement>} Frame element
     * @private
     */
    async getTextViewElement(url) {
        const response = await fetch(url);
        const text = await response.text();
        const element = document.createElement('textarea');
        element.classList.add('dataMaidTextView');
        element.readOnly = true;
        element.textContent = text;
        return element;
    }

    /**
     * Opens the Data Maid dialog and handles the interaction.
     */
    async open() {
        await this.setupDialogUI();
        if (!this.container) {
            return;
        }
        await callGenericPopup(this.container, POPUP_TYPE.TEXT, '', {
            wide: true,
            large: true,
            okButton: t`Close`,
        });

        if (this.token) {
            await this.finalize();
        }
    }
}

export function initDataMaid() {
    const dataMaidButton = document.getElementById('data_maid_button');
    if (!dataMaidButton) {
        console.warn('Data Maid button not found');
        return;
    }

    dataMaidButton.addEventListener('click', () => new DataMaidDialog().open());
    eventSource.on(event_types.APP_READY, () => {
        setTimeout(() => {
            void new DataMaidDialog().runStartupAutoDelete();
        }, STARTUP_CLEANUP_DELAY);
    });
}
