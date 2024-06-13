import { debounce_timeout } from './constants.js';

/**
 * Drag and drop handler
 *
 * Can be used on any element, enabling drag&drop styling and callback on drop.
 */
export class DragAndDropHandler {
    /** @private @type {JQuery.Selector} */ selector;
    /** @private @type {(files: File[], event:JQuery.DropEvent<HTMLElement, undefined, any, any>) => void} */ onDropCallback;
    /** @private @type {NodeJS.Timeout} Remark: Not actually NodeJS timeout, but it's close */ dragLeaveTimeout;

    /** @private @type {boolean} */ noAnimation;

    /**
     * Create a DragAndDropHandler
     * @param {JQuery.Selector} selector - The CSS selector for the elements to enable drag and drop
     * @param {(files: File[], event:JQuery.DropEvent<HTMLElement, undefined, any, any>) => void} onDropCallback - The callback function to handle the drop event
     */
    constructor(selector, onDropCallback, { noAnimation = false } = {}) {
        this.selector = selector;
        this.onDropCallback = onDropCallback;
        this.dragLeaveTimeout = null;

        this.noAnimation = noAnimation;

        this.init();
    }

    /**
     * Destroy the drag and drop functionality
     */
    destroy() {
        if (this.selector === 'body') {
            $(document.body).off('dragover', this.handleDragOver.bind(this));
            $(document.body).off('dragleave', this.handleDragLeave.bind(this));
            $(document.body).off('drop', this.handleDrop.bind(this));
        } else {
            $(document.body).off('dragover', this.selector, this.handleDragOver.bind(this));
            $(document.body).off('dragleave', this.selector, this.handleDragLeave.bind(this));
            $(document.body).off('drop', this.selector, this.handleDrop.bind(this));
        }

        $(this.selector).remove('drop_target no_animation');
    }

    /**
     * Initialize the drag and drop functionality
     * Automatically called on construction
     * @private
     */
    init() {
        if (this.selector === 'body') {
            $(document.body).on('dragover', this.handleDragOver.bind(this));
            $(document.body).on('dragleave', this.handleDragLeave.bind(this));
            $(document.body).on('drop', this.handleDrop.bind(this));
        } else {
            $(document.body).on('dragover', this.selector, this.handleDragOver.bind(this));
            $(document.body).on('dragleave', this.selector, this.handleDragLeave.bind(this));
            $(document.body).on('drop', this.selector, this.handleDrop.bind(this));
        }

        $(this.selector).addClass('drop_target');
        if (this.noAnimation) $(this.selector).addClass('no_animation');
    }

    /**
     * @param {JQuery.DragOverEvent<HTMLElement, undefined, any, any>} event - The dragover event
     * @private
     */
    handleDragOver(event) {
        event.preventDefault();
        event.stopPropagation();
        clearTimeout(this.dragLeaveTimeout);
        $(this.selector).addClass('drop_target dragover');
        if (this.noAnimation) $(this.selector).addClass('no_animation');
    }

    /**
     * @param {JQuery.DragLeaveEvent<HTMLElement, undefined, any, any>} event - The dragleave event
     * @private
     */
    handleDragLeave(event) {
        event.preventDefault();
        event.stopPropagation();

        // Debounce the removal of the class, so it doesn't "flicker" on dragging over
        clearTimeout(this.dragLeaveTimeout);
        this.dragLeaveTimeout = setTimeout(() => {
            $(this.selector).removeClass('dragover');
        }, debounce_timeout.quick);
    }

    /**
     * @param {JQuery.DropEvent<HTMLElement, undefined, any, any>} event - The drop event
     * @private
     */
    handleDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        clearTimeout(this.dragLeaveTimeout);
        $(this.selector).removeClass('dragover');

        const files = Array.from(event.originalEvent.dataTransfer.files);
        this.onDropCallback(files, event);
    }
}
