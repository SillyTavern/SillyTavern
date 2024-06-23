import { getRequestHeaders } from '../script.js';
import { renderExtensionTemplateAsync } from './extensions.js';
import { POPUP_RESULT, POPUP_TYPE, callGenericPopup } from './popup.js';
import { SlashCommand } from './slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } from './slash-commands/SlashCommandArgument.js';
import { SlashCommandParser } from './slash-commands/SlashCommandParser.js';
import { isValidUrl } from './utils.js';

/**
 * @typedef {Object} Scraper
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} iconClass
 * @property {boolean} iconAvailable
 * @property {() => Promise<boolean>} isAvailable
 * @property {() => Promise<File[]>} scrape
 */

/**
 * @typedef {Object} ScraperInfo
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} iconClass
 * @property {boolean} iconAvailable
 */

export class ScraperManager {
    /**
     * @type {Scraper[]}
     */
    static #scrapers = [];

    /**
     * Register a scraper to be used by the Data Bank.
     * @param {Scraper} scraper Instance of a scraper to register
     */
    static registerDataBankScraper(scraper) {
        if (ScraperManager.#scrapers.some(s => s.id === scraper.id)) {
            console.warn(`Scraper with ID ${scraper.id} already registered`);
            return;
        }

        ScraperManager.#scrapers.push(scraper);
    }

    /**
     * Gets a list of scrapers available for the Data Bank.
     * @returns {ScraperInfo[]} List of scrapers available for the Data Bank
     */
    static getDataBankScrapers() {
        return ScraperManager.#scrapers.map(s => ({ id: s.id, name: s.name, description: s.description, iconClass: s.iconClass, iconAvailable: s.iconAvailable }));
    }

    /**
     * Run a scraper to scrape data into the Data Bank.
     * @param {string} scraperId ID of the scraper to run
     * @returns {Promise<File[]>} List of files scraped by the scraper
     */
    static runDataBankScraper(scraperId) {
        const scraper = ScraperManager.#scrapers.find(s => s.id === scraperId);
        if (!scraper) {
            console.warn(`Scraper with ID ${scraperId} not found`);
            return;
        }
        return scraper.scrape();
    }

    /**
     * Check if a scraper is available.
     * @param {string} scraperId ID of the scraper to check
     * @returns {Promise<boolean>} Whether the scraper is available
     */
    static isScraperAvailable(scraperId) {
        const scraper = ScraperManager.#scrapers.find(s => s.id === scraperId);
        if (!scraper) {
            console.warn(`Scraper with ID ${scraperId} not found`);
            return;
        }
        return scraper.isAvailable();
    }
}

/**
 * Create a text file from a string.
 * @implements {Scraper}
 */
class Notepad {
    constructor() {
        this.id = 'text';
        this.name = 'Notepad';
        this.description = 'Create a text file from scratch.';
        this.iconClass = 'fa-solid fa-note-sticky';
        this.iconAvailable = true;
    }

    /**
     * Check if the scraper is available.
     * @returns {Promise<boolean>}
     */
    async isAvailable() {
        return true;
    }

    /**
     * Create a text file from a string.
     * @returns {Promise<File[]>} File attachments scraped from the text
     */
    async scrape() {
        const template = $(await renderExtensionTemplateAsync('attachments', 'notepad', {}));
        let fileName = `Untitled - ${new Date().toLocaleString()}`;
        let text = '';
        template.find('input[name="notepadFileName"]').val(fileName).on('input', function () {
            fileName = String($(this).val()).trim();
        });
        template.find('textarea[name="notepadFileContent"]').on('input', function () {
            text = String($(this).val());
        });

        const result = await callGenericPopup(template, POPUP_TYPE.CONFIRM, '', { wide: true, large: true, okButton: 'Save', cancelButton: 'Cancel' });

        if (!result || text === '') {
            return;
        }

        const file = new File([text], `Notepad - ${fileName}.txt`, { type: 'text/plain' });
        return [file];
    }
}

/**
 * Scrape data from a webpage.
 * @implements {Scraper}
 */
class WebScraper {
    constructor() {
        this.id = 'web';
        this.name = 'Web';
        this.description = 'Download a page from the web.';
        this.iconClass = 'fa-solid fa-globe';
        this.iconAvailable = true;
    }

    /**
     * Check if the scraper is available.
     * @returns {Promise<boolean>}
     */
    async isAvailable() {
        return true;
    }

