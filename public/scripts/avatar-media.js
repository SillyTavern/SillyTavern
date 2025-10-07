// Avatar media resolution & DOM upgrade utilities extracted from script.js (90%+ new PR code)
// This module is intentionally decoupled from direct imports of script.js to avoid circular deps.
// Consumers MUST call configureAvatarMedia() once after defining getThumbnailUrl, characters, etc.

// Lightweight provider pattern so we always read latest runtime state
let providers = {
    getThumbnailUrl: /** @type {(type:string,file:string,t?:boolean)=>string} */(() => { throw new Error('getThumbnailUrl provider not set'); }),
    getCharacters: /** @type {()=>any[]} */(() => []),
    getCurrentChid: /** @type {()=>string|undefined} */(() => undefined),
    getDefaultAvatar: /** @type {()=>string} */(() => 'img/ai4.png'),
};

/**
 * Configure dynamic providers used by avatar media helpers.
 * @param {Object} opts
 * @param {(type:string,file:string,t?:boolean)=>string} opts.getThumbnailUrl
 * @param {()=>any[]} opts.getCharacters
 * @param {()=>string|undefined} opts.getCurrentChid
 * @param {()=>string} opts.getDefaultAvatar
 */
export function configureAvatarMedia(opts) {
    providers = { ...providers, ...opts };
}

const AVATAR_VIDEO_EXTS = ['webm', 'mp4', 'ogg'];
const AVATAR_ANIMATED_IMAGE_EXTS = ['webp'];
const avatarProbeCache = new Map();

export function getAvatarMedia(character) {
    const default_avatar = providers.getDefaultAvatar();
    if (typeof character === 'string') {
        return { kind: 'image', url: providers.getThumbnailUrl('avatar', character) };
    }
    const vid = character?.data?.extensions?.video_avatar;
    if (vid && typeof vid === 'string') {
        const ext = (vid.split('.').pop() || '').toLowerCase();
        const url = `/characters/${encodeURIComponent(vid)}`;
        if (ext === 'webp') return { kind: 'image', url, animated: true };
        return { kind: 'video', url, ext };
    }
    if (character?.avatar) {
        return { kind: 'image', url: providers.getThumbnailUrl('avatar', character.avatar) };
    }
    return { kind: 'image', url: default_avatar };
}

function normalizeCharactersUrl(url) {
    return url ? url.replace(/(\/characters\/){2,}/g, '/characters/') : url;
}

function resolveCharacterAvatar(character) {
    const default_avatar = providers.getDefaultAvatar();
    const base = getAvatarMedia(character) || {};
    const result = {
        kind: base.kind || 'image',
        url: base.url || default_avatar,
        staticUrl: undefined,
        ext: '',
        tag: 'img',
        animated: !!base.animated,
        needsProbe: false,
        alt: (typeof character === 'object' ? character?.name : '') || 'avatar',
    };
    result.ext = (result.url.split('.').pop() || '').toLowerCase();
    result.tag = (result.kind === 'video' && AVATAR_VIDEO_EXTS.includes(result.ext)) ? 'video' : 'img';
    if (typeof character === 'object' && character?.avatar && character.avatar !== 'none') {
        result.staticUrl = providers.getThumbnailUrl('avatar', character.avatar);
    } else {
        result.staticUrl = default_avatar;
    }
    result.animated = AVATAR_ANIMATED_IMAGE_EXTS.includes(result.ext) || result.tag === 'video';
    if (typeof character === 'object' && !character?.data?.extensions?.video_avatar) {
        const av = character?.avatar || '';
        result.needsProbe = /(\.png|\.jpe?g)$/i.test(av);
    }
    return result;
}

function applyAvatarMedia(container, character, { allowVideo = true } = {}) {
    if (!container) return null;
    const $wrapper = (globalThis.jQuery && container instanceof jQuery) ? container : window.jQuery ? jQuery(container) : null;
    if (!$wrapper) return null;
    const media = resolveCharacterAvatar(character);
    let el = $wrapper.find('img,video').first();
    const desiredTag = (media.tag === 'video' && allowVideo) ? 'video' : 'img';
    if (!el.length || String(el.prop('tagName')).toLowerCase() !== desiredTag) {
        const newEl = window.jQuery(document.createElement(desiredTag));
        if (el.length) {
            el.replaceWith(newEl);
        } else {
            $wrapper.append(newEl);
        }
        el = newEl;
    }
    const domEl = el.get(0);
    const chosenUrl = normalizeCharactersUrl((desiredTag === 'video' && allowVideo) ? media.url : (media.tag === 'video' ? media.staticUrl : media.url));
    if (domEl.getAttribute('src') !== chosenUrl) {
        domEl.setAttribute('src', chosenUrl);
    }
    domEl.setAttribute('alt', media.alt);
    el.toggleClass('avatar-video', desiredTag === 'video');
    el.toggleClass('avatar-animated', media.animated && desiredTag === 'img');
    el.attr({
        'data-avatar-kind': media.kind,
        'data-avatar-src': chosenUrl,
        'data-avatar-animated': String(media.animated),
    });
    if (desiredTag === 'video') {
        domEl.muted = true; domEl.autoplay = true; domEl.loop = true; domEl.playsInline = true; domEl.setAttribute('preload', 'metadata');
    }
    if (desiredTag === 'img' && media.animated && media.staticUrl && media.staticUrl !== chosenUrl) {
        domEl.onerror = () => {
            if (domEl.getAttribute('src') !== media.staticUrl) {
                domEl.setAttribute('src', media.staticUrl);
                el.removeClass('avatar-animated');
            }
        };
    }
    return domEl;
}

