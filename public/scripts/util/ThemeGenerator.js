/**
 * @module ThemeGenerator
 * Theme color palette generation from background images using Oklch color space
 * and color theory for complementary/accessible text colors.
 */

// ===== sRGB <-> Linear RGB <-> Oklch conversions =====

/**
 * Converts an sRGB component [0,255] to linear RGB [0,1].
 * @param {number} c sRGB component (0–255)
 * @returns {number} Linear RGB value (0–1)
 */
function srgbToLinear(c) {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Converts a linear RGB component [0,1] to sRGB [0,255].
 * @param {number} c Linear RGB value (0–1)
 * @returns {number} sRGB component (0–255), clamped
 */
function linearToSrgb(c) {
    const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.round(Math.min(255, Math.max(0, v * 255)));
}

/**
 * Converts sRGB {r,g,b} (0–255 each) to Oklch {L, C, h}.
 * @param {number} r Red (0–255)
 * @param {number} g Green (0–255)
 * @param {number} b Blue (0–255)
 * @returns {{L: number, C: number, h: number}} Oklch color (h in radians)
 */
function srgbToOklch(r, g, b) {
    const lr = srgbToLinear(r);
    const lg = srgbToLinear(g);
    const lb = srgbToLinear(b);

    const l_ = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
    const m_ = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
    const s_ = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);

    const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
    const ok_b = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;

    return {
        L: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
        C: Math.sqrt(a * a + ok_b * ok_b),
        h: Math.atan2(ok_b, a),
    };
}

/**
 * Converts Oklch {L, C, h} to sRGB {r, g, b} (0–255 each).
 * @param {number} L Lightness (0–1)
 * @param {number} C Chroma
 * @param {number} h Hue (radians)
 * @returns {{r: number, g: number, b: number}} sRGB color
 */
function oklchToSrgb(L, C, h) {
    const a = C * Math.cos(h);
    const b = C * Math.sin(h);

    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;

    return {
        r: linearToSrgb(+4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
        g: linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
        b: linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s),
    };
}

// ===== Relative luminance & contrast ratio (WCAG) =====

/**
 * Calculates the relative luminance of an sRGB color (WCAG 2.x definition).
 * @param {number} r Red (0–255)
 * @param {number} g Green (0–255)
 * @param {number} b Blue (0–255)
 * @returns {number} Relative luminance (0–1)
 */
function relativeLuminance(r, g, b) {
    return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

/**
 * Calculates WCAG contrast ratio between two colors.
 * @param {{r: number, g: number, b: number}} c1 First color
 * @param {{r: number, g: number, b: number}} c2 Second color
 * @returns {number} Contrast ratio (1–21)
 */
function contrastRatio(c1, c2) {
    const l1 = relativeLuminance(c1.r, c1.g, c1.b);
    const l2 = relativeLuminance(c2.r, c2.g, c2.b);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
}

// ===== Dominant color extraction =====

/**
 * Extracts the dominant vivid color from an image element.
 * Uses chroma-weighted averaging in Oklch space to prefer vivid colors
 * over the muddy averages that simple mean-RGB produces.
 * @param {HTMLImageElement} imgEl Image element to sample
 * @returns {{r: number, g: number, b: number}} Dominant vivid RGB color
 */
export function extractDominantColor(imgEl) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
        return { r: 128, g: 128, b: 128 };
    }

    // Sample at reduced resolution for performance
    const maxDim = 150;
    const scale = Math.min(1, maxDim / Math.max(imgEl.naturalWidth, imgEl.naturalHeight));
    const width = canvas.width = Math.floor(imgEl.naturalWidth * scale);
    const height = canvas.height = Math.floor(imgEl.naturalHeight * scale);
    context.drawImage(imgEl, 0, 0, width, height);

    let data;
    try {
        data = context.getImageData(0, 0, width, height).data;
    } catch {
        return { r: 128, g: 128, b: 128 };
    }

    // Collect pixel samples in Oklch space
    const step = 4; // sample every 4th pixel for speed
    /** @type {{L: number, C: number, h: number}[]} */
    const pixels = [];

    for (let i = 0; i < data.length; i += 4 * step) {
        const pr = data[i], pg = data[i + 1], pb = data[i + 2], alpha = data[i + 3];
        if (alpha < 128) continue; // skip transparent pixels

        const lch = srgbToOklch(pr, pg, pb);
        pixels.push(lch);
    }

    if (pixels.length === 0) {
        return { r: 128, g: 128, b: 128 };
    }

    // Weighted average in Oklch, weighting by chroma^2 to prioritize vivid colors
    // Average hue using circular mean (sin/cos) to handle wraparound
    let totalWeight = 0;
    let wL = 0, wC = 0, wSinH = 0, wCosH = 0;

    for (const px of pixels) {
        // Weight: chroma squared + small base so even gray images produce a result
        const w = px.C * px.C + 0.001;
        totalWeight += w;
        wL += px.L * w;
        wC += px.C * w;
        wSinH += Math.sin(px.h) * w;
        wCosH += Math.cos(px.h) * w;
    }

    wL /= totalWeight;
    wC /= totalWeight;
    const avgH = Math.atan2(wSinH / totalWeight, wCosH / totalWeight);

    // Boost the chroma of the result slightly for a more vivid base color
    const boostedC = Math.min(wC * 1.3, 0.35); // cap so we don't get neon

    return oklchToSrgb(wL, boostedC, avgH);
}