    /**
    * Parse the title of an HTML file from a Blob.
    * @param {Blob} blob Blob of the HTML file
    * @returns {Promise<string>} Title of the HTML file
    */
    async getTitleFromHtmlBlob(blob) {
        const text = await blob.text();
        const titleMatch = text.match(/<title>(.*?)<\/title>/i);
        return titleMatch ? titleMatch[1] : '';
    }

    /**
     * Scrape file attachments from a webpage.
     * @returns {Promise<File[]>} File attachments scraped from the webpage
     */
    async scrape() {
        const template = $(await renderExtensionTemplateAsync('attachments', 'web-scrape', {}));
        const linksString = await callGenericPopup(template, POPUP_TYPE.INPUT, '', { wide: false, large: false, okButton: 'Scrape', cancelButton: 'Cancel', rows: 4 });

        if (!linksString) {
            return;
        }

        const links = String(linksString).split('\n').map(l => l.trim()).filter(l => l).filter(l => isValidUrl(l));

        if (links.length === 0) {
            toastr.error('Invalid URL');
            return;
        }

        const toast = toastr.info('Working, please wait...');

        const files = [];

        for (const link of links) {
            const result = await fetch('/api/search/visit', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({ url: link }),
            });

            const blob = await result.blob();
            const domain = new URL(link).hostname;
            const timestamp = Date.now();
            const title = await this.getTitleFromHtmlBlob(blob) || 'webpage';
            const file = new File([blob], `${title} - ${domain} - ${timestamp}.html`, { type: 'text/html' });
            files.push(file);
        }

        toastr.clear(toast);
        return files;
    }
}

/**
 * Scrape data from a file selection.
 * @implements {Scraper}
 */
class FileScraper {
    constructor() {
        this.id = 'file';
        this.name = 'File';
        this.description = 'Upload a file from your computer.';
        this.iconClass = 'fa-solid fa-upload';
        this.iconAvailable = true;
    }

    /**
     * Check if the scraper is available.
     * @returns {Promise<boolean>}
     */
    async isAvailable() {
        return true;
    }

    /**
     * Scrape file attachments from a file.
     * @returns {Promise<File[]>} File attachments scraped from the files
     */
    async scrape() {
        return new Promise(resolve => {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '*/*';
            fileInput.multiple = true;
            fileInput.onchange = () => resolve(Array.from(fileInput.files));
            fileInput.click();
        });
    }
}

class MediaWikiScraper {
    constructor() {
        this.id = 'mediawiki';
        this.name = 'MediaWiki';
        this.description = 'Download a page from a MediaWiki wiki.';
        this.iconClass = 'fa-brands fa-wikipedia-w';
        this.iconAvailable = true;
    }

    async isAvailable() {
        try {
            const result = await fetch('/api/plugins/fandom/probe-mediawiki', {
                method: 'POST',
                headers: getRequestHeaders(),
            });

            return result.ok;
        } catch (error) {
            console.debug('Could not probe Fandom/MediaWiki plugin', error);
            return false;
        }
    }

    async scrape() {
        let url = '';
        let filter = '';
        let output = 'single';

        const template = $(await renderExtensionTemplateAsync('attachments', 'mediawiki-scrape', {}));
        template.find('input[name="scrapeInput"]').on('input', function () {
            url = String($(this).val()).trim();
        });
        template.find('input[name="scrapeFilter"]').on('input', function () {
            filter = String($(this).val());
        });
        template.find('input[name="scrapeOutput"]').on('input', function () {
            output = String($(this).val());
        });

        const confirm = await callGenericPopup(template, POPUP_TYPE.CONFIRM, '', { wide: false, large: false, okButton: 'Scrape', cancelButton: 'Cancel' });

        if (confirm !== POPUP_RESULT.AFFIRMATIVE) {
            return;
        }

        if (!url) {
            toastr.error('URL name is required');
            return;
        }

        const toast = toastr.info('Working, please wait...');

        const result = await fetch('/api/plugins/fandom/scrape-mediawiki', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ url, filter }),
        });

        if (!result.ok) {
            const error = await result.text();
            throw new Error(error);
        }

        const data = await result.json();
        toastr.clear(toast);

        if (output === 'multi') {
            const files = [];
            for (const attachment of data) {
                const file = new File([String(attachment.content).trim()], `${String(attachment.title).trim()}.txt`, { type: 'text/plain' });
                files.push(file);
            }
            return files;
        }

        if (output === 'single') {
            const combinedContent = data.map((a) => String(a.title).trim() + '\n\n' + String(a.content).trim()).join('\n\n\n\n');
            const file = new File([combinedContent], `${url}.txt`, { type: 'text/plain' });
            return [file];
        }

        return [];
    }
}