function maybeProbeForAnimatedWebp(character, container) {
    const characters = providers.getCharacters();
    const this_chid = providers.getCurrentChid();
    if (!character || typeof character !== 'object') return;
    if (character?.data?.extensions?.video_avatar) return;
    const avatar = character.avatar;
    if (!/(\.png|\.jpe?g)$/i.test(String(avatar))) return;
    const base = String(avatar).replace(/\.[^.]+$/, '');
    if (avatarProbeCache.has(base)) return;
    const candidate = `${base}.webp`;
    const candidateUrl = normalizeCharactersUrl(`/characters/${encodeURIComponent(candidate)}`);
    avatarProbeCache.set(base, false);
    const probeImg = new Image();
    probeImg.onload = () => {
        avatarProbeCache.set(base, true);
        const fakeCharacter = { ...character, data: { ...(character.data || {}), extensions: { ...(character.data?.extensions || {}), video_avatar: candidate } } };
        applyAvatarMedia(container, fakeCharacter, {});
        if (String(this_chid) === String(characters.indexOf(character))) {
            const preview = document.getElementById('avatar_load_preview');
            if (preview && !/\.webp(\?|$)/i.test(preview.getAttribute('src') || '')) {
                preview.setAttribute('src', candidateUrl);
            }
        }
    };
    probeImg.onerror = () => { avatarProbeCache.set(base, false); };
    probeImg.src = candidateUrl;
}

export function resolveAndApplyAvatar(character, container, { allowVideo = true } = {}) {
    applyAvatarMedia(container, character, { allowVideo });
    maybeProbeForAnimatedWebp(character, container);
}

export function initChatAvatarObserver() {
    try {
        const characters = providers.getCharacters();
        const chatEl = document.getElementById('chat');
        if (!chatEl) return;
        if (chatEl.__avatarObserver) return;
        const pending = new Set();
        const flush = (globalThis.debounce ? globalThis.debounce(() => {
            for (const el of Array.from(pending)) {
                try {
                    const mes = el.closest('.mes');
                    const chName = mes && mes.getAttribute && mes.getAttribute('ch_name');
                    if (!chName) continue;
                    const ch = Array.isArray(characters) ? characters.find(c => c && c.name === chName) : null;
                    if (ch) resolveAndApplyAvatar(ch, el);
                } catch (e) { console.warn('[initChatAvatarObserver flush] item upgrade failed', e); }
            }
            pending.clear();
        }, 30) : () => {});
        const obs = new MutationObserver(mutations => {
            for (const m of mutations) {
                for (const n of Array.from(m.addedNodes || [])) {
                    if (!(n instanceof HTMLElement)) continue;
                    if (n.matches && n.matches('.mesAvatarWrapper .avatar')) {
                        pending.add(n);
                    } else if (n.querySelectorAll) {
                        n.querySelectorAll('.mesAvatarWrapper .avatar').forEach(a => pending.add(a));
                    }
                }
            }
            if (pending.size && flush) flush();
        });
        obs.observe(chatEl, { childList: true, subtree: true });
        chatEl.__avatarObserver = obs;
    } catch (e) { console.warn('[initChatAvatarObserver] failed to initialize', e); }
}

export function upgradeChatAvatars() {
    const characters = providers.getCharacters();
    if (!Array.isArray(characters) || !characters.length) return;
    const wrappers = document.querySelectorAll('.mes[is_user="false"] .mesAvatarWrapper .avatar');
    wrappers.forEach(w => {
        try {
            const mes = w.closest('.mes');
            const chName = mes && mes.getAttribute('ch_name');
            if (!chName) return;
            const character = characters.find(c => c?.name === chName);
            if (!character) return;
            resolveAndApplyAvatar(character, w);
        } catch (e) { console.warn('[upgradeChatAvatars] wrapper exception', e); }
    });
}

export function fixZoomAvatarPanels() {
    try {
        document.querySelectorAll('.zoomed_avatar').forEach(panel => {
            try {
                const img = panel.querySelector('.zoomed_avatar_img');
                if (img) {
                    const src = img.getAttribute('src') || '';
                    const finalSrc = normalizeCharactersUrl(src);
                    if (finalSrc !== src) {
                        img.setAttribute('src', finalSrc); img.setAttribute('data-animated-src', finalSrc);
                    }
                }
                const forChar = panel.getAttribute('forchar');
                if (forChar) {
                    const fixed = normalizeCharactersUrl(forChar);
                    if (fixed !== forChar) panel.setAttribute('forchar', fixed);
                }
            } catch (e) { console.warn('[fixZoomAvatarPanels] panel exception', e); }
        });
    } catch (e) { console.warn('[fixZoomAvatarPanels] exception', e); }
}

export function refreshCharacterAvatarInDom(chIndex) {
    const characters = providers.getCharacters();
    const this_chid = providers.getCurrentChid();
    const c = characters?.[chIndex];
    if (!c) return;
    const wrapper = document.querySelector(`.avatar[data-chid="${chIndex}"]`);
    if (!wrapper) return;
    resolveAndApplyAvatar(c, wrapper);
    if (String(this_chid) === String(chIndex)) {
        const preview = document.getElementById('avatar_load_preview');
        if (preview) { resolveAndApplyAvatar(c, window.jQuery ? window.jQuery(preview).parent() : preview.parentElement, { allowVideo: false }); }
    }
}

// Backwards compatibility globals for legacy scripts (removed later)
if (typeof window !== 'undefined') {
    // @ts-ignore
    window.resolveAndApplyAvatar = resolveAndApplyAvatar;
    // @ts-ignore
    window.normalizeCharactersUrl = normalizeCharactersUrl;
}