// ===== Theme palette generation =====

/**
 * Adjusts Oklch lightness of a color to ensure sufficient contrast with a reference.
 * @param {number} L Lightness (0–1)
 * @param {number} C Chroma
 * @param {number} h Hue (radians)
 * @param {{r: number, g: number, b: number}} refRgb Reference color in sRGB
 * @param {number} minContrast Minimum contrast ratio required
 * @param {boolean} preferLight Whether to push lighter or darker
 * @returns {{L: number, C: number, h: number}} Adjusted Oklch color
 */
function ensureContrast(L, C, h, refRgb, minContrast, preferLight) {
    const direction = preferLight ? 0.02 : -0.02;

    for (let i = 0; i < 50; i++) {
        const rgb = oklchToSrgb(L, C, h);
        if (contrastRatio(rgb, refRgb) >= minContrast) {
            return { L, C, h };
        }
        L = Math.min(1, Math.max(0, L + direction));
    }

    return { L, C, h };
}

/**
 * Formats an RGB color as an RGBA string.
 * @param {{r: number, g: number, b: number}} rgb RGB color
 * @param {number} [alpha=1] Alpha value
 * @returns {string} RGBA color string
 */
function rgbaString(rgb, alpha = 1) {
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

/**
 * Generates a complete theme color palette from a dominant background color.
 * Uses color theory (complementary, analogous, triadic relationships) in Oklch space
 * with accessibility contrast checking.
 *
 * @param {{r: number, g: number, b: number}} dominantRgb The dominant image color
 * @returns {Partial<Theme>} Theme color properties ready to merge into a theme object
 */
export function generateThemePalette(dominantRgb) {
    const base = srgbToOklch(dominantRgb.r, dominantRgb.g, dominantRgb.b);

    // Determine if the background is dark or light
    const bgLuminance = relativeLuminance(dominantRgb.r, dominantRgb.g, dominantRgb.b);
    const isDark = bgLuminance < 0.3;

    // --- Panel / tint colors (derived from base, with low alpha for transparency) ---
    // Main blur tint: base color, darkened, semi-transparent
    const blurTintL = isDark ? Math.max(base.L * 0.5, 0.08) : Math.min(base.L * 0.35, 0.25);
    const blurTintC = base.C * 0.5;
    const blurTintRgb = oklchToSrgb(blurTintL, blurTintC, base.h);

    const chatTintL = blurTintL * 0.9;
    const chatTintRgb = oklchToSrgb(chatTintL, blurTintC * 0.8, base.h);

    // User/bot message tints: slight hue shifts
    const userHueShift = 0.15; // ~9° shift
    const botHueShift = -0.15;
    const userTintRgb = oklchToSrgb(blurTintL, base.C * 0.4, base.h + userHueShift);
    const botTintRgb = oklchToSrgb(blurTintL, base.C * 0.4, base.h + botHueShift);

    // --- Reference background for contrast checking ---
    // Effective panel background (what the text appears on)
    const panelBg = blurTintRgb;
    const panelLuminance = relativeLuminance(panelBg.r, panelBg.g, panelBg.b);
    const panelIsDark = panelLuminance < 0.3;

    // --- Text colors (ensure ≥ 3.0:1 contrast against panel background) ---
    const minContrast = 3.5;

    // Hue shift angles for color theory relationships (in radians)
    const ANALOGOUS_HUE_SHIFT = Math.PI / 3;         // +60° for analogous colors
    const COMPLEMENTARY_HUE_SHIFT = Math.PI;         // +180° for complementary colors
    const TRIADIC_HUE_SHIFT = (2 * Math.PI / 3);     // +120° for triadic colors

    // Main text: near-white/near-black with a slight hue tint from the base
    const mainTextC = Math.min(base.C * 0.15, 0.03);
    const mainText = ensureContrast(panelIsDark ? 0.85 : 0.2, mainTextC, base.h, panelBg, minContrast, panelIsDark);
    const mainTextRgb = oklchToSrgb(mainText.L, mainText.C, mainText.h);

    // Italics: analogous hue shift (+60°), slightly softer
    const italicsC = Math.min(base.C * 0.5 + 0.02, 0.12);
    const italics = ensureContrast(panelIsDark ? 0.78 : 0.3, italicsC, base.h + ANALOGOUS_HUE_SHIFT, panelBg, minContrast, panelIsDark);
    const italicsRgb = oklchToSrgb(italics.L, italics.C, italics.h);

    // Underline: complementary hue (+180°), medium saturation
    const underlineC = Math.min(base.C * 0.4 + 0.02, 0.10);
    const underline = ensureContrast(panelIsDark ? 0.75 : 0.32, underlineC, base.h + COMPLEMENTARY_HUE_SHIFT, panelBg, minContrast, panelIsDark);
    const underlineRgb = oklchToSrgb(underline.L, underline.C, underline.h);

    // Quotes: triadic hue shift (+120°), more saturated for distinctiveness
    const quoteC = Math.min(base.C * 0.6 + 0.03, 0.14);
    const quote = ensureContrast(panelIsDark ? 0.65 : 0.38, quoteC, base.h + TRIADIC_HUE_SHIFT, panelBg, minContrast, panelIsDark);
    const quoteRgb = oklchToSrgb(quote.L, quote.C, quote.h);

    // --- Shadow & border ---
    const shadowRgb = isDark ? { r: 0, g: 0, b: 0 } : { r: 40, g: 40, b: 40 };
    const borderL = isDark ? Math.max(base.L * 0.3, 0.05) : Math.min(base.L * 1.2, 0.6);
    const borderRgb = oklchToSrgb(borderL, base.C * 0.3, base.h);

    return {
        blur_tint_color: rgbaString(blurTintRgb, 0.95),
        chat_tint_color: rgbaString(chatTintRgb, 0.6),
        user_mes_blur_tint_color: rgbaString(userTintRgb, 0.7),
        bot_mes_blur_tint_color: rgbaString(botTintRgb, 0.7),
        main_text_color: rgbaString(mainTextRgb),
        italics_text_color: rgbaString(italicsRgb),
        underline_text_color: rgbaString(underlineRgb),
        quote_text_color: rgbaString(quoteRgb),
        shadow_color: rgbaString(shadowRgb, isDark ? 0.8 : 0.3),
        shadow_width: isDark ? 2 : 1,
        border_color: rgbaString(borderRgb, 0.7),
        blur_strength: isDark ? 10 : 8,
    };
}

/**
 * Derives a theme name from a background image URL.
 * @param {string} bgUrl The background image URL
 * @returns {string} A cleaned-up name suitable for a theme name
 */
export function deriveBackgroundName(bgUrl) {
    // Extract filename from URL path
    let name = bgUrl.split('/').pop() || 'background';
    // Remove query strings
    name = name.split('?')[0];
    // URL-decode
    try {
        name = decodeURIComponent(name);
    } catch { /* use as-is */ }
    // Remove file extension
    name = name.replace(/\.[^.]+$/, '');
    // Replace underscores/dashes with spaces, trim
    name = name.replace(/[_-]+/g, ' ').trim();
    // Limit length to 32 chars for theme name
    return name.slice(0, 32) || 'Background';
}
