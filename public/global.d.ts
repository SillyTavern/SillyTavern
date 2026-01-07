import libs from './lib';
import getContext from './scripts/st-context';
import { power_user } from './scripts/power-user';
import { QuickReplyApi } from './scripts/extensions/quick-reply/api/QuickReplyApi';
import { oai_settings } from './scripts/openai';
import { textgenerationwebui_settings } from './scripts/textgen-settings';
import { FileAttachment } from './scripts/chats';
import { ReasoningMessageExtra } from './scripts/reasoning';
import { IGNORE_SYMBOL, OVERSWIPE_BEHAVIOR } from './scripts/constants';
import { ToolInvocation } from './scripts/tool-calling';
import { getWorldInfoSettings } from './scripts/world-info';

declare global {
    // Custom types
    type InstructSettings = typeof power_user.instruct;
    type ContextSettings = typeof power_user.context;
    type ReasoningSettings = typeof power_user.reasoning;
    type ChatCompletionSettings = typeof oai_settings;
    type TextCompletionSettings = typeof textgenerationwebui_settings;
    type WorldInfoSettings = ReturnType<typeof getWorldInfoSettings>;
    type MessageTimestamp = string | number | Date;
    type Character = import('./scripts/char-data').v1CharData;
    type ChatMessageExtra = BaseMessageExtra & Partial<ReasoningMessageExtra> & Record<string, any>;

    interface Group {
        id: string;
        name: string;
        members: string[];
        disabled_members: string[];
        chat_id: string;
        chats: string[];
        generation_mode?: number;
        generation_mode_join_prefix?: string;
        generation_mode_join_suffix?: string;
        activation_strategy?: number;
        auto_mode_delay?: number;
        allow_self_responses?: boolean;
        avatar_url?: string;
        hideMutedSprites?: boolean;
        fav?: boolean;
        date_last_chat?: MessageTimestamp;
    }

    interface ChatFile extends Array<ChatMessage> {
        [index: number]: ChatMessage;
        0?: ChatHeader;
    }

    interface ChatHeader {
        chat_metadata: ChatMetadata;
        /** @deprecated For backward compatibility ONLY */
        user_name: 'unused';
        /** @deprecated For backward compatibility ONLY */
        character_name: 'unused';
    }

    interface ChatMetadata {
        tainted?: boolean;
        integrity?: string;
        scenario?: string;
        persona?: string;
        [key: string]: any;
    }

    interface ChatMessage {
        name?: string;
        mes?: string;
        title?: string;
        gen_started?: MessageTimestamp;
        gen_finished?: MessageTimestamp;
        send_date?: MessageTimestamp;
        is_user?: boolean;
        is_system?: boolean;
        force_avatar?: string;
        original_avatar?: string;
        swipes?: string[];
        swipe_info?: SwipeInfo[];
        swipe_id?: number;
        extra?: ChatMessageExtra;
    };

    interface SwipeInfo {
        send_date?: MessageTimestamp;
        gen_started?: MessageTimestamp;
        gen_finished?: MessageTimestamp;
        extra?: ChatMessageExtra;
    }

    interface BaseMessageExtra {
        api?: string;
        model?: string;
        type?: string;
        gen_id?: number;
        bias?: string;
        uses_system_ui?: boolean;
        memory?: string;
        display_text?: string;
        reasoning_display_text?: string;
        tool_invocations?: ToolInvocation[];
        title?: string;
        isSmallSys?: boolean;
        token_count?: number;
        /** When false, the message cannot be swiped. */
        swipeable?: boolean;
        overswipe_behavior?: OVERSWIPE_BEHAVIOR;
        files?: FileAttachment[];
        inline_image?: boolean;
        media_display?: string;
        media_index?: number;
        media?: MediaAttachment[],
        /** @deprecated Use `files` instead */
        file?: FileAttachment;
        /** @deprecated Use `media` instead */
        image?: string;
        /** @deprecated Use `media` instead */
        video?: string;
        /** @deprecated Use `media` with `media_display = 'gallery'` instead */
        image_swipes?: string[];
        /** @deprecated Use `MediaAttachment.append_title` instead */
        append_title?: boolean;
        /** @deprecated Use `MediaAttachment.generation_type` instead */
        generationType?: number;
        /** @deprecated Use `MediaAttachment.negative` instead */
        negative?: string;
        /** Will exclude this message from prompt processing */
        [IGNORE_SYMBOL]?: boolean;
    }

    type MediaAttachment = MediaAttachmentProps & ImageGenerationAttachmentProps & ImageCaptionAttachmentProps;

    interface MediaAttachmentProps {
        url: string;
        title?: string;
        type: string;
        source?: string;
    }

    interface ImageGenerationAttachmentProps {
        generation_type?: number;
        negative?: string;
    }

    interface ImageCaptionAttachmentProps {
        /** Append title to the message text in case of non-inline captions. */
        append_title?: boolean;
        /** Marker for captioned images to prevent auto-caption from firing again. */
        captioned?: boolean;
    }

    /** Media playback state */
    interface MediaState {
        /** Current playback time */
        currentTime: number;
        /** Whether the media is paused */
        paused: boolean;
    }

    interface ChatCompletionMessage {
        name?: string;
        role: string;
        content: string;
    }

    // Global namespace modules
    interface Window {
        ai: any;
    }

    var pdfjsLib;
    var ePub;
    var quickReplyApi: QuickReplyApi;

    var SillyTavern: {
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
    function translate(text: string, lang: string, provider?: string | null): Promise<string>;

    interface ConvertVideoArgs {
        buffer: Uint8Array;
        name: string;
    }

    /**
     * Converts a video file to an animated WebP format using FFmpeg.
     * @param args - The arguments for the conversion function.
     */
    function convertVideoToAnimatedWebp(args: ConvertVideoArgs): Promise<Uint8Array>;

    type ColorPickerEvent = Omit<JQuery.ChangeEvent<HTMLElement>, "detail"> & {
        detail: {
            rgba: string;
        }
    };

    type SwipeEvent = JQuery.TriggeredEvent<any, any, HTMLElement, HTMLElement>;
}

//Overrides for public/scripts/chats.js
declare module 'dompurify' {
    interface Config {
        MESSAGE_SANITIZE?: boolean;
        MESSAGE_ALLOW_SYSTEM_UI?: boolean;
    }
}
