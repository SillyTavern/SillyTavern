import { throttle } from './utils.js';

export function initDomHandlers() {
    handleInputWheel();
    handleNumberInputConstraints();
}

/**
 * Trap mouse wheel inside of focused number inputs to prevent scrolling their containers.
 * Instead of firing wheel events, manually update both slider and input values.
 * This also makes wheel work inside Firefox.
 */
function handleInputWheel() {
    const minInterval = 25; // ms

    /**
     * Update input and slider values based on wheel delta
     * @param {HTMLInputElement} input The number input element
     * @param {HTMLInputElement|null} slider The associated range input element, if any
     * @param {number} deltaY The wheel deltaY value
     */
    function updateValue(input, slider, deltaY) {
        const currentValue = parseFloat(input.value);
        const step = parseFloat(input.step);
        const min = parseFloat(input.min);
        const max = parseFloat(input.max);

        // Sanity checks before trying to calculate new value
        if (isNaN(currentValue) || isNaN(step) || step <= 0 || deltaY === 0) return;

        // Calculate new value based on wheel movement delta (negative = up, positive = down)
        let newValue = currentValue + (deltaY > 0 ? -step : step);
        // Ensure it's a multiple of step
        newValue = Math.round(newValue / step) * step;
        // Ensure it's within the min and max range (NaN-aware)
        newValue = !isNaN(min) ? Math.max(newValue, min) : newValue;
        newValue = !isNaN(max) ? Math.min(newValue, max) : newValue;
        // Simple fix for floating point precision issues
        newValue = Math.round(newValue * 1e10) / 1e10;

        // Update both input and slider values
        input.value = newValue.toString();
        if (slider) slider.value = newValue.toString();
        // Trigger input event (just ONE) to update any listeners
        const inputEvent = new Event('input', { bubbles: true });
        input.dispatchEvent(inputEvent);
    }

    const updateValueThrottled = throttle(updateValue, minInterval);

    document.addEventListener('wheel', (e) => {
        // Try to carefully narrow down if we even need to fire this handler
        const input = document.activeElement instanceof HTMLInputElement ? document.activeElement : null;
        if (input && input.type === 'number' && input.hasAttribute('step')) {
            const parent = input.closest('.range-block-range-and-counter') ?? input.closest('div') ?? input.parentElement;
            const slider = /** @type {HTMLInputElement} */ (parent?.querySelector('input[type="range"]'));

            // Stop propagation for either target
            if (e.target === input || (slider && e.target === slider)) {
                e.stopPropagation();
                e.preventDefault();

                updateValueThrottled(input, slider, e.deltaY);
            }
        }
    }, { passive: false });
}

/**
 * Enforces min/max constraints on number inputs when users manually type values.
 * Browsers only enforce min/max when using the spinner arrows or keyboard, not on manual input.
 * This listener catches the 'change' event (fires on blur after editing) and clamps the value.
 */
function handleNumberInputConstraints() {
    document.addEventListener('change', (e) => {
        const target = e.target;

        // Only handle number inputs with both min and max defined
        if (!(target instanceof HTMLInputElement) || target.type !== 'number') return;

        const min = target.getAttribute('min');
        const max = target.getAttribute('max');
        if (min === null && max === null) return;

        const minVal = min !== null ? parseFloat(min) : NaN;
        const maxVal = max !== null ? parseFloat(max) : NaN;
        const currentVal = parseFloat(target.value);

        // Skip if current value is not a valid number
        if (isNaN(currentVal)) return;
        // Skip if min/max are defined but invalid
        if ((min !== null && isNaN(minVal)) || (max !== null && isNaN(maxVal))) return;

        // Check if value is out of bounds
        let needsClamp = false;
        let newValue = currentVal;

        if (min !== null && currentVal < minVal) {
            newValue = minVal;
            needsClamp = true;
        } else if (max !== null && currentVal > maxVal) {
            newValue = maxVal;
            needsClamp = true;
        }

        if (!needsClamp) return;

        // Apply step alignment if step is defined (like browser native behavior)
        const step = target.getAttribute('step');
        if (step !== null) {
            const stepVal = parseFloat(step);
            if (!isNaN(stepVal) && stepVal > 0) {
                newValue = Math.round(newValue / stepVal) * stepVal;
                // Re-clamp after step alignment if bounds exist
                if (min !== null) newValue = Math.max(minVal, newValue);
                if (max !== null) newValue = Math.min(maxVal, newValue);
            }
        }

        // Fix floating point precision
        newValue = Math.round(newValue * 1e10) / 1e10;

        // Update the value
        target.value = newValue.toString();

        // Trigger input event so existing handlers fire (e.g., sampler settings update)
        // Use jQuery trigger to ensure both jQuery and native handlers are called
        $(target).trigger('input');
    }, { passive: true });
}
