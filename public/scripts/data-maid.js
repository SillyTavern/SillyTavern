import { getRequestHeaders } from '../script.js';
import { t } from './i18n.js';
import { callGenericPopup, POPUP_TYPE } from './popup.js';
import { renderTemplateAsync } from './templates.js';
import { humanFileSize, timestampToMoment } from './utils.js';

/**
 * @typedef {object} DataMaidReportResult
 * @property {import('../../src/endpoints/data-maid.js').DataMaidSanitizedReport} report - The sanitized report of the Data Maid.
 * @property {string} token - The token to use for the Data Maid report.
 */

/**
 * Returns a promise that resolves to the Data Maid report.
 * @returns {Promise<DataMaidReportResult>}
 */
async function getDataMaidReport() {
    const response = await fetch('/api/data-maid/report', {
        method: 'POST',
        headers: getRequestHeaders(),
    });

    if (!response.ok) {
        throw new Error(`Error fetching Data Maid report: ${response.statusText}`);
    }

    return await response.json();
}

async function finalizeDataMaid() {
    const response = await fetch('/api/data-maid/finalize', {
        method: 'POST',
        headers: getRequestHeaders(),
    });

    if (!response.ok) {
        throw new Error(`Error finalizing Data Maid: ${response.statusText}`);
    }
}

async function openDataMaidDialog() {
    const template = await renderTemplateAsync('dataMaidDialog');
    const parentElement = document.createElement('div');
    parentElement.classList.add('dataMaidDialogContainer');
    parentElement.innerHTML = template;
    const startButton = parentElement.querySelector('.dataMaidStartButton');
    startButton.addEventListener('click', async () => {
        try {
            const spinner = parentElement.querySelector('.dataMaidSpinner');
            const placeholder = parentElement.querySelector('.dataMaidPlaceholder');
            const resultsList = parentElement.querySelector('.dataMaidResultsList');
            placeholder.classList.add('displayNone');
            spinner.classList.remove('displayNone');
            const report = await getDataMaidReport();
            spinner.classList.add('displayNone');
            await renderDataMaidReport(report, resultsList);
        } catch (error) {
            toastr.error(t`An error has occurred. Check the console for details.`);
            console.error('Error generating Data Maid report:', error);
        }
    });

    await callGenericPopup(parentElement, POPUP_TYPE.TEXT, '', { wide: true, large: true });

    await finalizeDataMaid();
}

/**
 * Renders the Data Maid report into the results list.
 * @param {DataMaidReportResult} report
 * @param {Element} resultsList
 */
async function renderDataMaidReport(report, resultsList) {
    const DATA_MAID_CATEGORIES = {
        files: {
            name: t`Files`,
            description: t`Files that are not associated with chat messages or Data Bank.\nWILL DELETE MANUAL UPLOADS!`,
        },
        images: {
            name: t`Images`,
            description: t`Images that are not associated with chat messages.\nWILL DELETE MANUAL UPLOADS!`,
        },
        chats: {
            name: t`Chats`,
            description: t`Chat files associated with deleted characters.`,
        },
        groupChats: {
            name: t`Group Chats`,
            description: t`Chat files associated with deleted groups.`,
        },
        avatarThumbnails: {
            name: t`Avatar Thumbnails`,
            description: t`Thumbnails for avatars of missing or deleted characters.`,
        },
        backgroundThumbnails: {
            name: t`Background Thumbnails`,
            description: t`Thumbnails for missing or deleted backgrounds.`,
        },
        chatBackups: {
            name: t`Chat Backups`,
            description: t`Automatically generated chat backups.`,
        },
        settingsBackups: {
            name: t`Settings Backups`,
            description: t`Automatically generated settings backups.`,
        },
    };

    resultsList.innerHTML = '';

    for (const [prop, data] of Object.entries(DATA_MAID_CATEGORIES)) {
        const category = await renderDataMaidCategory(data.name, data.description, report.report[prop]);
        if (!category) {
            continue; // Skip empty categories
        }
        resultsList.appendChild(category);
    }
}

/**
 *
 * @param {string} name Name of the category
 * @param {string} description Description of the category
 * @param {import('../../src/endpoints/data-maid.js').DataMaidSanitizedRecord[]} items List of items in the category
 * @return {Promise<Element|null>} A promise that resolves to a DOM element containing the rendered category
 */
async function renderDataMaidCategory(name, description, items) {
    if (!Array.isArray(items)) {
        throw new Error('Items must be an array');
    }

    if (items.length === 0) {
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
    return categoryElement;
}

export function initDataMaid() {
    const dataMaidButton = document.getElementById('data_maid_button');
    if (!dataMaidButton) {
        console.warn('Data Maid button not found');
        return;
    }

    dataMaidButton.addEventListener('click', () => openDataMaidDialog());
}
