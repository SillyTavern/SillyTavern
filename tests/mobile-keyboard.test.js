import { jest } from '@jest/globals';
import {
    blurSendTextareaOnMobileGenerationStart,
    shouldBlurSendTextareaOnMobileGenerationStart,
} from '../public/scripts/mobile-keyboard.js';

function createDocumentWithSendTextarea({ active = true } = {}) {
    const sendTextarea = {
        blur: jest.fn(),
    };
    const otherElement = {};

    return {
        documentObject: {
            activeElement: active ? sendTextarea : otherElement,
            getElementById: jest.fn(id => id === 'send_textarea' ? sendTextarea : null),
        },
        sendTextarea,
        otherElement,
    };
}

describe('mobile generation keyboard handling', () => {
    test('blurs the focused send textarea for mobile foreground reply generation', () => {
        const { documentObject, sendTextarea } = createDocumentWithSendTextarea();

        blurSendTextareaOnMobileGenerationStart('normal', {}, false, {
            documentObject,
            isMobileDevice: true,
        });

        expect(sendTextarea.blur).toHaveBeenCalledTimes(1);
    });

    test('does not blur during dry run', () => {
        const { documentObject, sendTextarea } = createDocumentWithSendTextarea();

        blurSendTextareaOnMobileGenerationStart('normal', {}, true, {
            documentObject,
            isMobileDevice: true,
        });

        expect(sendTextarea.blur).not.toHaveBeenCalled();
    });

    test('does not blur on desktop', () => {
        const { documentObject, sendTextarea } = createDocumentWithSendTextarea();

        blurSendTextareaOnMobileGenerationStart('normal', {}, false, {
            documentObject,
            isMobileDevice: false,
        });

        expect(sendTextarea.blur).not.toHaveBeenCalled();
    });

    test('does not blur during quiet generation', () => {
        const { documentObject, sendTextarea } = createDocumentWithSendTextarea();

        blurSendTextareaOnMobileGenerationStart('quiet', {}, false, {
            documentObject,
            isMobileDevice: true,
        });

        expect(sendTextarea.blur).not.toHaveBeenCalled();
    });

    test('does not blur during impersonation', () => {
        const { documentObject, sendTextarea } = createDocumentWithSendTextarea();

        blurSendTextareaOnMobileGenerationStart('impersonate', {}, false, {
            documentObject,
            isMobileDevice: true,
        });

        expect(sendTextarea.blur).not.toHaveBeenCalled();
    });

    test('does not blur during automatic generation', () => {
        const { documentObject, sendTextarea } = createDocumentWithSendTextarea();

        blurSendTextareaOnMobileGenerationStart('normal', { automatic_trigger: true }, false, {
            documentObject,
            isMobileDevice: true,
        });

        expect(sendTextarea.blur).not.toHaveBeenCalled();
    });

    test('does not blur when send textarea is not focused', () => {
        const { documentObject, sendTextarea } = createDocumentWithSendTextarea({ active: false });

        blurSendTextareaOnMobileGenerationStart('normal', {}, false, {
            documentObject,
            isMobileDevice: true,
        });

        expect(sendTextarea.blur).not.toHaveBeenCalled();
    });

    test('reports whether focused mobile send textarea should blur', () => {
        const sendTextarea = {};

        expect(shouldBlurSendTextareaOnMobileGenerationStart({
            activeElement: sendTextarea,
            generationOptions: {},
            generationType: 'continue',
            isDryRun: false,
            isMobileDevice: true,
            sendTextarea,
        })).toBe(true);
    });
});
