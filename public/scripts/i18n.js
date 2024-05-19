import { registerDebugFunction } from './power-user.js';
import { updateSecretDisplay } from './secrets.js';

const storageKey = 'language';
const overrideLanguage = localStorage.getItem(storageKey);
const localeFile = String(overrideLanguage || navigator.language || navigator.userLanguage || 'en').toLowerCase();
const langs = await fetch('/locales/lang.json').then(response => response.json());
// Don't change to let/const! It will break module loading.
// eslint-disable-next-line prefer-const
var localeData = await getLocaleData(localeFile);

/**
 * Fetches the locale data for the given language.
 * @param {string} language Language code
 * @returns {Promise<Record<string, string>>} Locale data
 */
async function getLocaleData(language) {
    let supportedLang = findLang(language);
    if (!supportedLang) {
        return {};
    }

    const data = await fetch(`./locales/${language}.json`).then(response => {
        console.log(`Loading locale data from ./locales/${language}.json`);
        if (!response.ok) {
            return {};
        }
        return response.json();
    });

    return data;
}

function findLang(language) {
    var supportedLang = langs.find(x => x.lang === language);

    if (!supportedLang) {
        console.warn(`Unsupported language: ${language}`);
    }
    return supportedLang;
}

async function getMissingTranslations() {
    const missingData = [];

    // Determine locales to search for untranslated strings
    const isNotSupported = !findLang(localeFile);
    const langsToProcess = (isNotSupported || localeFile == 'en') ? langs : [findLang(localeFile)];

    for (const language of langsToProcess) {
        const localeData = await getLocaleData(language.lang);
        $(document).find('[data-i18n]').each(function () {
            const keys = $(this).data('i18n').split(';'); // Multi-key entries are ; delimited
            for (const key of keys) {
                const attributeMatch = key.match(/\[(\S+)\](.+)/); // [attribute]key
                if (attributeMatch) { // attribute-tagged key
                    const localizedValue = localeData?.[attributeMatch[2]];
                    if (!localizedValue) {
                        missingData.push({ key, language: language.lang, value: $(this).attr(attributeMatch[1]) });
                    }
                } else { // No attribute tag, treat as 'text'
                    const localizedValue = localeData?.[key];
                    if (!localizedValue) {
                        missingData.push({ key, language: language.lang, value: $(this).text().trim() });
                    }
                }
            }
        });
    }

    // Remove duplicates
    const uniqueMissingData = [];
    for (const { key, language, value } of missingData) {
        if (!uniqueMissingData.some(x => x.key === key && x.language === language && x.value === value)) {
            uniqueMissingData.push({ key, language, value });
        }
    }

    // Sort by language, then key
    uniqueMissingData.sort((a, b) => a.language.localeCompare(b.language) || a.key.localeCompare(b.key));

    // Map to { language: { key: value } }
    let missingDataMap = {};
    for (const { key, value } of uniqueMissingData) {
        if (!missingDataMap) {
            missingDataMap = {};
        }
        missingDataMap[key] = value;
    }

    console.table(uniqueMissingData);
    console.log(missingDataMap);

    toastr.success(`Found ${uniqueMissingData.length} missing translations. See browser console for details.`);
}

export function applyLocale(root = document) {
    if (!localeData || Object.keys(localeData).length === 0) {
        return root;
    }

    const $root = root instanceof Document ? $(root) : $(new DOMParser().parseFromString(root, 'text/html'));

    //find all the elements with `data-i18n` attribute
    $root.find('[data-i18n]').each(function () {
        //read the translation from the language data
        const keys = $(this).data('i18n').split(';'); // Multi-key entries are ; delimited
        for (const key of keys) {
            const attributeMatch = key.match(/\[(\S+)\](.+)/); // [attribute]key
            if (attributeMatch) { // attribute-tagged key
                const localizedValue = localeData?.[attributeMatch[2]];
                if (localizedValue || localizedValue == '') {
                    $(this).attr(attributeMatch[1], localizedValue);
                }
            } else { // No attribute tag, treat as 'text'
                const localizedValue = localeData?.[key];
                if (localizedValue || localizedValue == '') {
                    $(this).text(localizedValue);
                }
            }
        }
    });

    if (root !== document) {
        return $root.get(0).body.innerHTML;
    }
}


function addLanguagesToDropdown() {
    const uiLanguageSelects = $('#ui_language_select, #onboarding_ui_language_select');
    for (const langObj of langs) { // Set the value to the language code
        const option = document.createElement('option');
        option.value = langObj['lang']; // Set the value to the language code
        option.innerText = langObj['display']; // Set the display text to the language name
        uiLanguageSelects.append(option);
    }

    const selectedLanguage = localStorage.getItem(storageKey);
    if (selectedLanguage) {
        uiLanguageSelects.val(selectedLanguage);
    }
}

export function initLocales() {
    applyLocale();
    addLanguagesToDropdown();
    updateSecretDisplay();

    $('#ui_language_select, #onboarding_ui_language_select').on('change', async function () {
        const language = String($(this).val());

        if (language) {
            localStorage.setItem(storageKey, language);
        } else {
            localStorage.removeItem(storageKey);
        }

        location.reload();
    });

    registerDebugFunction('getMissingTranslations', 'Get missing translations', 'Detects missing localization data in the current locale and dumps the data into the browser console. If the current locale is English, searches all other locales.', getMissingTranslations);
    registerDebugFunction('applyLocale', 'Apply locale', 'Reapplies the currently selected locale to the page.', applyLocale);
}
