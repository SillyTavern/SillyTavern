/**
 * Splash screen module for displaying initialization progress.
 * Provides a clean API for updating status during app startup.
 *
 * Structure:
 * - Line 1: Main heading (e.g., "Initializing...")
 * - Line 2: Section status (e.g., "Loading extensions...")
 * - Line 3: Extension info with tag (e.g., "[Third-party] Greeting Tools")
 * - Line 4: Extension status detail (e.g., "Loading models...")
 *
 * @module splashscreen
 */

import { t } from './i18n.js';

/**
 * Splash screen public API.
 *
 * @example
 * import { splashscreen } from './splashscreen.js';
 *
 * // Update section status during init
 * splashscreen.setStatus('Loading extensions...');
 *
 * // Extension updates its status (auto-detects extension name/type)
 * splashscreen.setExtensionStatus('Loading models...');
 */
export const splashscreen = {
    /** Whether the splash screen is currently active */
    get isOpen() {
        return splashContainer !== null;
    },

    /**
     * Updates the section status (line 2).
     * Automatically clears extension lines when changing sections.
     * @param {string} text - Section text (e.g., "Loading extensions...")
     */
    setStatus,

    /**
     * Updates the extension status (lines 3 and 4).
     * Auto-detects the calling extension and displays its name/type.
     * @param {string} text - Status detail text
     */
    setExtensionStatus,

    /**
     * Clears all status lines.
     */
    clear,

    /**
     * Clears extension-related lines (3 and 4).
     */
    clearExtension,
};

/**
 * Creates the splash screen element with logo, message, and status lines.
 * @param {string} logoSrc - Path to the logo image
 * @param {string} mainMessage - Main heading message
 * @returns {HTMLDivElement} The splash screen container element
 */
export function createSplashScreen(logoSrc, mainMessage) {
    const container = document.createElement('div');
    container.id = 'loader';
    container.classList.add('splash-screen');

    // Logo
    const logo = document.createElement('img');
    logo.src = logoSrc;
    logo.alt = 'SillyTavern';
    logo.className = 'splash-logo';
    logo.ariaLabel = t`SillyTavern Logo`;

    // Spinner
    const spinner = document.createElement('div');
    spinner.id = 'load-spinner';
    spinner.className = 'fa-solid fa-gear fa-spin fa-3x';

    // Main message (line 1)
    const message = document.createElement('h2');
    message.className = 'splash-message';
    message.textContent = mainMessage;

    // Status container for lines 2-4
    const statusContainer = document.createElement('div');
    statusContainer.className = 'splash-status';

    // Section status (line 2)
    sectionElement = document.createElement('p');
    sectionElement.className = 'splash-status-section';

    // Extension info (line 3) - tag + extension name
    extensionElement = document.createElement('div');
    extensionElement.className = 'splash-status-extension';

    // Extension status (line 4)
    extensionStatusElement = document.createElement('p');
    extensionStatusElement.className = 'splash-status-extension-status';

    statusContainer.appendChild(sectionElement);
    statusContainer.appendChild(extensionElement);
    statusContainer.appendChild(extensionStatusElement);

    container.appendChild(logo);
    container.appendChild(spinner);
    container.appendChild(message);
    container.appendChild(statusContainer);

    splashContainer = container;
    currentDisplayedExtension = null;
    return container;
}

/**
 * Destroys the splash screen and clears all references.
 * Call this when the splash screen is no longer needed.
 */
export function destroySplashScreen() {
    splashContainer = null;
    sectionElement = null;
    extensionElement = null;
    extensionStatusElement = null;
    currentDisplayedExtension = null;
}

/**
 * Registers an extension for splash screen status tracking.
 * Internal use - called by the extension loader during activation.
 * @param {string} folderName - Extension folder name (e.g., "third-party/SillyTavern-GreetingTools")
 * @param {string} displayName - Extension display name
 * @param {'built-in'|'third-party'} type - Extension type
 * @param {Object} options - Configuration options
 * @param {boolean} [options.showNow=false] - If true, immediately display this extension on line 3
 */
