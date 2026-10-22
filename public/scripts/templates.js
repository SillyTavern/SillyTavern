import { DOMPurify, Handlebars } from '../lib.js';
import { applyLocale } from './i18n.js';

/**
 * @type {Map<string, function>}
 * @description Cache for Handlebars templates.
 */
const TEMPLATE_CACHE = new Map();
/** @type {Map<string, Promise<function>>} Template loads shared by concurrent renderers. */
const TEMPLATE_REQUESTS = new Map();

/**
 * Loads a URL content using XMLHttpRequest synchronously.
 * @param {string} url URL to load synchronously
 * @returns {string} Response text
 */
function getUrlSync(url) {
    console.debug('Loading URL synchronously', url);
    const request = new XMLHttpRequest();
    request.open('GET', url, false); // `false` makes the request synchronous
    request.send();

    if (request.status >= 200 && request.status < 300) {
        return request.responseText;
    }

    throw new Error(`Error loading ${url}: ${request.status} ${request.statusText}`);
}

/**
 * Loads a URL content using XMLHttpRequest asynchronously.
 * @param {string} url URL to load asynchronously
 * @returns {Promise<string>} Response text
 */
function getUrlAsync(url) {
    return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open('GET', url, true);
        request.onload = () => {
            if (request.status >= 200 && request.status < 300) {
                resolve(request.responseText);
            } else {
                reject(new Error(`Error loading ${url}: ${request.status} ${request.statusText}`));
            }
        };
        request.onerror = () => {
            reject(new Error(`Error loading ${url}: ${request.status} ${request.statusText}`));
        };
        request.send();
    });
}

/**
 * Renders a Handlebars template asynchronously.
 * @param {string} templateId ID of the template to render
 * @param {Record<string, any>} templateData The data to pass to the template
 * @param {boolean} sanitize Should the template be sanitized with DOMPurify
 * @param {boolean} localize Should the template be localized
 * @param {boolean} fullPath Should the template ID be treated as a full path or a relative path
 * @returns {Promise<string>} Rendered template
 */
export async function renderTemplateAsync(templateId, templateData = {}, sanitize = true, localize = true, fullPath = false) {
    async function fetchTemplateAsync(pathToTemplate) {
        const cached = TEMPLATE_CACHE.get(pathToTemplate);
        if (cached) return cached;

        let pending = TEMPLATE_REQUESTS.get(pathToTemplate);
        if (!pending) {
            pending = (async () => {
                const templateContent = await getUrlAsync(pathToTemplate);
                // A synchronous caller may have populated the cache while the
                // request was pending. Keep the same compiled template in that case.
                const template = TEMPLATE_CACHE.get(pathToTemplate) || Handlebars.compile(templateContent);
                TEMPLATE_CACHE.set(pathToTemplate, template);
                return template;
            })();
            TEMPLATE_REQUESTS.set(pathToTemplate, pending);
        }
        try {
            return await pending;
        } finally {
            // Failures must remain retryable; cache only compiled templates.
            if (TEMPLATE_REQUESTS.get(pathToTemplate) === pending) {
                TEMPLATE_REQUESTS.delete(pathToTemplate);
            }
        }
    }

    try {
        const pathToTemplate = fullPath ? templateId : `/scripts/templates/${templateId}.html`;
        const template = await fetchTemplateAsync(pathToTemplate);
        let result = template(templateData);

        if (sanitize) {
            result = DOMPurify.sanitize(result);
        }

        if (localize) {
            result = applyLocale(result);
        }

        return result;
    } catch (err) {
        console.error('Error rendering template', templateId, templateData, err);
        toastr.error('Check the DevTools console for more information.', 'Error rendering template');
    }
}

/**
 * Renders a Handlebars template synchronously.
 * @param {string} templateId ID of the template to render
 * @param {Record<string, any>} templateData The data to pass to the template
 * @param {boolean} sanitize Should the template be sanitized with DOMPurify
 * @param {boolean} localize Should the template be localized
 * @param {boolean} fullPath Should the template ID be treated as a full path or a relative path
 * @returns {string} Rendered template
 *
 * @deprecated Use renderTemplateAsync instead.
 */
export function renderTemplate(templateId, templateData = {}, sanitize = true, localize = true, fullPath = false) {
    function fetchTemplateSync(pathToTemplate) {
        let template = TEMPLATE_CACHE.get(pathToTemplate);
        if (!template) {
            const templateContent = getUrlSync(pathToTemplate);
            template = Handlebars.compile(templateContent);
            TEMPLATE_CACHE.set(pathToTemplate, template);
        }
        return template;
    }

    try {
        const pathToTemplate = fullPath ? templateId : `/scripts/templates/${templateId}.html`;
        const template = fetchTemplateSync(pathToTemplate);
        let result = template(templateData);

        if (sanitize) {
            result = DOMPurify.sanitize(result);
        }

        if (localize) {
            result = applyLocale(result);
        }

        return result;
    } catch (err) {
        console.error('Error rendering template', templateId, templateData, err);
        toastr.error('Check the DevTools console for more information.', 'Error rendering template');
    }
}
