import libs from './lib';

// Global namespace modules
declare var ai;
declare var pdfjsLib;
declare var ePub;

declare var SillyTavern: {
    getContext(): any;
    llm: any;
    libs: typeof libs;
};

// Jquery plugins
interface JQuery {
    nanogallery2(options?: any): JQuery;
    nanogallery2(method: string, options?: any): JQuery;
    pagination(method: 'getCurrentPageNum'): number;
    pagination(method: string, options?: any): JQuery;
    pagination(options?: any): JQuery;
    transition(options?: any, complete?: function): JQuery;
    autocomplete(options?: any): JQuery;
    autocomplete(method: string, options?: any): JQuery;
    slider(options?: any): JQuery;
    slider(method: string, func: string, options?: any): JQuery;
    cropper(options?: any): JQuery;
    izoomify(options?: any): JQuery;

    //#region select2

    /**
     * Initializes or modifies a select2 instance with provided options
     *
     * @param options - Configuration options for the select2 instance
     * @returns The jQuery object for chaining
     */
    select2(options?: Select2Options): JQuery;

    /**
     * Retrieves data currently selected in the select2 instance
     *
     * @param field - A string specifying the 'data' method
     * @returns An array of selected items
     */
    select2(field: 'data'): any[];

    /**
     * Calls the specified select2 method
     *
     * @param method - The name of the select2 method to invoke
     * @returns The jQuery object for chaining
     */
    select2(method: 'open' | 'close' | 'destroy' | 'focus' | 'val', value?: any): JQuery;

    //#endregion

    //#region sortable

    /**
     * Initializes or updates a sortable instance with the provided options
     *
     * @param options - Configuration options for the sortable instance
     * @returns The jQuery object for chaining
     */
    sortable(options?: SortableOptions): JQuery;

    /**
     * Calls a sortable method to perform actions on the instance
     *
     * @param method - The name of the sortable method to invoke
     * @returns The jQuery object for chaining
     */
    sortable(method: 'destroy' | 'disable' | 'enable' | 'refresh' | 'toArray'): JQuery;

    /**
     * Retrieves the sortable's instance object. If the element does not have an associated instance, undefined is returned.
     *
     * @returns The instance of the sortable object
     */
    sortable(method: 'instance'): object;

    /**
     * Retrieves the current option value for the specified option
     *
     * @param method - The string 'option' to retrieve an option value
     * @param optionName - The name of the option to retrieve
     * @returns The value of the specified option
     */
    sortable(method: 'option', optionName: string): any;

    /**
     * Sets the value of the specified option
     *
     * @param method - The string 'option' to set an option value
     * @param optionName - The name of the option to set
     * @param value - The value to assign to the option
     * @returns The jQuery object for chaining
     */
    sortable(method: 'option', optionName: string, value: any): JQuery;

    /**
     * Sets multiple options using an object
     *
     * @param method - The string 'option' to set options
     * @param options - An object containing multiple option key-value pairs
     * @returns The jQuery object for chaining
     */
    sortable(method: 'option', options: SortableOptions): JQuery;

    //#endregion
}

//#region select2

/** Options for configuring a select2 instance */
interface Select2Options {
    /**
     * Provides support for ajax data sources
     * @param params - Parameters including the search term
     * @param callback - A callback function to handle the results
     * @default null
     */
    ajax?: {
        url: string;
        dataType?: string;
        delay?: number;
        data?: (params: any) => any;
        processResults?: (data: any, params: any) => any;
    } | { transport: (params, success, failure) => any };

    /**
     * Provides support for clearable selections
     * @default false
     */
    allowClear?: boolean;

    /**
     * See Using Select2 with AMD or CommonJS loaders
     * @default './i18n/'
     */
    amdLanguageBase?: string;

    /**
     * Controls whether the dropdown is closed after a selection is made
     * @default true
     */
    closeOnSelect?: boolean;

    /**
     * Allows rendering dropdown options from an array
     * @default null
     */
    data?: object[];

    /**
     * Used to override the built-in DataAdapter
     * @default SelectAdapter
     */
    dataAdapter?: SelectAdapter;

    /**
     * Enable debugging messages in the browser console
     * @default false
     */
    debug?: boolean;

    /**
     * Sets the dir attribute on the selection and dropdown containers to indicate the direction of the text
     * @default 'ltr'
     */
    dir?: string;

    /**
     * When set to true, the select control will be disabled
     * @default false
     */
    disabled?: boolean;

    /**
     * Used to override the built-in DropdownAdapter
     * @default DropdownAdapter
     */
    dropdownAdapter?: DropdownAdapter;

    /**
     * @default false
     */
    dropdownAutoWidth?: boolean;

    /**
     * Adds additional CSS classes to the dropdown container. The helper :all: can be used to add all CSS classes present on the original <select> element.
     * @default ''
     */
    dropdownCssClass?: string;

    /**
     * Allows you to customize placement of the dropdown
     * @default $(document.body)
     */
    dropdownParent?: JQuery | HTMLElement;

