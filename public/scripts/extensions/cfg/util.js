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
    negative_combine: "cfg_negative_combine",
    groupchat_individual_chars: "cfg_groupchat_individual_chars",
    negative_insertion_depth: "cfg_negative_insertion_depth",
    negative_separator: "cfg_negative_separator"
}

// Gets the CFG value from hierarchy of chat -> character -> global
// Returns undefined values which should be handled in the respective backend APIs
// TODO: Maybe use existing prompt building/substitution?
// TODO: Insertion depth conflicts with author's note. Shouldn't matter though since CFG is prompt mixing.
export function getCfg(prompt) {
    const splitPrompt = prompt?.split("\n") ?? [];
    let splitNegativePrompt = [];
    const charaCfg = extension_settings.cfg.chara?.find((e) => e.name === getCharaFilename(this_chid));
    const guidanceScale = getGuidanceScale(charaCfg);
    const chatNegativeCombine = chat_metadata[metadataKeys.negative_combine] ?? [];

    // If there's a guidance scale, continue. Otherwise assume undefined
    if (guidanceScale?.value && guidanceScale?.value !== 1) {
        if (guidanceScale.type === cfgType.chat || chatNegativeCombine.includes(cfgType.chat)) {
            splitNegativePrompt.unshift(substituteParams(chat_metadata[metadataKeys.negative_prompt])?.trim());
        }

        if (guidanceScale.type === cfgType.chara || chatNegativeCombine.includes(cfgType.chara)) {
            splitNegativePrompt.unshift(substituteParams(charaCfg.negative_prompt)?.trim())
        }

        if (guidanceScale.type === cfgType.global || chatNegativeCombine.includes(cfgType.global)) {
            splitNegativePrompt.unshift(substituteParams(extension_settings.cfg.global.negative_prompt)?.trim());
        }

        // This line is a bit hacky with a JSON.stringify and JSON.parse. Fix this if possible.
        const negativeSeparator = JSON.parse(chat_metadata[metadataKeys.negative_separator] || JSON.stringify("\n")) ?? "\n";
        const combinedNegatives = splitNegativePrompt.filter((e) => e.length > 0).join(negativeSeparator);
        const insertionDepth = chat_metadata[metadataKeys.negative_insertion_depth] ?? 1;
        console.log(insertionDepth)
        splitPrompt.splice(splitPrompt.length - insertionDepth, 0, combinedNegatives);
        console.log(`Setting CFG with guidance scale: ${guidanceScale.value}, negatives: ${combinedNegatives}`);

        return {
            guidanceScale: guidanceScale.value,
            negativePrompt: splitPrompt.join("\n")
        }
    }
}

// If the guidance scale is 1, ignore the CFG negative prompt since it won't be used anyways
function getGuidanceScale(charaCfg) {
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

    return {
        type: cfgType.global,
        value: extension_settings.cfg.global.guidance_scale
    };
}