/**
 * Scrape data from a Fandom wiki.
 * @implements {Scraper}
 */
class FandomScraper {
    constructor() {
        this.id = 'fandom';
        this.name = 'Fandom';
        this.description = 'Download a page from the Fandom wiki.';
        this.iconClass = 'fa-solid fa-fire';
        this.iconAvailable = true;
    }

    /**
     * Check if the scraper is available.
     * @returns {Promise<boolean>}
     */
    async isAvailable() {
        try {
            const result = await fetch('/api/plugins/fandom/probe', {
                method: 'POST',
                headers: getRequestHeaders(),
            });

            return result.ok;
        } catch (error) {
            console.debug('Could not probe Fandom plugin', error);
            return false;
        }
    }

    /**
     * Get the ID of a fandom from a URL or name.
     * @param {string} fandom URL or name of the fandom
     * @returns {string} ID of the fandom
     */
    getFandomId(fandom) {
        try {
            const url = new URL(fandom);
            return url.hostname.split('.')[0] || fandom;
        } catch {
            return fandom;
        }
    }

    async scrape() {
        let fandom = '';
        let filter = '';
        let output = 'single';

        const template = $(await renderExtensionTemplateAsync('attachments', 'fandom-scrape', {}));
        template.find('input[name="fandomScrapeInput"]').on('input', function () {
            fandom = String($(this).val()).trim();
        });
        template.find('input[name="fandomScrapeFilter"]').on('input', function () {
            filter = String($(this).val());
        });
        template.find('input[name="fandomScrapeOutput"]').on('input', function () {
            output = String($(this).val());
        });

        const confirm = await callGenericPopup(template, POPUP_TYPE.CONFIRM, '', { wide: false, large: false, okButton: 'Scrape', cancelButton: 'Cancel' });

        if (confirm !== POPUP_RESULT.AFFIRMATIVE) {
            return;
        }

        if (!fandom) {
            toastr.error('Fandom name is required');
            return;
        }

        const toast = toastr.info('Working, please wait...');

        const result = await fetch('/api/plugins/fandom/scrape', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ fandom, filter }),
        });

        if (!result.ok) {
            const error = await result.text();
            throw new Error(error);
        }

        const data = await result.json();
        toastr.clear(toast);

        if (output === 'multi') {
            const files = [];
            for (const attachment of data) {
                const file = new File([String(attachment.content).trim()], `${String(attachment.title).trim()}.txt`, { type: 'text/plain' });
                files.push(file);
            }
            return files;
        }

        if (output === 'single') {
            const combinedContent = data.map((a) => String(a.title).trim() + '\n\n' + String(a.content).trim()).join('\n\n\n\n');
            const file = new File([combinedContent], `${fandom}.txt`, { type: 'text/plain' });
            return [file];
        }

        return [];
    }
}

const iso6391Codes = [
    'aa', 'ab', 'ae', 'af', 'ak', 'am', 'an', 'ar', 'as', 'av', 'ay', 'az',
    'ba', 'be', 'bg', 'bh', 'bi', 'bm', 'bn', 'bo', 'br', 'bs', 'ca', 'ce',
    'ch', 'co', 'cr', 'cs', 'cu', 'cv', 'cy', 'da', 'de', 'dv', 'dz', 'ee',
    'el', 'en', 'eo', 'es', 'et', 'eu', 'fa', 'ff', 'fi', 'fj', 'fo', 'fr',
    'fy', 'ga', 'gd', 'gl', 'gn', 'gu', 'gv', 'ha', 'he', 'hi', 'ho', 'hr',
    'ht', 'hu', 'hy', 'hz', 'ia', 'id', 'ie', 'ig', 'ii', 'ik', 'io', 'is',
    'it', 'iu', 'ja', 'jv', 'ka', 'kg', 'ki', 'kj', 'kk', 'kl', 'km', 'kn',
    'ko', 'kr', 'ks', 'ku', 'kv', 'kw', 'ky', 'la', 'lb', 'lg', 'li', 'ln',
    'lo', 'lt', 'lu', 'lv', 'mg', 'mh', 'mi', 'mk', 'ml', 'mn', 'mr', 'ms',
    'mt', 'my', 'na', 'nb', 'nd', 'ne', 'ng', 'nl', 'nn', 'no', 'nr', 'nv',
    'ny', 'oc', 'oj', 'om', 'or', 'os', 'pa', 'pi', 'pl', 'ps', 'pt', 'qu',
    'rm', 'rn', 'ro', 'ru', 'rw', 'sa', 'sc', 'sd', 'se', 'sg', 'si', 'sk',
    'sl', 'sm', 'sn', 'so', 'sq', 'sr', 'ss', 'st', 'su', 'sv', 'sw', 'ta',
    'te', 'tg', 'th', 'ti', 'tk', 'tl', 'tn', 'to', 'tr', 'ts', 'tt', 'tw',
    'ty', 'ug', 'uk', 'ur', 'uz', 've', 'vi', 'vo', 'wa', 'wo', 'xh', 'yi',
    'yo', 'za', 'zh', 'zu'];