    /**
     * Handles automatic escaping of content rendered by custom templates
     * @default Utils.escapeMarkup
     */
    escapeMarkup?: function;

    /**
     * Specify the language used for Select2 messages
     * @default EnglishTranslation
     */
    language?: string | object;

    /**
     * Handles custom search matching
     * @default null
     */
    matcher?: (searchParams: object, data: object) => boolean;

    /**
     * Maximum number of characters that may be provided for a search term
     * @default 0
     */
    maximumInputLength?: number;

    /**
     * The maximum number of items that may be selected in a multi-select control. If the value of this option is less than 1, the number of selected items will not be limited.
     * @default 0
     */
    maximumSelectionLength?: number;

    /**
     * 	Minimum number of characters required to start a search
     * @default 0
     */
    minimumInputLength?: number;

    /**
     * The minimum number of results required to display the search box
     * @default 0
     */
    minimumResultsForSearch?: number;

    /**
     * This option enables multi-select (pillbox) mode. Select2 will automatically map the value of the multiple HTML attribute to this option during initialization.
     * @default false
     */
    multiple?: boolean;

    /**
     * Specifies the placeholder for the control
     * @default null
     */
    placeholder?: string;

    /**
     * Used to override the built-in ResultsAdapter
     * @default ResultsAdapter
     */
    resultsAdapter?: ResultsAdapter;

    /**
     * Used to override the built-in SelectionAdapter
     * @default SingleSelection | MultipleSelection
     */
    selectionAdapter?: SingleSelection | MultipleSelection;

    /**
     * Adds additional CSS classes to the selection container. The helper :all: can be used to add all CSS classes present on the original <select> element
     * @default ''
     */
    selectionCssClass?: string;

    /**
     * Implements automatic selection when the dropdown is closed
     * @default false
     */
    selectOnClose?: boolean;

    sorter?: function;

    /**
     * When set to `true`, allows the user to create new tags that aren't pre-populated
     * Used to enable free text responses
     * @default false
     */
    tags?: boolean | object[];

    /**
     * Customizes the way that search results are rendered
     * @param item - The item object to format
     * @returns The formatted representation
     * @default null
     */
    templateResult?: (item: any) => JQuery | string;

    /**
     * Customizes the way that selections are rendered
     * @param item - The selected item object to format
     * @returns The formatted representation
     * @default null
     */
    templateSelection?: (item: any) => JQuery | string;

    /**
     * Allows you to set the theme
     * @default 'default'
     */
    theme?: string;

    /**
     * A callback that handles automatic tokenization of free-text entry
     * @default null
     */
    tokenizer?: (input: { _type: string, term: string }, selection: { options: object }, callback: (Select2Option) => any) => { term: string };

    /**
     * The list of characters that should be used as token separators
     * @default null
     */
    tokenSeparators?: string[];

    /**
     * Supports customization of the container width
     * @default 'resolve'
     */
    width?: string;

    /**
     * If true, resolves issue for multiselects using closeOnSelect: false that caused the list of results to scroll to the first selection after each select/unselect
     * @default false
     */
    scrollAfterSelect?: boolean;

    /**
     * Extends Select2 v4 plugin by adding an option to set a placeholder for the 'search' input field
     * [Custom Field]
     * @default ''
     */
    searchInputPlaceholder?: string;

    /**
     * Extends select2 plugin by adding a custom css class for the 'searcH' input field
     * [Custom Field]
     * @default ''
     */
    searchInputCssClass?: string;
}

//#endregion

//#region sortable

/** Options for configuring a sortable instance */
interface SortableOptions {
    /**
     * When set, prevents the sortable items from being dragged unless clicked with a delay
     * @default 0
     */
    delay?: number;

    /**
     * Class name for elements to handle sorting. Elements with this class can be dragged to sort.
     * @default ''
     */
    handle?: string;

    /**
     * Whether to allow sorting between different connected lists
     * @default false
     */
    connectWith?: string | boolean;

    /**
     * Function called when sorting starts
     * @param event - The event object
     * @param ui - The UI object containing the helper and position information
     */
    start?: (event: Event, ui: SortableUI) => void;

    /**
     * Function called when sorting stops
     * @param event - The event object
     * @param ui - The UI object containing the helper and position information
     */
    stop?: (event: Event, ui: SortableUI) => void;

    /**
     * Function called when sorting updates
     * @param event - The event object
     * @param ui - The UI object containing the helper and position information
     */
    update?: (event: Event, ui: SortableUI) => void;

    /**
     * Specifies which items inside the element should be sortable
     * @default '> *'
     */
    items?: string;
}

/** UI object passed to sortable event handlers */
interface SortableUI {
    /** jQuery object representing the helper element */
    helper: JQuery;
    /** The current position of the helper element */
    position: { top: number; left: number };
    /** Original position of the helper element */
    originalPosition: { top: number; left: number };
    /** jQuery object representing the item being sorted */
    item: JQuery;
    /** The placeholder element used during sorting */
    placeholder: JQuery;
}

//#endregion
