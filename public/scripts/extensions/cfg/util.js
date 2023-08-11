import { chat_metadata } from "../../../script.js";
import { extension_settings } from "../../extensions.js"
import { getCharaFilename } from "../../utils.js";

// Gets the CFG value from hierarchy of chat -> character -> global
// Returns undefined values which should be handled in the respective backend APIs
// If the guidance scale is 1, ignore the CFG negative prompt since it won't be used anyways

// TODO: Add the ability to combine negative prompts if specified. Proposed, chat + global and chat + chara
// TODO: Add groupchat support and fetch the CFG values for the current character
export function getCfg() {
    if (chat_metadata['guidance_scale'] !== 1) {
        return {
            guidanceScale: chat_metadata['guidance_scale'],
            negativePrompt: chat_metadata['negative_prompt']
        }
    }

    const charaCfg = extension_settings.cfg.chara.find((e) => e.name === getCharaFilename());
    if (charaCfg && charaCfg?.useChara) {
        if (charaCfg.guidance_scale !== 1) {
            return {
                guidanceScale: charaCfg.guidance_scale,
                negativePrompt: charaCfg.negative_prompt
            }
        }
    } else if (extension_settings.cfg.global?.guidance_scale !== 1) {
        return {
            guidanceScale: extension_settings.cfg.global.guidance_scale,
            negativePrompt: extension_settings.cfg.global.negative_prompt
        }
    }
}
