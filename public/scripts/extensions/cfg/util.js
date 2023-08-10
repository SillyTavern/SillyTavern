import { extension_settings } from "../../extensions.js"
import { getCharaFilename } from "../../utils.js";

// TODO: Update to use per-chat and per-character CFG
export function getCfg() {
    const charaCfg = extension_settings.cfg.chara.find((e) => e.name === getCharaFilename());
    if (charaCfg && charaCfg?.useChara) {
        return {
            guidanceScale: charaCfg.guidance_scale ?? 1.00,
            negativePrompt: charaCfg.negative_prompt ?? ''
        }
    } else {
        return { 
            guidanceScale: extension_settings.cfg.global.guidance_scale ?? 1.00,
            negativePrompt: extension_settings.cfg.global.negative_prompt ?? ''
        }
    }
}
