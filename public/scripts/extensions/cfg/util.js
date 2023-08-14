import { chat_metadata, this_chid } from "../../../script.js";
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
    groupchat_individual_chars: "cfg_groupchat_individual_chars"
}

// Gets the CFG value from hierarchy of chat -> character -> global
// Returns undefined values which should be handled in the respective backend APIs
export function getCfg() {
    let splitNegativePrompt = [];
    const charaCfg = extension_settings.cfg.chara?.find((e) => e.name === getCharaFilename(this_chid));
    const guidanceScale = getGuidanceScale(charaCfg);
    const chatNegativeCombine = chat_metadata[metadataKeys.negative_combine] ?? [];

    // If there's a guidance scale, continue. Otherwise assume undefined
    if (guidanceScale?.value && guidanceScale?.value !== 1) {
        if (guidanceScale.type === cfgType.chat || chatNegativeCombine.includes(cfgType.chat)) {
            splitNegativePrompt.push(chat_metadata[metadataKeys.negative_prompt]?.trim());
        }

        if (guidanceScale.type === cfgType.chara || chatNegativeCombine.includes(cfgType.chara)) {
            splitNegativePrompt.push(charaCfg.negative_prompt?.trim())
        }

        if (guidanceScale.type === cfgType.global || chatNegativeCombine.includes(cfgType.global)) {
            splitNegativePrompt.push(extension_settings.cfg.global.negative_prompt?.trim());
        }

        const combinedNegatives = splitNegativePrompt.filter((e) => e.length > 0).join(", ");
        console.debug(`Setting CFG with guidance scale: ${guidanceScale.value}, negatives: ${combinedNegatives}`)

        return {
            guidanceScale: guidanceScale.value,
            negativePrompt: combinedNegatives
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
