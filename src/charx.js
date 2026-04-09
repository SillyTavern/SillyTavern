import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import _ from 'lodash';
import sanitize from 'sanitize-filename';
import { sync as writeFileAtomicSync } from 'write-file-atomic';
import { extractFileFromZipBuffer, extractFilesFromZipBuffer, normalizeZipEntryPath, ensureDirectory } from './util.js';
import { DEFAULT_AVATAR_PATH, MEDIA_EXTENSIONS } from './constants.js';

// 'embeded://' is intentional - RisuAI exports use this misspelling
const CHARX_EMBEDDED_URI_PREFIXES = ['embeded://', 'embedded://', '__asset:'];
const CHARX_IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'apng', 'avif', 'bmp', 'jfif']);
const CHARX_AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'aiff']);
const CHARX_VIDEO_EXTENSIONS = new Set(MEDIA_EXTENSIONS.filter(ext => !CHARX_IMAGE_EXTENSIONS.has(ext) && !CHARX_AUDIO_EXTENSIONS.has(ext)));
const CHARX_JSON_EXTENSIONS = new Set(['json']);
const CHARX_SUPPORTED_EXPORT_EXTENSIONS = new Set([...MEDIA_EXTENSIONS, ...CHARX_JSON_EXTENSIONS]);
const CHARX_SPRITE_TYPES = new Set(['emotion', 'expression']);
const CHARX_BACKGROUND_TYPES = new Set(['background']);
const CHARX_REGEX_AI_OUTPUT = 2;

// ZIP local file header signature: PK\x03\x04
const ZIP_SIGNATURE = Buffer.from([0x50, 0x4B, 0x03, 0x04]);

/**
 * Find ZIP data start in buffer (handles SFX/self-extracting archives).
 * @param {Buffer} buffer
 * @returns {Buffer} Buffer starting at ZIP signature, or original if not found
 */
function findZipStart(buffer) {
    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    const index = buf.indexOf(ZIP_SIGNATURE);
    if (index > 0) {
        return buf.slice(index);
    }
    return buf;
}

/**
 * @typedef {Object} CharXAsset
 * @property {string} type - Asset type (emotion, expression, background, etc.)
 * @property {string} name - Asset name from metadata
 * @property {string} ext - File extension (lowercase, no dot)
 * @property {string} zipPath - Normalized path within the ZIP archive
 * @property {number} order - Original index in assets array
 * @property {string} [storageCategory] - 'sprite' | 'background' | 'image' | 'audio' | 'video' | 'json' (set by mapCharXAssetsForStorage)
 * @property {string} [baseName] - Normalized filename base (set by mapCharXAssetsForStorage)
 */

/**
 * @typedef {Object} CharXParseResult
 * @property {Object} card - Parsed card.json (CCv2 or CCv3 spec)
 * @property {string|Buffer} avatar - Avatar image buffer or DEFAULT_AVATAR_PATH
 * @property {CharXAsset[]} auxiliaryAssets - Assets mapped for storage
 * @property {Map<string, Buffer>} extractedBuffers - Map of zipPath to extracted buffer
 */

export class CharXParser {
    #data;

    /**
     * @param {ArrayBuffer|Buffer} data
     */
    constructor(data) {
        // Handle SFX (self-extracting) ZIP archives by finding the actual ZIP start
        this.#data = findZipStart(Buffer.isBuffer(data) ? data : Buffer.from(data));
    }