export function registerExtension(folderName, displayName, type, { showNow = false } = {}) {
    const normalizedFolder = folderName.replace(/\\/g, '/');
    extensionRegistry.set(normalizedFolder, { displayName, type });

    if (showNow && splashContainer) {
        // Clear previous extension's status when switching
        if (extensionStatusElement) {
            extensionStatusElement.textContent = '';
        }
        displayExtensionInfo(displayName, type);
        currentDisplayedExtension = normalizedFolder;
    }
}

// ============================================================================
// Private state and functions
// ============================================================================

/** @type {HTMLElement|null} Current splash screen container */
let splashContainer = null;

/** @type {HTMLElement|null} Section status element (line 2) */
let sectionElement = null;

/** @type {HTMLElement|null} Extension info element (line 3) */
let extensionElement = null;

/** @type {HTMLElement|null} Extension status element (line 4) */
let extensionStatusElement = null;

/** @type {string|null} Currently displayed extension folder */
let currentDisplayedExtension = null;

/**
 * Registry mapping extension folder names to their display info.
 * @type {Map<string, {displayName: string, type: 'built-in'|'third-party'}>}
 */
const extensionRegistry = new Map();

/**
 * Updates the section status (line 2).
 * Automatically clears extension lines when changing sections.
 * @param {string} text - Section text
 */
function setStatus(text) {
    if (sectionElement) {
        sectionElement.textContent = text;
    }
    // Clear extension lines when changing sections
    clearExtension();
}

/**
 * Updates the extension status (lines 3 and 4).
 * Auto-detects the calling extension from the stack trace.
 * If a different extension calls this, updates the display to that extension.
 * @param {string} text - Status detail text
 */
function setExtensionStatus(text) {
    if (!splashContainer) return;

    // Detect which extension is calling
    const callerFolder = getCallerExtensionFolder();
    if (!callerFolder) return;

    // Look up extension info from registry
    const extensionInfo = extensionRegistry.get(callerFolder);
    if (!extensionInfo) return;

    // If being called and the section is not during loading extensions, it might be called
    // from the APP_INITIALIZED event or similar. We treat this as a different section then, and explicitly override it.
    if (sectionElement && sectionElement.textContent !== t`Loading extensions...`) {
        sectionElement.textContent = t`Initializing extensions...`;
    }

    // If a different extension is calling, update the display
    if (currentDisplayedExtension !== callerFolder) {
        displayExtensionInfo(extensionInfo.displayName, extensionInfo.type);
        currentDisplayedExtension = callerFolder;
    }

    // Update the status text
    if (extensionStatusElement) {
        extensionStatusElement.textContent = text;
    }
}

/**
 * Displays extension info (line 3).
 * @param {string} name - Extension display name
 * @param {'built-in'|'third-party'} type - Extension type
 */
function displayExtensionInfo(name, type) {
    if (!extensionElement) return;

    extensionElement.innerHTML = '';

    if (!name) return;

    const tagSpan = document.createElement('span');
    tagSpan.className = 'splash-status-tag';
    tagSpan.textContent = type === 'third-party' ? t`Third-party` : t`Built-in`;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'splash-status-extension-name';
    nameSpan.textContent = name;

    extensionElement.appendChild(tagSpan);
    extensionElement.appendChild(nameSpan);
}

/**
 * Clears all status lines.
 */
function clear() {
    if (sectionElement) sectionElement.textContent = '';
    clearExtension();
}

/**
 * Clears extension-related lines (3 and 4).
 */
function clearExtension() {
    if (extensionElement) extensionElement.innerHTML = '';
    if (extensionStatusElement) extensionStatusElement.textContent = '';
    currentDisplayedExtension = null;
}

/**
 * Gets the extension folder of the caller from the stack trace.
 * @returns {string|null} The extension folder name, or null if not from an extension
 */
function getCallerExtensionFolder() {
    try {
        const stack = new Error().stack || '';
        const lines = stack.split('\n');

        for (const line of lines) {
            // Match extension paths: extensions/third-party/name or extensions/name
            const match = line.match(/extensions\/(third-party\/[^/\\]+|[^/\\]+)/i);
            if (match) {
                return match[1].replace(/\\/g, '/');
            }
        }
    } catch {
        // Graceful degradation
    }

    return null;
}
