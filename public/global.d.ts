import libs from './lib';
import getContext from './scripts/st-context';
import { power_user } from './scripts/power-user';
import { QuickReplyApi } from './scripts/extensions/quick-reply/api/QuickReplyApi';

declare global {
    // Custom types
    declare type InstructSettings = typeof power_user.instruct;
    declare type ContextSettings = typeof power_user.context;
    declare type ReasoningSettings = typeof power_user.reasoning;

    // Global namespace modules
    interface Window {
        ai: any;
    }

    declare var pdfjsLib;
    declare var ePub;
    declare var quickReplyApi: QuickReplyApi;

    declare var SillyTavern: {
        getContext(): typeof getContext;
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
        izoomify(options?: any): JQuery;
    }

    // NPM package doesn't have the 'queue' property in the type definition
    interface JQueryTransitOptions {
        queue?: boolean;
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

    interface ConvertVideoArgs {
        buffer: Uint8Array;
        name: string;
    }

    /**
     * Converts a video file to an animated WebP format using FFmpeg.
     * @param args - The arguments for the conversion function.
     */
    function convertVideoToAnimatedWebp(args: ConvertVideoArgs): Promise<Uint8Array>;

    interface ColorPickerEvent extends JQuery.ChangeEvent<HTMLElement> {
        detail: {
            rgba: string;
        };
    }
}