    /**
     * Parse the CharX archive and extract card data and assets.
     * @returns {Promise<CharXParseResult>}
     */
    async parse() {
        console.info('Importing from CharX');
        const cardBuffer = await extractFileFromZipBuffer(this.#data, 'card.json');

        if (!cardBuffer) {
            throw new Error('Failed to extract card.json from CharX file');
        }

        const card = JSON.parse(cardBuffer.toString());

        if (card.spec === undefined) {
            throw new Error('Invalid CharX card file: missing spec field');
        }

        const embeddedAssets = this.collectCharXAssets(card);
        const iconAsset = this.pickCharXIconAsset(embeddedAssets);
        const auxiliaryAssets = this.mapCharXAssetsForStorage(embeddedAssets);

        const archivePaths = new Set();

        if (iconAsset?.zipPath) {
            archivePaths.add(iconAsset.zipPath);
        }
        for (const asset of auxiliaryAssets) {
            if (asset?.zipPath) {
                archivePaths.add(asset.zipPath);
            }
        }

        let extractedBuffers = new Map();
        if (archivePaths.size > 0) {
            extractedBuffers = await extractFilesFromZipBuffer(this.#data, [...archivePaths]);
        }

        /** @type {string|Buffer} */
        let avatar = DEFAULT_AVATAR_PATH;
        if (iconAsset?.zipPath) {
            const iconBuffer = extractedBuffers.get(iconAsset.zipPath);
            if (iconBuffer) {
                avatar = iconBuffer;
            }
        }

        return { card, avatar, auxiliaryAssets, extractedBuffers };
    }

    getEmbeddedZipPathFromUri(uri) {
        if (typeof uri !== 'string') {
            return null;
        }

        const trimmed = uri.trim();
        if (!trimmed) {
            return null;
        }

        const lower = trimmed.toLowerCase();
        for (const prefix of CHARX_EMBEDDED_URI_PREFIXES) {
            if (lower.startsWith(prefix)) {
                const rawPath = trimmed.slice(prefix.length);
                return normalizeZipEntryPath(rawPath);
            }
        }

        return null;
    }

    /**
     * Normalize extension string: lowercase, strip leading dot.
     * @param {string} ext
     * @returns {string}
     */
    normalizeExtString(ext) {
        if (typeof ext !== 'string') return '';
        return ext.trim().toLowerCase().replace(/^\./, '');
    }

    /**
     * Strip trailing image extension from asset name if present.
     * Handles cases like "image.png" with ext "png" → "image" (avoids "image.png.png")
     * @param {string} name - Asset name that may contain extension
     * @param {string} expectedExt - The expected extension (lowercase, no dot)
     * @returns {string} Name with trailing extension stripped if it matched
     */
    stripTrailingAssetExtension(name, expectedExt) {
        if (!name || !expectedExt) return name;
        const lower = name.toLowerCase();
        if (lower.endsWith(`.${expectedExt}`)) {
            return name.slice(0, -(expectedExt.length + 1));
        }
        for (const ext of CHARX_SUPPORTED_EXPORT_EXTENSIONS) {
            if (lower.endsWith(`.${ext}`)) {
                return name.slice(0, -(ext.length + 1));
            }
        }
        return name;
    }

    deriveCharXAssetExtension(assetExt, zipPath) {
        const metaExt = this.normalizeExtString(assetExt);
        const pathExt = this.normalizeExtString(path.extname(zipPath || ''));
        return metaExt || pathExt;
    }

    collectCharXAssets(card) {
        const assets = _.get(card, 'data.assets');
        if (!Array.isArray(assets)) {
            return [];
        }

        return assets.map((asset, index) => {
            if (!asset) {
                return null;
            }

            const zipPath = this.getEmbeddedZipPathFromUri(asset.uri);
            if (!zipPath) {
                return null;
            }

            const ext = this.deriveCharXAssetExtension(asset.ext, zipPath);
            const type = typeof asset.type === 'string' ? asset.type.toLowerCase() : '';
            const name = typeof asset.name === 'string' ? asset.name : '';

            return {
                type,
                name,
                ext,
                zipPath,
                order: index,
            };
        }).filter(Boolean);
    }

    pickCharXIconAsset(assets) {
        const iconAssets = assets.filter(asset => asset.type === 'icon' && CHARX_IMAGE_EXTENSIONS.has(asset.ext) && asset.zipPath);
        if (iconAssets.length === 0) {
            return null;
        }

        const mainIcon = iconAssets.find(asset => asset.name?.toLowerCase() === 'main');
        return mainIcon || iconAssets[0];
    }

    /**
     * Normalize asset name for filesystem storage.
     * @param {string} name - Original asset name
     * @param {string} fallback - Fallback name if normalization fails
     * @param {boolean} useHyphens - Use hyphens instead of underscores (for sprites)
     * @returns {string} Normalized filename base (without extension)
     */
    getCharXAssetBaseName(name, fallback, useHyphens = false) {
        const cleaned = (String(name ?? '').trim() || '');
        if (!cleaned) {
            return fallback.toLowerCase();
        }

        const separator = useHyphens ? '-' : '_';
        // Convert to lowercase, collapse non-alphanumeric runs to separator, trim edges
        const base = cleaned
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, separator)
            .replace(new RegExp(`^${separator}|${separator}$`, 'g'), '');

        if (!base) {
            return fallback.toLowerCase();
        }

        const sanitized = sanitize(base);
        return (sanitized || fallback).toLowerCase();
    }

    /**
     * Preserve the original creator-provided asset filename for non-sprite assets.
     * @param {string} name - Original asset name
     * @param {string} zipPath - Asset zip path
     * @param {string} fallback - Fallback name if preservation fails
     * @returns {string} Preserved filename base (without extension)
     */
    getCharXPreservedAssetBaseName(name, zipPath, fallback) {
        const nameWithoutExt = this.stripTrailingAssetExtension(name, this.normalizeExtString(path.extname(zipPath || '')));
        const sanitizedName = sanitize(String(nameWithoutExt ?? '').trim());
        if (sanitizedName) {
            return sanitizedName;
        }

        const zipBaseName = sanitize(path.parse(zipPath || '').name);
        return zipBaseName || fallback;
    }

    mapCharXAssetsForStorage(assets) {
        return assets.reduce((acc, asset) => {
            if (!asset?.zipPath) {
                return acc;
            }

            const ext = (asset.ext || '').toLowerCase();
            if (!CHARX_SUPPORTED_EXPORT_EXTENSIONS.has(ext)) {
                return acc;
            }

            if (asset.type === 'icon' || asset.type === 'user_icon') {
                return acc;
            }

            let storageCategory;
            if (CHARX_SPRITE_TYPES.has(asset.type) && CHARX_IMAGE_EXTENSIONS.has(ext)) {
                storageCategory = 'sprite';
            } else if (CHARX_BACKGROUND_TYPES.has(asset.type) && (CHARX_IMAGE_EXTENSIONS.has(ext) || CHARX_VIDEO_EXTENSIONS.has(ext))) {
                storageCategory = 'background';
            } else if (CHARX_IMAGE_EXTENSIONS.has(ext)) {
                storageCategory = 'image';
            } else if (CHARX_AUDIO_EXTENSIONS.has(ext)) {
                storageCategory = 'audio';
            } else if (CHARX_VIDEO_EXTENSIONS.has(ext)) {
                storageCategory = 'video';
            } else {
                storageCategory = 'json';
            }

            acc.push({
                ...asset,
                ext,
                storageCategory,
                baseName: storageCategory === 'sprite'
                    ? this.getCharXAssetBaseName(
                        this.stripTrailingAssetExtension(asset.name, ext),
                        `${storageCategory}-${asset.order ?? 0}`,
                        true,
                    )
                    : this.getCharXPreservedAssetBaseName(asset.name, asset.zipPath, `${storageCategory}-${asset.order ?? 0}`),
            });

            return acc;
        }, []);
    }
}

/**
 * Delete existing file with same base name (any extension) before overwriting.
 * Matches ST's sprite upload behavior in sprites.js.
 * @param {string} dirPath - Directory path
 * @param {string} baseName - Base filename without extension
 */
function deleteExistingByBaseName(dirPath, baseName) {
    try {
        const files = fs.readdirSync(dirPath, { withFileTypes: true }).filter(f => f.isFile()).map(f => f.name);
        for (const file of files) {
            if (path.parse(file).name === baseName) {
                fs.unlinkSync(path.join(dirPath, file));
            }
        }
    } catch {
        // Directory doesn't exist yet or other error, that's fine
    }
}

/**
 * Persist extracted CharX assets to appropriate ST directories.
 * Note: Uses sync writes consistent with ST's existing file handling.
 * @param {Array} assets - Mapped assets from CharXParser
 * @param {Map<string, Buffer>} bufferMap - Extracted file buffers
 * @param {Object} directories - User directories object
 * @param {string} characterFolder - Character folder name (sanitized)
 * @returns {{sprites: number, backgrounds: number, misc: number}}
 */
export function persistCharXAssets(assets, bufferMap, directories, characterFolder) {
    /** @type {{sprites: number, backgrounds: number, misc: number}} */
    const summary = { sprites: 0, backgrounds: 0, misc: 0 };
    if (!Array.isArray(assets) || assets.length === 0) {
        return summary;
    }

    let spritesPath = null;
    /** @type {Record<string, string>} */
    const assetPaths = {};

    const ensureSpritesPath = () => {
        if (spritesPath) {
            return spritesPath;
        }
        const candidate = path.join(directories.characters, characterFolder);
        if (!ensureDirectory(candidate)) {
            return null;
        }
        spritesPath = candidate;
        return spritesPath;
    };

    const ensureCharacterAssetPath = (folderName) => {
        if (assetPaths[folderName]) {
            return assetPaths[folderName];
        }
        const candidate = path.join(directories.characters, characterFolder, folderName);
        if (!ensureDirectory(candidate)) {
            return null;
        }
        assetPaths[folderName] = candidate;
        return assetPaths[folderName];
    };

    for (const asset of assets) {
        if (!asset?.zipPath) {
            continue;
        }
        const buffer = bufferMap.get(asset.zipPath);
        if (!buffer) {
            console.warn(`CharX: Asset ${asset.zipPath} missing or unsupported, skipping.`);
            continue;
        }

        try {
            if (asset.storageCategory === 'sprite') {
                const targetDir = ensureSpritesPath();
                if (!targetDir) {
                    continue;
                }
                // Delete existing sprite with same base name (any extension) - matches sprites.js behavior
                deleteExistingByBaseName(targetDir, asset.baseName);
                const filePath = path.join(targetDir, `${asset.baseName}.${asset.ext || 'png'}`);
                writeFileAtomicSync(filePath, buffer);
                summary.sprites += 1;
                continue;
            }

            if (asset.storageCategory === 'background') {
                const backgroundDir = ensureCharacterAssetPath('backgrounds');
                if (!backgroundDir) {
                    continue;
                }
                deleteExistingByBaseName(backgroundDir, asset.baseName);
                const fileName = `${asset.baseName}.${asset.ext || 'png'}`;
                const filePath = path.join(backgroundDir, fileName);
                writeFileAtomicSync(filePath, buffer);
                summary.backgrounds += 1;
                continue;
            }

            if (asset.storageCategory === 'image' || asset.storageCategory === 'audio' || asset.storageCategory === 'video' || asset.storageCategory === 'json') {
                const folderName = asset.storageCategory === 'image' ? 'images' : `${asset.storageCategory}`;
                const targetDir = ensureCharacterAssetPath(folderName);
                if (!targetDir) {
                    continue;
                }
                const filePath = path.join(targetDir, `${asset.baseName}.${asset.ext || 'png'}`);
                writeFileAtomicSync(filePath, buffer);
                summary.misc += 1;
            }
        } catch (error) {
            console.warn(`CharX: Failed to save asset "${asset.name}": ${error.message}`);
        }
    }

    return summary;
}

/**
 * @typedef {Object} CharXMediaConfig
 * @property {number} [version]
 * @property {boolean} [generateRegex]
 * @property {Array<{sourcePath: string, exportName?: string, enabled?: boolean}>} [items]
 */

/**
 * @typedef {Object} CharXExportAsset
 * @property {string} sourcePath
 * @property {string} fullPath
 * @property {'sprite' | 'background' | 'image' | 'audio' | 'video' | 'json'} category
 * @property {string} exportName
 * @property {string} ext
 * @property {string} archivePath
 * @property {'emotion' | 'background' | 'other'} assetType
 */

function toPosixPath(filePath) {
    return String(filePath || '').split(path.sep).join(path.posix.sep);
}

function listSupportedFiles(directoryPath, allowedExtensions) {
    if (!fs.existsSync(directoryPath) || !fs.statSync(directoryPath).isDirectory()) {
        return [];
    }

    return fs.readdirSync(directoryPath, { withFileTypes: true })
        .filter(dirent => dirent.isFile())
        .map(dirent => dirent.name)
        .filter(fileName => allowedExtensions.has(path.extname(fileName).slice(1).toLowerCase()))
        .sort(Intl.Collator().compare);
}

function getCharXArchiveDirectory(category, ext) {
    switch (category) {
        case 'sprite':
            return 'assets/emotion/images';
        case 'background':
            return CHARX_VIDEO_EXTENSIONS.has(ext) ? 'assets/background/video' : 'assets/background/images';
        case 'image':
            return 'assets/other/images';
        case 'audio':
            return 'assets/other/audio';
        case 'video':
            return 'assets/other/video';
        case 'json':
        default:
            return 'assets/other/other';
    }
}

function getCharXAssetType(category) {
    switch (category) {
        case 'sprite':
            return 'emotion';
        case 'background':
            return 'background';
        default:
            return 'other';
    }
}

function normalizeCharXExportName(exportName, originalFileName) {
    const originalExt = path.extname(originalFileName);
    const originalBaseName = path.basename(originalFileName, originalExt);
    const sanitizedInput = sanitize(String(exportName ?? '').trim());
    const candidateName = sanitizedInput || sanitize(originalFileName) || originalFileName;
    const candidateBaseName = sanitize(path.basename(candidateName, path.extname(candidateName))) || originalBaseName;
    return `${candidateBaseName}${originalExt}`;
}

function getCharXMediaConfigItems(mediaConfig) {
    if (!Array.isArray(mediaConfig?.items)) {
        return new Map();
    }

    return new Map(
        mediaConfig.items
            .filter(item => typeof item?.sourcePath === 'string' && item.sourcePath.length > 0)
            .map(item => [toPosixPath(item.sourcePath), item]),
    );
}

function discoverCharXExportCandidates(directories, characterFolder) {
    const safeCharacterFolder = sanitize(characterFolder);
    if (!safeCharacterFolder) {
        return [];
    }

    /** @type {Array<{sourcePath: string, fullPath: string, category: CharXExportAsset['category'], originalFileName: string, ext: string}>} */
    const discovered = [];
    const pushDiscovered = (category, directoryPath, relativeDirectory, allowedExtensions) => {
        const files = listSupportedFiles(directoryPath, allowedExtensions);
        for (const fileName of files) {
            const fullPath = path.join(directoryPath, fileName);
            const sourcePath = path.posix.join(relativeDirectory, fileName);
            discovered.push({
                sourcePath,
                fullPath,
                category,
                originalFileName: fileName,
                ext: path.extname(fileName).slice(1).toLowerCase(),
            });
        }
    };

    pushDiscovered(
        'sprite',
        path.join(directories.characters, safeCharacterFolder),
        path.posix.join('characters', safeCharacterFolder),
        CHARX_IMAGE_EXTENSIONS,
    );
    pushDiscovered(
        'background',
        path.join(directories.characters, safeCharacterFolder, 'backgrounds'),
        path.posix.join('characters', safeCharacterFolder, 'backgrounds'),
        new Set([...CHARX_IMAGE_EXTENSIONS, ...CHARX_VIDEO_EXTENSIONS]),
    );
    pushDiscovered(
        'image',
        path.join(directories.characters, safeCharacterFolder, 'images'),
        path.posix.join('characters', safeCharacterFolder, 'images'),
        CHARX_IMAGE_EXTENSIONS,
    );
    pushDiscovered(
        'audio',
        path.join(directories.characters, safeCharacterFolder, 'audio'),
        path.posix.join('characters', safeCharacterFolder, 'audio'),
        CHARX_AUDIO_EXTENSIONS,
    );
    pushDiscovered(
        'video',
        path.join(directories.characters, safeCharacterFolder, 'video'),
        path.posix.join('characters', safeCharacterFolder, 'video'),
        CHARX_VIDEO_EXTENSIONS,
    );
    pushDiscovered(
        'json',
        path.join(directories.characters, safeCharacterFolder, 'json'),
        path.posix.join('characters', safeCharacterFolder, 'json'),
        CHARX_JSON_EXTENSIONS,
    );

    return discovered;
}

/**
 * Collects character-owned media files to embed in a CharX export.
 * @param {import('./users.js').UserDirectoryList} directories
 * @param {string} characterFolder
 * @param {CharXMediaConfig | null | undefined} mediaConfig
 * @returns {CharXExportAsset[]}
 */
export function collectCharXExportAssets(directories, characterFolder, mediaConfig) {
    const discovered = discoverCharXExportCandidates(directories, characterFolder);
    const mediaItems = getCharXMediaConfigItems(mediaConfig);
    /** @type {CharXExportAsset[]} */
    const assets = [];
    const seenArchivePaths = new Map();

    for (const item of discovered) {
        const override = mediaItems.get(toPosixPath(item.sourcePath));
        if (override?.enabled === false) {
            continue;
        }

        const exportName = normalizeCharXExportName(override?.exportName, item.originalFileName);
        const archivePath = path.posix.join(getCharXArchiveDirectory(item.category, item.ext), exportName);
        if (seenArchivePaths.has(archivePath)) {
            const previousSource = seenArchivePaths.get(archivePath);
            throw new Error(`Duplicate CharX archive path "${archivePath}" from "${previousSource}" and "${item.sourcePath}"`);
        }

        seenArchivePaths.set(archivePath, item.sourcePath);
        assets.push({
            sourcePath: item.sourcePath,
            fullPath: item.fullPath,
            category: item.category,
            exportName,
            ext: item.ext,
            archivePath,
            assetType: getCharXAssetType(item.category),
        });
    }

    return assets;
}

function escapeRegexLiteral(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildCharXRegexReplacementPath(characterFolder, category, exportName) {
    const encodedCharacterFolder = encodeURIComponent(characterFolder);
    const encodedCategory = encodeURIComponent(category === 'image' ? 'images' : category);
    const encodedFileName = encodeURIComponent(exportName);
    return `/characters/${encodedCharacterFolder}/${encodedCategory}/${encodedFileName}`;
}

function buildCharXRegexScripts(characterFolder, assets) {
    return assets
        .filter(asset => ['image', 'audio', 'video'].includes(asset.category))
        .map(asset => ({
            id: crypto.randomUUID(),
            scriptName: `CharX media: ${asset.exportName}`,
            findRegex: `(?<![/\\\\\\w])${escapeRegexLiteral(asset.exportName)}(?![/\\\\\\w])`,
            replaceString: buildCharXRegexReplacementPath(characterFolder, asset.category, asset.exportName),
            trimStrings: [],
            placement: [CHARX_REGEX_AI_OUTPUT],
            disabled: false,
            markdownOnly: true,
            promptOnly: false,
            runOnEdit: false,
            substituteRegex: 0,
            minDepth: null,
            maxDepth: null,
        }));
}

/**
 * Builds a CharX card manifest from the character card JSON and collected export assets.
 * @param {object} card
 * @param {string} characterFolder
 * @param {string} avatarArchivePath
 * @param {string} avatarExt
 * @param {CharXExportAsset[]} assets
 * @param {CharXMediaConfig | null | undefined} mediaConfig
 * @returns {object}
 */
export function buildCharXCard(card, characterFolder, avatarArchivePath, avatarExt, assets, mediaConfig) {
    const charxCard = _.cloneDeep(card);
    charxCard.spec = 'chara_card_v3';
    charxCard.spec_version = '3.0';

    const assetEntries = [{
        type: 'icon',
        name: 'main',
        ext: avatarExt,
        uri: `embeded://${avatarArchivePath}`,
    }, ...assets.map(asset => ({
        type: asset.assetType,
        name: asset.exportName,
        ext: asset.ext,
        uri: `embeded://${asset.archivePath}`,
    }))];

    _.set(charxCard, 'data.assets', assetEntries);

    if (mediaConfig?.generateRegex === false) {
        return charxCard;
    }

    const existingScripts = Array.isArray(_.get(charxCard, 'data.extensions.regex_scripts'))
        ? _.get(charxCard, 'data.extensions.regex_scripts').filter(script => !String(script?.scriptName || '').startsWith('CharX media: '))
        : [];
    const generatedScripts = buildCharXRegexScripts(characterFolder, assets);

    _.set(charxCard, 'data.extensions.regex_scripts', [...existingScripts, ...generatedScripts]);

    return charxCard;
}
