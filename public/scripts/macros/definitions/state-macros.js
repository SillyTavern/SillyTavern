import { MacroRegistry, MacroCategory } from '../engine/MacroRegistry.js';
import { eventSource, event_types } from '../../events.js';

let lastGenerationTypeValue = '';
let lastGenerationTypeTrackingInitialized = false;

function ensureLastGenerationTypeTracking() {
    if (lastGenerationTypeTrackingInitialized) {
        return;
    }
    lastGenerationTypeTrackingInitialized = true;

    try {
        eventSource?.on?.(event_types.GENERATION_STARTED, (type, _params, isDryRun) => {
            if (isDryRun) return;
            lastGenerationTypeValue = type || 'normal';
        });

        eventSource?.on?.(event_types.CHAT_CHANGED, () => {
            lastGenerationTypeValue = '';
        });
    } catch {
        // In non-runtime environments (tests), eventSource may be undefined or not fully initialized.
    }
}

/**
 * Registers macros that depend on runtime application state or event tracking
 * rather than static environment fields.
 */
export function registerStateMacros() {
    ensureLastGenerationTypeTracking();

    MacroRegistry.registerMacro('lastGenerationType', {
        category: MacroCategory.STATE,
        description: 'Type of the last queued generation request (e.g. "normal", "impersonate", "regenerate", "quiet", "swipe", "continue"). Empty if none yet or chat was switched.',
        returns: 'Type of the last queued generation request.',
        handler: () => lastGenerationTypeValue,
    });
}
