// public/scripts/render-batcher.js
/**
 * Creates a batch operation for appending multiple elements to a single parent.
 * @param {HTMLElement} parentElement The parent element to append to.
 * @returns {{add: (element: HTMLElement) => void, commit: () => void}}
 */
export function createBatchAppender(parentElement) {
    const fragment = document.createDocumentFragment();
    return {
        /**
         * Adds an element to the batch.
         * @param {HTMLElement} element The element to add.
         */
        add(element) {
            fragment.appendChild(element);
        },
        /**
         * Appends all batched elements to the parent.
         */
        commit() {
            parentElement.appendChild(fragment);
        }
    };
}
