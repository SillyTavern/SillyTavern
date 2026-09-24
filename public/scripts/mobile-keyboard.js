const READ_MODE_GENERATION_TYPES = new Set(['normal', 'continue', 'regenerate', 'swipe']);

/**
 * Checks whether mobile generation should move the chat input out of edit mode.
 * @param {object} options Check options
 * @param {Element|null} options.activeElement Currently focused element
 * @param {object} [options.generationOptions] Generate options
 * @param {string} options.generationType Generation type
 * @param {boolean} options.isDryRun Whether this is a dry run
 * @param {boolean} options.isMobileDevice Whether the current device is mobile/tablet
 * @param {Element|null} options.sendTextarea Send textarea element
 * @returns {boolean} True if the send textarea should be blurred
 */
export function shouldBlurSendTextareaOnMobileGenerationStart({
    activeElement,
    generationOptions = {},
    generationType,
    isDryRun,
    isMobileDevice,
    sendTextarea,
}) {
    if (isDryRun || !isMobileDevice || generationOptions?.automatic_trigger) {
        return false;
    }

    if (!READ_MODE_GENERATION_TYPES.has(generationType)) {
        return false;
    }

    return Boolean(sendTextarea) && activeElement === sendTextarea;
}

/**
 * Blurs the focused send textarea when mobile foreground generation starts.
 * @param {string} generationType Generation type
 * @param {object} generationOptions Generate options
 * @param {boolean} isDryRun Whether this is a dry run
 * @param {object} options Runtime dependencies
 * @param {Document} [options.documentObject=document] Document object
 * @param {boolean} options.isMobileDevice Whether the current device is mobile/tablet
 * @returns {boolean} True if the send textarea was blurred
 */
export function blurSendTextareaOnMobileGenerationStart(
    generationType,
    generationOptions,
    isDryRun,
    { documentObject = document, isMobileDevice } = {},
) {
    const sendTextarea = documentObject.getElementById('send_textarea');
    const shouldBlur = shouldBlurSendTextareaOnMobileGenerationStart({
        activeElement: documentObject.activeElement,
        generationOptions,
        generationType,
        isDryRun,
        isMobileDevice,
        sendTextarea,
    });

    if (shouldBlur) {
        sendTextarea.blur();
    }

    return shouldBlur;
}