/**
 * Scrape transcript from a YouTube video.
 * @implements {Scraper}
 */
class YouTubeScraper {
    constructor() {
        this.id = 'youtube';
        this.name = 'YouTube';
        this.description = 'Download a transcript from a YouTube video.';
        this.iconClass = 'fa-brands fa-youtube';
        this.iconAvailable = true;

        SlashCommandParser.addCommandObject(SlashCommand.fromProps({
            name: 'yt-script',
            callback: async (args, url) => {
                try {
                    if (!url) {
                        throw new Error('URL or ID of the YouTube video is required');
                    }

                    const lang = String(args?.lang || '');
                    const { transcript } = await this.getScript(String(url).trim(), lang);
                    return transcript;
                } catch (error) {
                    toastr.error(error.message);
                    return '';
                }
            },
            helpString: 'Scrape a transcript from a YouTube video by ID or URL.',
            returns: ARGUMENT_TYPE.STRING,
            namedArgumentList: [
                new SlashCommandNamedArgument('lang', 'ISO 639-1 language code of the transcript, e.g. "en"', ARGUMENT_TYPE.STRING, false, false, '', iso6391Codes),
            ],
            unnamedArgumentList: [
                new SlashCommandArgument('URL or ID of the YouTube video', ARGUMENT_TYPE.STRING, true, false),
            ],
        }));
    }

    /**
     * Check if the scraper is available.
     * @returns {Promise<boolean>}
     */
    async isAvailable() {
        return true;
    }

    /**
     * Parse the ID of a YouTube video from a URL.
     * @param {string} url URL of the YouTube video
     * @returns {string} ID of the YouTube video
     */
    parseId(url) {
        // If the URL is already an ID, return it
        if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
            return url;
        }

        const regex = /^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|shorts\/)|(?:(?:watch)?\?v(?:i)?=|&v(?:i)?=))([^#&?]*).*/;
        const match = url.match(regex);
        return (match?.length && match[1] ? match[1] : url);
    }

    /**
     * Scrape transcript from a YouTube video.
     * @returns {Promise<File[]>} File attachments scraped from the YouTube video
     */
    async scrape() {
        let lang = '';
        const template = $(await renderExtensionTemplateAsync('attachments', 'youtube-scrape', {}));
        const videoUrl = await callGenericPopup(template, POPUP_TYPE.INPUT, '', { wide: false, large: false, okButton: 'Scrape', cancelButton: 'Cancel', rows: 2 });

        template.find('input[name="youtubeLanguageCode"]').on('input', function () {
            lang = String($(this).val()).trim();
        });

        if (!videoUrl) {
            return;
        }

        const toast = toastr.info('Working, please wait...');
        const { transcript, id } = await this.getScript(String(videoUrl), lang);
        toastr.clear(toast);

        const file = new File([transcript], `YouTube - ${id} - ${Date.now()}.txt`, { type: 'text/plain' });
        return [file];
    }

    /**
     * Fetches the transcript of a YouTube video.
     * @param {string} videoUrl Video URL or ID
     * @param {string} lang Video language
     * @returns {Promise<{ transcript: string, id: string }>} Transcript of the YouTube video with the video ID
     */
    async getScript(videoUrl, lang) {
        const id = this.parseId(String(videoUrl).trim());

        const result = await fetch('/api/search/transcript', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ id, lang }),
        });

        if (!result.ok) {
            const error = await result.text();
            throw new Error(error);
        }

        const transcript = await result.text();
        return { transcript, id };
    }
}

ScraperManager.registerDataBankScraper(new FileScraper());
ScraperManager.registerDataBankScraper(new Notepad());
ScraperManager.registerDataBankScraper(new WebScraper());
ScraperManager.registerDataBankScraper(new MediaWikiScraper());
ScraperManager.registerDataBankScraper(new FandomScraper());
ScraperManager.registerDataBankScraper(new YouTubeScraper());
