import { extension_settings } from "../../extensions.js"

// TODO: Update to use per-chat and per-character CFG
export function getCfg() {
    return { 
        guidanceScale: extension_settings.cfg.global.guidance_scale,
        negativePrompt: extension_settings.cfg.global.negative_prompt
    }
}