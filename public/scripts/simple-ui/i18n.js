const requestedLocale = String(localStorage.getItem('language') || navigator.language || 'en').toLowerCase();
let localeData = {};

async function loadLocale(locale) {
    if (!locale || locale.startsWith('en')) return {};
    const response = await fetch(`/locales/${encodeURIComponent(locale)}.json`);
    return response.ok ? response.json() : {};
}

try {
    localeData = await loadLocale(requestedLocale);
    if (!Object.keys(localeData).length && requestedLocale.includes('-')) {
        localeData = await loadLocale(requestedLocale.split('-')[0]);
    }
} catch (error) {
    console.warn('[Simple UI] Localization could not be loaded', error);
}

export function getCurrentLocale() {
    return requestedLocale;
}

export function translate(text) {
    return localeData[text] || text;
}
