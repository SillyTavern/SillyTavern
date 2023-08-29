import { chat_metadata, substituteParams, this_chid } from "../../../script.js";
import { extension_settings, getContext } from "../../extensions.js"
import { selected_group } from "../../group-chats.js";
import { getCharaFilename } from "../../utils.js";

export const cfgType = {
    chat: 0,
    chara: 1,
    global: 2
}
export const metadataKeys = {
    guidance_scale: "cfg_guidance_scale",
    negative_prompt: "cfg_negative_prompt",
    positive_prompt: "cfg_positive_prompt",
    prompt_combine: "cfg_prompt_combine",
    groupchat_individual_chars: "cfg_groupchat_individual_chars",
    prompt_insertion_depth: "cfg_prompt_insertion_depth",
    prompt_separator: "cfg_prompt_separator"
}

// Gets the CFG guidance scale
// If the guidance scale is 1, ignore the CFG prompt(s) since it won't be used anyways
export function getGuidanceScale() {
    const charaCfg = extension_settings.cfg.chara?.find((e) => e.name === getCharaFilename(this_chid));
    const chatGuidanceScale = chat_metadata[metadataKeys.guidance_scale];
    const groupchatCharOverride = chat_metadata[metadataKeys.groupchat_individual_chars] ?? false;

    if (chatGuidanceScale && chatGuidanceScale !== 1 && !groupchatCharOverride) {
        return {
            type: cfgType.chat,
            value: chatGuidanceScale
        };
    }

    if ((!selected_group && charaCfg || groupchatCharOverride) && charaCfg?.guidance_scale !== 1) {
        return {
            type: cfgType.chara,
            value: charaCfg.guidance_scale
        };
    }

    if (extension_settings.cfg.global && extension_settings.cfg.global?.guidance_scale !== 1) {
        return {
            type: cfgType.global,
            value: extension_settings.cfg.global.guidance_scale
        };
    }
}

// Gets the CFG prompt
export function getCfgPrompt(guidanceScale, isNegative) {
    let splitCfgPrompt = [];

    const cfgPromptCombine = chat_metadata[metadataKeys.prompt_combine] ?? [];
    if (guidanceScale.type === cfgType.chat || cfgPromptCombine.includes(cfgType.chat)) {
        splitCfgPrompt.unshift(
            substituteParams(
                chat_metadata[isNegative ? metadataKeys.negative_prompt : metadataKeys.positive_prompt]
            )
        );
    }

    const charaCfg = extension_settings.cfg.chara?.find((e) => e.name === getCharaFilename(this_chid));
    if (guidanceScale.type === cfgType.chara || cfgPromptCombine.includes(cfgType.chara)) {
        splitCfgPrompt.unshift(
            substituteParams(
                isNegative ? charaCfg.negative_prompt : charaCfg.positive_prompt
            )
        );
    }

    if (guidanceScale.type === cfgType.global || cfgPromptCombine.includes(cfgType.global)) {
        splitCfgPrompt.unshift(
            substituteParams(
                isNegative ? extension_settings.cfg.global.negative_prompt : extension_settings.cfg.global.positive_prompt
            )
        );
    }

    // This line is a bit hacky with a JSON.stringify and JSON.parse. Fix this if possible.
    const customSeparator = JSON.parse(chat_metadata[metadataKeys.prompt_separator] || JSON.stringify("\n")) ?? "\n";
    const combinedCfgPrompt = splitCfgPrompt.filter((e) => e.length > 0).join(customSeparator);
    const insertionDepth = chat_metadata[metadataKeys.prompt_insertion_depth] ?? 1;
    console.log(`Setting CFG with guidance scale: ${guidanceScale.value}, negatives: ${combinedCfgPrompt}`);

    return {
        value: combinedCfgPrompt,
        depth: insertionDepth
    };
}
