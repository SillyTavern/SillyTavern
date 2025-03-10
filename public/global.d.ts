import libs from './lib';
import getContext from './scripts/st-context';

// Global namespace modules
declare var ai;
declare var pdfjsLib;
declare var ePub;

declare var SillyTavern: {
    getContext(): typeof getContext;
    llm: any;
    libs: typeof libs;
};

declare global {
    // Jquery plugins
    interface JQuery {
        nanogallery2(options?: any): JQuery;
        nanogallery2(method: string, options?: any): JQuery;
        pagination(method: 'getCurrentPageNum'): number;
        pagination(method: string, options?: any): JQuery;
        pagination(options?: any): JQuery;
        izoomify(options?: any): JQuery;
    }

    namespace Select2 {
        interface Options<Result = DataFormat | GroupedDataFormat, RemoteResult = any> {
            /**
             * Extends Select2 v4 plugin by adding an option to set a placeholder for the 'search' input field
             * [Custom Field]
             * @default ''
             */
            searchInputPlaceholder?: string;

            /**
             * Extends select2 plugin by adding a custom css class for the 'search' input field
             * [Custom Field]
             * @default ''
             */
            searchInputCssClass?: string;
        }
    }

    /**
     * Translates a text to a target language using a translation provider.
     * @param text Text to translate
     * @param lang Target language
     * @param provider Translation provider
     */
    async function translate(text: string, lang: string, provider: string = null): Promise<string>;
}
