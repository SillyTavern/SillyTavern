import { chat_metadata } from "../../../script.js";
import { extension_settings } from "../../extensions.js"
import { getCharaFilename } from "../../utils.js";

export const cfgType = {
    chat: 0,
    chara: 1,
    global: 2
}
export const metadataKeys = {
    guidance_scale: "cfg_guidance_scale",
    negative_prompt: "cfg_negative_prompt",
    negative_combine: "cfg_negative_combine"
}

// TODO: Add groupchat support and fetch the CFG values for the current character

// Gets the CFG value from hierarchy of chat -> character -> global
// Returns undefined values which should be handled in the respective backend APIs
export function getCfg() {
    let splitNegativePrompt = [];
    const charaCfg = extension_settings.cfg.chara?.find((e) => e.name === getCharaFilename());
    const guidanceScale = getGuidanceScale(charaCfg);
    const chatNegativeCombine = chat_metadata[metadataKeys.negative_combine];

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

        return {
            guidanceScale: guidanceScale.value,
            negativePrompt: splitNegativePrompt.filter((e) => e.length > 0).join(", ")
        }
    }
}

// If the guidance scale is 1, ignore the CFG negative prompt since it won't be used anyways
function getGuidanceScale(charaCfg) {
    const chatGuidanceScale = chat_metadata[metadataKeys.guidance_scale];
    if (chatGuidanceScale && chatGuidanceScale !== 1) {
        return {
            type: cfgType.chat,
            value: chatGuidanceScale
        };
    }

    if (charaCfg && charaCfg.guidance_scale !== 1) {
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
