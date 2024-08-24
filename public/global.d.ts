// Global namespace modules
declare var DOMPurify;
declare var droll;
declare var Handlebars;
declare var hljs;
declare var localforage;
declare var pdfjsLib;
declare var Popper;
declare var showdown;
declare var showdownKatex;
declare var SVGInject;
declare var Readability;
declare var isProbablyReaderable;
declare var ePub;
declare var ai;

declare var SillyTavern: {
    getContext(): any;
    llm: any;
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

//#region Fuse

/**
 * Fuse.js provides fast and flexible fuzzy searching
 * @constructor
 * @param list - The list of items to search through
 * @param options - Configuration options for the search algorithm
 */
declare var Fuse: {
    new(list: any[], options?: FuseOptions): FuseInstance;
};

/** Instead of providing a (nested) key as a string, an object can be defined that can specify weight and a custom get function */
interface FuseKey {
    /**
     * The name of they key. Supports nested paths.
     */
    name: string;
    /**
     * You can allocate a weight to keys to give them higher (or lower) values in search results. The weight value has to be greater than 0. When a weight isn't provided, it will default to 1.
     * @default 1
     */
    weight?: number;
    /**
     * Function to retrieve an object's value at the specified path. The default searches nested paths.
     * @default (obj: T, path: string | string[]) => string | string[]
     */
    getFn?: (any) => string;
}

/** Configuration options for the Fuse search algorithm */
interface FuseOptions {
    /**
     * List of keys that will be searched. Supports nested paths, weighted search, and searching in arrays of strings and objects.
     * @default []
     */
    keys?: string[] | FuseKey[];

    /**
     * How much distance one character can be from another to be considered a match.
     * @default 100
     */
    distance?: number;

    /**
     * At what point the match algorithm gives up. A threshold of 0.0 requires a perfect match, while 1.0 matches everything.
     * @default 0.6
     */
    threshold?: number;

    /**
     * Whether the score should be included in the result set. A score of 0 indicates a perfect match, while a score of 1 indicates a complete mismatch.
     * @default false
     */
    includeScore?: boolean;

    /**
     * Indicates whether comparisons should be case-sensitive.
     * @default false
     */
    isCaseSensitive?: boolean;

    /**
     * Whether the matches should be included in the result set. When true, each record in the result set will include the indices of matched characters.
     * @default false
     */
    includeMatches?: boolean;

    /**
     * Only matches whose length exceeds this value will be returned.
     * @default 1
     */
    minMatchCharLength?: number;

    /**
     * Whether to sort the result list by score.
     * @default true
     */
    shouldSort?: boolean;

    /**
     * When true, the matching function will continue to the end of a search pattern even if a perfect match has already been found.
     * @default false
     */
    findAllMatches?: boolean;

    /**
     * Determines approximately where in the text the pattern is expected to be found.
     * @default 0
     */
    location?: number;

    /**
     * When true, search will ignore location and distance, so it won't matter where in the string the pattern appears.
     * @default false
     */
    ignoreLocation?: boolean;

    /**
     * When true, it enables the use of Unix-like search commands.
     * @default false
     */
    useExtendedSearch?: boolean;

    /**
     * Function to retrieve an object's value at the specified path. The default searches nested paths.
     * @default (obj: T, path: string | string[]) => string | string[]
     */
    getFn?: (obj: any, path: string | string[]) => string | string[];

    /**
     * Function to sort the results. The default sorts by ascending relevance score.
     * @default (a, b) => number
     */
    sortFn?: (a: any, b: any) => number;

    /**
     * When true, the calculation for the relevance score will ignore the field-length norm.
     * @default false
     */
    ignoreFieldNorm?: boolean;

    /**
     * Determines how much the field-length norm affects scoring. 0 is equivalent to ignoring the field-length norm, while higher values increase the effect.
     * @default 1
     */
    fieldNormWeight?: number;
}


/** Represents an individual Fuse search result */
interface FuseResult {
    /** The original item that was matched */
    item: any;
    /** The index of the item from the original input collection that was searched */
    refIndex: number;
    /** The search score, where 0 is a perfect match and 1 is the worst */
    score?: number;
    /** Optional list of matched search keys */
    matches?: Array<{ key: string; indices: [number, number][] }>;
}

/** Represents a Fuse instance, used for performing searches */
interface FuseInstance {
    /**
     * Searches through the list using the specified query.
     * @param query - The search term or phrase to use
     * @returns An array of search results matching the query
     */
    search(query: string): FuseResult[];
}

//#endregion

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

// MIT Licence. Copied from:
// https://github.com/moment/moment/blob/develop/ts3.1-typings/moment.d.ts
/**
 * @param strict Strict parsing disables the deprecated fallback to the native Date constructor when
 * parsing a string.
 */
declare function moment(inp?: moment.MomentInput, strict?: boolean): moment.Moment;
/**
 * @param strict Strict parsing requires that the format and input match exactly, including delimiters.
 * Strict parsing is frequently the best parsing option. For more information about choosing strict vs
 * forgiving parsing, see the [parsing guide](https://momentjs.com/guides/#/parsing/).
 */
declare function moment(inp?: moment.MomentInput, format?: moment.MomentFormatSpecification, strict?: boolean): moment.Moment;
/**
 * @param strict Strict parsing requires that the format and input match exactly, including delimiters.
 * Strict parsing is frequently the best parsing option. For more information about choosing strict vs
 * forgiving parsing, see the [parsing guide](https://momentjs.com/guides/#/parsing/).
 */
declare function moment(inp?: moment.MomentInput, format?: moment.MomentFormatSpecification, language?: string, strict?: boolean): moment.Moment;

declare namespace moment {
  type RelativeTimeKey = 's' | 'ss' | 'm' | 'mm' | 'h' | 'hh' | 'd' | 'dd' | 'w' | 'ww' | 'M' | 'MM' | 'y' | 'yy';
  type CalendarKey = 'sameDay' | 'nextDay' | 'lastDay' | 'nextWeek' | 'lastWeek' | 'sameElse' | string;
  type LongDateFormatKey = 'LTS' | 'LT' | 'L' | 'LL' | 'LLL' | 'LLLL' | 'lts' | 'lt' | 'l' | 'll' | 'lll' | 'llll';

  interface Locale {
    calendar(key?: CalendarKey, m?: Moment, now?: Moment): string;

    longDateFormat(key: LongDateFormatKey): string;
    invalidDate(): string;
    ordinal(n: number): string;

    preparse(inp: string): string;
    postformat(inp: string): string;
    relativeTime(n: number, withoutSuffix: boolean,
                 key: RelativeTimeKey, isFuture: boolean): string;
    pastFuture(diff: number, absRelTime: string): string;
    set(config: Object): void;

    months(): string[];
    months(m: Moment, format?: string): string;
    monthsShort(): string[];
    monthsShort(m: Moment, format?: string): string;
    monthsParse(monthName: string, format: string, strict: boolean): number;
    monthsRegex(strict: boolean): RegExp;
    monthsShortRegex(strict: boolean): RegExp;

    week(m: Moment): number;
    firstDayOfYear(): number;
    firstDayOfWeek(): number;

    weekdays(): string[];
    weekdays(m: Moment, format?: string): string;
    weekdaysMin(): string[];
    weekdaysMin(m: Moment): string;
    weekdaysShort(): string[];
    weekdaysShort(m: Moment): string;
    weekdaysParse(weekdayName: string, format: string, strict: boolean): number;
    weekdaysRegex(strict: boolean): RegExp;
    weekdaysShortRegex(strict: boolean): RegExp;
    weekdaysMinRegex(strict: boolean): RegExp;

    isPM(input: string): boolean;
    meridiem(hour: number, minute: number, isLower: boolean): string;
  }

  interface StandaloneFormatSpec {
    format: string[];
    standalone: string[];
    isFormat?: RegExp;
  }

  interface WeekSpec {
    dow: number;
    doy?: number;
  }

  type CalendarSpecVal = string | ((m?: MomentInput, now?: Moment) => string);
  interface CalendarSpec {
    sameDay?: CalendarSpecVal;
    nextDay?: CalendarSpecVal;
    lastDay?: CalendarSpecVal;
    nextWeek?: CalendarSpecVal;
    lastWeek?: CalendarSpecVal;
    sameElse?: CalendarSpecVal;

    // any additional properties might be used with moment.calendarFormat
    [x: string]: CalendarSpecVal | undefined;
  }

  type RelativeTimeSpecVal = (
    string |
    ((n: number, withoutSuffix: boolean,
      key: RelativeTimeKey, isFuture: boolean) => string)
  );
  type RelativeTimeFuturePastVal = string | ((relTime: string) => string);

  interface RelativeTimeSpec {
    future?: RelativeTimeFuturePastVal;
    past?: RelativeTimeFuturePastVal;
    s?: RelativeTimeSpecVal;
    ss?: RelativeTimeSpecVal;
    m?: RelativeTimeSpecVal;
    mm?: RelativeTimeSpecVal;
    h?: RelativeTimeSpecVal;
    hh?: RelativeTimeSpecVal;
    d?: RelativeTimeSpecVal;
    dd?: RelativeTimeSpecVal;
    w?: RelativeTimeSpecVal;
    ww?: RelativeTimeSpecVal;
    M?: RelativeTimeSpecVal;
    MM?: RelativeTimeSpecVal;
    y?: RelativeTimeSpecVal;
    yy?: RelativeTimeSpecVal;
  }

  interface LongDateFormatSpec {
    LTS: string;
    LT: string;
    L: string;
    LL: string;
    LLL: string;
    LLLL: string;

    // lets forget for a sec that any upper/lower permutation will also work
    lts?: string;
    lt?: string;
    l?: string;
    ll?: string;
    lll?: string;
    llll?: string;
  }

  type MonthWeekdayFn = (momentToFormat: Moment, format?: string) => string;
  type WeekdaySimpleFn = (momentToFormat: Moment) => string;

  interface LocaleSpecification {
    months?: string[] | StandaloneFormatSpec | MonthWeekdayFn;
    monthsShort?: string[] | StandaloneFormatSpec | MonthWeekdayFn;

    weekdays?: string[] | StandaloneFormatSpec | MonthWeekdayFn;
    weekdaysShort?: string[] | StandaloneFormatSpec | WeekdaySimpleFn;
    weekdaysMin?: string[] | StandaloneFormatSpec | WeekdaySimpleFn;

    meridiemParse?: RegExp;
    meridiem?: (hour: number, minute:number, isLower: boolean) => string;

    isPM?: (input: string) => boolean;

    longDateFormat?: LongDateFormatSpec;
    calendar?: CalendarSpec;
    relativeTime?: RelativeTimeSpec;
    invalidDate?: string;
    ordinal?: (n: number) => string;
    ordinalParse?: RegExp;

    week?: WeekSpec;

    // Allow anything: in general any property that is passed as locale spec is
    // put in the locale object so it can be used by locale functions
    [x: string]: any;
  }

  interface MomentObjectOutput {
    years: number;
    /* One digit */
    months: number;
    /* Day of the month */
    date: number;
    hours: number;
    minutes: number;
    seconds: number;
    milliseconds: number;
  }
  interface argThresholdOpts {
    ss?: number;
    s?: number;
    m?: number;
    h?: number;
    d?: number;
    w?: number | null;
    M?: number;
  }

  interface Duration {
    clone(): Duration;

    humanize(argWithSuffix?: boolean, argThresholds?: argThresholdOpts): string;

    humanize(argThresholds?: argThresholdOpts): string;

    abs(): Duration;

    as(units: unitOfTime.Base): number;
    get(units: unitOfTime.Base): number;

    milliseconds(): number;
    asMilliseconds(): number;

    seconds(): number;
    asSeconds(): number;

    minutes(): number;
    asMinutes(): number;

    hours(): number;
    asHours(): number;

    days(): number;
    asDays(): number;

    weeks(): number;
    asWeeks(): number;

    months(): number;
    asMonths(): number;

    years(): number;
    asYears(): number;

    add(inp?: DurationInputArg1, unit?: DurationInputArg2): Duration;
    subtract(inp?: DurationInputArg1, unit?: DurationInputArg2): Duration;

    locale(): string;
    locale(locale: LocaleSpecifier): Duration;
    localeData(): Locale;

    toISOString(): string;
    toJSON(): string;

    isValid(): boolean;

    /**
     * @deprecated since version 2.8.0
     */
    lang(locale: LocaleSpecifier): Moment;
    /**
     * @deprecated since version 2.8.0
     */
    lang(): Locale;
    /**
     * @deprecated
     */
    toIsoString(): string;
  }

  interface MomentRelativeTime {
    future: any;
    past: any;
    s: any;
    ss: any;
    m: any;
    mm: any;
    h: any;
    hh: any;
    d: any;
    dd: any;
    M: any;
    MM: any;
    y: any;
    yy: any;
  }

  interface MomentLongDateFormat {
    L: string;
    LL: string;
    LLL: string;
    LLLL: string;
    LT: string;
    LTS: string;

    l?: string;
    ll?: string;
    lll?: string;
    llll?: string;
    lt?: string;
    lts?: string;
  }

  interface MomentParsingFlags {
    empty: boolean;
    unusedTokens: string[];
    unusedInput: string[];
    overflow: number;
    charsLeftOver: number;
    nullInput: boolean;
    invalidMonth: string | null;
    invalidFormat: boolean;
    userInvalidated: boolean;
    iso: boolean;
    parsedDateParts: any[];
    meridiem: string | null;
  }

  interface MomentParsingFlagsOpt {
    empty?: boolean;
    unusedTokens?: string[];
    unusedInput?: string[];
    overflow?: number;
    charsLeftOver?: number;
    nullInput?: boolean;
    invalidMonth?: string;
    invalidFormat?: boolean;
    userInvalidated?: boolean;
    iso?: boolean;
    parsedDateParts?: any[];
    meridiem?: string | null;
  }

  interface MomentBuiltinFormat {
    __momentBuiltinFormatBrand: any;
  }

  type MomentFormatSpecification = string | MomentBuiltinFormat | (string | MomentBuiltinFormat)[];

  namespace unitOfTime {
    type Base = (
      "year" | "years" | "y" |
      "month" | "months" | "M" |
      "week" | "weeks" | "w" |
      "day" | "days" | "d" |
      "hour" | "hours" | "h" |
      "minute" | "minutes" | "m" |
      "second" | "seconds" | "s" |
      "millisecond" | "milliseconds" | "ms"
    );

    type _quarter = "quarter" | "quarters" | "Q";
    type _isoWeek = "isoWeek" | "isoWeeks" | "W";
    type _date = "date" | "dates" | "D";
    type DurationConstructor = Base | _quarter;

    type DurationAs = Base;

    type StartOf = Base | _quarter | _isoWeek | _date | null;

    type Diff = Base | _quarter;

    type MomentConstructor = Base | _date;

    type All = Base | _quarter | _isoWeek | _date |
      "weekYear" | "weekYears" | "gg" |
      "isoWeekYear" | "isoWeekYears" | "GG" |
      "dayOfYear" | "dayOfYears" | "DDD" |
      "weekday" | "weekdays" | "e" |
      "isoWeekday" | "isoWeekdays" | "E";
  }

  interface MomentInputObject {
    years?: number;
    year?: number;
    y?: number;

    months?: number;
    month?: number;
    M?: number;

    days?: number;
    day?: number;
    d?: number;

    dates?: number;
    date?: number;
    D?: number;

    hours?: number;
    hour?: number;
    h?: number;

    minutes?: number;
    minute?: number;
    m?: number;

    seconds?: number;
    second?: number;
    s?: number;

    milliseconds?: number;
    millisecond?: number;
    ms?: number;
  }

  interface DurationInputObject extends MomentInputObject {
    quarters?: number;
    quarter?: number;
    Q?: number;

    weeks?: number;
    week?: number;
    w?: number;
  }

  interface MomentSetObject extends MomentInputObject {
    weekYears?: number;
    weekYear?: number;
    gg?: number;

    isoWeekYears?: number;
    isoWeekYear?: number;
    GG?: number;

    quarters?: number;
    quarter?: number;
    Q?: number;

    weeks?: number;
    week?: number;
    w?: number;

    isoWeeks?: number;
    isoWeek?: number;
    W?: number;

    dayOfYears?: number;
    dayOfYear?: number;
    DDD?: number;

    weekdays?: number;
    weekday?: number;
    e?: number;

    isoWeekdays?: number;
    isoWeekday?: number;
    E?: number;
  }

  interface FromTo {
    from: MomentInput;
    to: MomentInput;
  }

  type MomentInput = Moment | Date | string | number | (number | string)[] | MomentInputObject | null | undefined;
  type DurationInputArg1 = Duration | number | string | FromTo | DurationInputObject | null | undefined;
  type DurationInputArg2 = unitOfTime.DurationConstructor;
  type LocaleSpecifier = string | Moment | Duration | string[] | boolean;

  interface MomentCreationData {
    input: MomentInput;
    format?: MomentFormatSpecification;
    locale: Locale;
    isUTC: boolean;
    strict?: boolean;
  }

  interface Moment extends Object {
    format(format?: string): string;

    startOf(unitOfTime: unitOfTime.StartOf): Moment;
    endOf(unitOfTime: unitOfTime.StartOf): Moment;

    add(amount?: DurationInputArg1, unit?: DurationInputArg2): Moment;
    /**
     * @deprecated reverse syntax
     */
    add(unit: unitOfTime.DurationConstructor, amount: number|string): Moment;

    subtract(amount?: DurationInputArg1, unit?: DurationInputArg2): Moment;
    /**
     * @deprecated reverse syntax
     */
    subtract(unit: unitOfTime.DurationConstructor, amount: number|string): Moment;

    calendar(): string;
    calendar(formats: CalendarSpec): string;
    calendar(time?: MomentInput, formats?: CalendarSpec): string;

    clone(): Moment;

    /**
     * @return Unix timestamp in milliseconds
     */
    valueOf(): number;

    // current date/time in local mode
    local(keepLocalTime?: boolean): Moment;
    isLocal(): boolean;

    // current date/time in UTC mode
    utc(keepLocalTime?: boolean): Moment;
    isUTC(): boolean;
    /**
     * @deprecated use isUTC
     */
    isUtc(): boolean;

    parseZone(): Moment;
    isValid(): boolean;
    invalidAt(): number;

    hasAlignedHourOffset(other?: MomentInput): boolean;

    creationData(): MomentCreationData;
    parsingFlags(): MomentParsingFlags;

    year(y: number): Moment;
    year(): number;
    /**
     * @deprecated use year(y)
     */
    years(y: number): Moment;
    /**
     * @deprecated use year()
     */
    years(): number;
    quarter(): number;
    quarter(q: number): Moment;
    quarters(): number;
    quarters(q: number): Moment;
    month(M: number|string): Moment;
    month(): number;
    /**
     * @deprecated use month(M)
     */
    months(M: number|string): Moment;
    /**
     * @deprecated use month()
     */
    months(): number;
    day(d: number|string): Moment;
    day(): number;
    days(d: number|string): Moment;
    days(): number;
    date(d: number): Moment;
    date(): number;
    /**
     * @deprecated use date(d)
     */
    dates(d: number): Moment;
    /**
     * @deprecated use date()
     */
    dates(): number;
    hour(h: number): Moment;
    hour(): number;
    hours(h: number): Moment;
    hours(): number;
    minute(m: number): Moment;
    minute(): number;
    minutes(m: number): Moment;
    minutes(): number;
    second(s: number): Moment;
    second(): number;
    seconds(s: number): Moment;
    seconds(): number;
    millisecond(ms: number): Moment;
    millisecond(): number;
    milliseconds(ms: number): Moment;
    milliseconds(): number;
    weekday(): number;
    weekday(d: number): Moment;
    isoWeekday(): number;
    isoWeekday(d: number|string): Moment;
    weekYear(): number;
    weekYear(d: number): Moment;
    isoWeekYear(): number;
    isoWeekYear(d: number): Moment;
    week(): number;
    week(d: number): Moment;
    weeks(): number;
    weeks(d: number): Moment;
    isoWeek(): number;
    isoWeek(d: number): Moment;
    isoWeeks(): number;
    isoWeeks(d: number): Moment;
    weeksInYear(): number;
    isoWeeksInYear(): number;
    isoWeeksInISOWeekYear(): number;
    dayOfYear(): number;
    dayOfYear(d: number): Moment;

    from(inp: MomentInput, suffix?: boolean): string;
    to(inp: MomentInput, suffix?: boolean): string;
    fromNow(withoutSuffix?: boolean): string;
    toNow(withoutPrefix?: boolean): string;

    diff(b: MomentInput, unitOfTime?: unitOfTime.Diff, precise?: boolean): number;

    toArray(): [number, number, number, number, number, number, number];
    toDate(): Date;
    toISOString(keepOffset?: boolean): string;
    inspect(): string;
    toJSON(): string;
    unix(): number;

    isLeapYear(): boolean;
    /**
     * @deprecated in favor of utcOffset
     */
    zone(): number;
    zone(b: number|string): Moment;
    utcOffset(): number;
    utcOffset(b: number|string, keepLocalTime?: boolean): Moment;
    isUtcOffset(): boolean;
    daysInMonth(): number;
    isDST(): boolean;

    zoneAbbr(): string;
    zoneName(): string;

    isBefore(inp?: MomentInput, granularity?: unitOfTime.StartOf): boolean;
    isAfter(inp?: MomentInput, granularity?: unitOfTime.StartOf): boolean;
    isSame(inp?: MomentInput, granularity?: unitOfTime.StartOf): boolean;
    isSameOrAfter(inp?: MomentInput, granularity?: unitOfTime.StartOf): boolean;
    isSameOrBefore(inp?: MomentInput, granularity?: unitOfTime.StartOf): boolean;
    isBetween(a: MomentInput, b: MomentInput, granularity?: unitOfTime.StartOf, inclusivity?: "()" | "[)" | "(]" | "[]"): boolean;

    /**
     * @deprecated as of 2.8.0, use locale
     */
    lang(language: LocaleSpecifier): Moment;
    /**
     * @deprecated as of 2.8.0, use locale
     */
    lang(): Locale;

    locale(): string;
    locale(locale: LocaleSpecifier): Moment;

    localeData(): Locale;

    /**
     * @deprecated no reliable implementation
     */
    isDSTShifted(): boolean;

    // NOTE(constructor): Same as moment constructor
    /**
     * @deprecated as of 2.7.0, use moment.min/max
     */
    max(inp?: MomentInput, format?: MomentFormatSpecification, strict?: boolean): Moment;
    /**
     * @deprecated as of 2.7.0, use moment.min/max
     */
    max(inp?: MomentInput, format?: MomentFormatSpecification, language?: string, strict?: boolean): Moment;

    // NOTE(constructor): Same as moment constructor
    /**
     * @deprecated as of 2.7.0, use moment.min/max
     */
    min(inp?: MomentInput, format?: MomentFormatSpecification, strict?: boolean): Moment;
    /**
     * @deprecated as of 2.7.0, use moment.min/max
     */
    min(inp?: MomentInput, format?: MomentFormatSpecification, language?: string, strict?: boolean): Moment;

    get(unit: unitOfTime.All): number;
    set(unit: unitOfTime.All, value: number): Moment;
    set(objectLiteral: MomentSetObject): Moment;

    toObject(): MomentObjectOutput;
  }

  export var version: string;
  export var fn: Moment;

  // NOTE(constructor): Same as moment constructor
  /**
   * @param strict Strict parsing disables the deprecated fallback to the native Date constructor when
   * parsing a string.
   */
  export function utc(inp?: MomentInput, strict?: boolean): Moment;
  /**
   * @param strict Strict parsing requires that the format and input match exactly, including delimiters.
   * Strict parsing is frequently the best parsing option. For more information about choosing strict vs
   * forgiving parsing, see the [parsing guide](https://momentjs.com/guides/#/parsing/).
   */
  export function utc(inp?: MomentInput, format?: MomentFormatSpecification, strict?: boolean): Moment;
  /**
   * @param strict Strict parsing requires that the format and input match exactly, including delimiters.
   * Strict parsing is frequently the best parsing option. For more information about choosing strict vs
   * forgiving parsing, see the [parsing guide](https://momentjs.com/guides/#/parsing/).
   */
  export function utc(inp?: MomentInput, format?: MomentFormatSpecification, language?: string, strict?: boolean): Moment;

  export function unix(timestamp: number): Moment;

  export function invalid(flags?: MomentParsingFlagsOpt): Moment;
  export function isMoment(m: any): m is Moment;
  export function isDate(m: any): m is Date;
  export function isDuration(d: any): d is Duration;

  /**
   * @deprecated in 2.8.0
   */
  export function lang(language?: string): string;
  /**
   * @deprecated in 2.8.0
   */
  export function lang(language?: string, definition?: Locale): string;

  export function locale(language?: string): string;
  export function locale(language?: string[]): string;
  export function locale(language?: string, definition?: LocaleSpecification | null | undefined): string;

  export function localeData(key?: string | string[]): Locale;

  export function duration(inp?: DurationInputArg1, unit?: DurationInputArg2): Duration;

  // NOTE(constructor): Same as moment constructor
  export function parseZone(inp?: MomentInput, format?: MomentFormatSpecification, strict?: boolean): Moment;
  export function parseZone(inp?: MomentInput, format?: MomentFormatSpecification, language?: string, strict?: boolean): Moment;

  export function months(): string[];
  export function months(index: number): string;
  export function months(format: string): string[];
  export function months(format: string, index: number): string;
  export function monthsShort(): string[];
  export function monthsShort(index: number): string;
  export function monthsShort(format: string): string[];
  export function monthsShort(format: string, index: number): string;

  export function weekdays(): string[];
  export function weekdays(index: number): string;
  export function weekdays(format: string): string[];
  export function weekdays(format: string, index: number): string;
  export function weekdays(localeSorted: boolean): string[];
  export function weekdays(localeSorted: boolean, index: number): string;
  export function weekdays(localeSorted: boolean, format: string): string[];
  export function weekdays(localeSorted: boolean, format: string, index: number): string;
  export function weekdaysShort(): string[];
  export function weekdaysShort(index: number): string;
  export function weekdaysShort(format: string): string[];
  export function weekdaysShort(format: string, index: number): string;
  export function weekdaysShort(localeSorted: boolean): string[];
  export function weekdaysShort(localeSorted: boolean, index: number): string;
  export function weekdaysShort(localeSorted: boolean, format: string): string[];
  export function weekdaysShort(localeSorted: boolean, format: string, index: number): string;
  export function weekdaysMin(): string[];
  export function weekdaysMin(index: number): string;
  export function weekdaysMin(format: string): string[];
  export function weekdaysMin(format: string, index: number): string;
  export function weekdaysMin(localeSorted: boolean): string[];
  export function weekdaysMin(localeSorted: boolean, index: number): string;
  export function weekdaysMin(localeSorted: boolean, format: string): string[];
  export function weekdaysMin(localeSorted: boolean, format: string, index: number): string;

  export function min(moments: Moment[]): Moment;
  export function min(...moments: Moment[]): Moment;
  export function max(moments: Moment[]): Moment;
  export function max(...moments: Moment[]): Moment;

  /**
   * Returns unix time in milliseconds. Overwrite for profit.
   */
  export function now(): number;

  export function defineLocale(language: string, localeSpec: LocaleSpecification | null): Locale;
  export function updateLocale(language: string, localeSpec: LocaleSpecification | null): Locale;

  export function locales(): string[];

  export function normalizeUnits(unit: unitOfTime.All): string;
  export function relativeTimeThreshold(threshold: string): number | boolean;
  export function relativeTimeThreshold(threshold: string, limit: number): boolean;
  export function relativeTimeRounding(fn: (num: number) => number): boolean;
  export function relativeTimeRounding(): (num: number) => number;
  export function calendarFormat(m: Moment, now: Moment): string;

  export function parseTwoDigitYear(input: string): number;
  /**
   * Constant used to enable explicit ISO_8601 format parsing.
   */
  export var ISO_8601: MomentBuiltinFormat;
  export var RFC_2822: MomentBuiltinFormat;

  export var defaultFormat: string;
  export var defaultFormatUtc: string;

  export var suppressDeprecationWarnings: boolean;
  export var deprecationHandler: ((name: string | null, msg: string) => void) | null | undefined;

  export var HTML5_FMT: {
    DATETIME_LOCAL: string,
    DATETIME_LOCAL_SECONDS: string,
    DATETIME_LOCAL_MS: string,
    DATE: string,
    TIME: string,
    TIME_SECONDS: string,
    TIME_MS: string,
    WEEK: string,
    MONTH: string
  };

}

declare global {
  const moment: typeof moment;
}

/**
 * Callback data for the `LLM_FUNCTION_TOOL_REGISTER` event type that is triggered when a function tool can be registered.
 */
interface FunctionToolRegister {
    /**
     * The type of generation that is being used
     */
    type?: string;
    /**
     * Generation data, including messages and sampling parameters
     */
    data: Record<string, object>;
    /**
     * Callback to register an LLM function tool.
     */
    registerFunctionTool: typeof registerFunctionTool;
}

/**
 * Callback data for the `LLM_FUNCTION_TOOL_REGISTER` event type that is triggered when a function tool is registered.
 * @param name Name of the function tool to register
 * @param description Description of the function tool
 * @param params JSON schema for the parameters of the function tool
 * @param required Whether the function tool should be forced to be used
 */
declare function registerFunctionTool(name: string, description: string, params: object, required: boolean): Promise<void>;

/**
 * Callback data for the `LLM_FUNCTION_TOOL_CALL` event type that is triggered when a function tool is called.
 */
interface FunctionToolCall {
    /**
     * Name of the function tool to call
     */
    name: string;
    /**
     * JSON object with the parameters to pass to the function tool
     */
    arguments: string;
}
