import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// --- Configuration ---
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIRS_TO_SCAN = ['public', 'src'];
const FILE_EXTENSIONS = ['.js', '.html'];

// --- IGNORE CONFIGURATION ---
const DIRS_TO_IGNORE = [
    'node_modules', 'dist', 'build', '.git', 'locales',
    // Add any other directories containing third-party libraries
    'lib', 'vendor', 'assets',
];
const FILES_TO_IGNORE_PATTERN = [ /\.min\.js$/ ];
const MIN_KEY_LENGTH = 2;
const MAX_KEY_LENGTH = 512;

const LANG_DIR = path.join(PROJECT_ROOT, 'public/locales');
const BASE_LANG_FILE = 'en.json';

// --- Regular Expressions (IMPROVED) ---
// Now handles both single and double quotes correctly using backreferences (\1, \3)
const REGEX_DATA_I18N = /data-i18n=(['"])(.*?)\1/g;
const REGEX_T_TEMPLATE = /t`([^`]+)`/g;
const REGEX_TRANSLATE = /translate\(\s*(['"])(.*?)\1\s*(?:,\s*(['"])(.*?)\3)?\s*\)/g;


// --- !! NEW: Key validation function to filter out code fragments !! ---
/**
 * Checks if a key is likely a valid translation key and not a code fragment.
 * @param {string} key The key to validate.
 * @returns {boolean} True if the key is valid.
 */
function isValidKey(key) {
    // 1. Basic length check
    if (key.length < MIN_KEY_LENGTH || key.length > MAX_KEY_LENGTH) {
        return false;
    }

    // 2. Reject keys containing common code keywords
    const codeKeywords = ['function', 'const', 'let', 'var', '=>', 'return', 'class', 'import', 'export'];
    if (codeKeywords.some(keyword => key.includes(keyword))) {
        return false;
    }

    // 3. Reject keys with unbalanced brackets/parentheses
    const brackets = { '(': ')', '[': ']', '{': '}' };
    const stack = [];
    for (const char of key) {
        if (brackets[char]) {
            stack.push(char);
        } else if (Object.values(brackets).includes(char)) {
            if (brackets[stack.pop()] !== char) return false; // Mismatched closer
        }
    }
    if (stack.length > 0) return false; // Unclosed opener

    // 4. For en.json, reject keys that contain non-ASCII characters (like Chinese)
    // Adjust this regex if you expect some non-English characters in your keys
    if (/[^\x00-\x7F]/.test(key)) {
        // This regex checks for any character outside the standard ASCII range.
        return false;
    }

    // 5. Reject keys that look like they are just code symbols
    if (/^[,.;:(){}[\]'"`]+$/.test(key.trim())) {
        return false;
    }

    return true;
}

/**
 * Recursively finds all files, respecting the ignore configurations.
 * @param {string} dir The directory path to search.
 * @returns {Promise<string[]>} An array of full file paths.
 */
async function findFiles(dir) {
    if (DIRS_TO_IGNORE.includes(path.basename(dir))) {
        return [];
    }
    let files = [];
    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                files = files.concat(await findFiles(fullPath));
            } else if (FILE_EXTENSIONS.includes(path.extname(entry.name))) {
                if (!FILES_TO_IGNORE_PATTERN.some(pattern => pattern.test(entry.name))) {
                    files.push(fullPath);
                }
            }
        }
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }
    return files;
}

/**
 * Extracts all i18n keys from a single file.
 * @param {string} filePath The path to the file.
 * @returns {Promise<Set<string>>} A Set of extracted raw keys.
 */
async function extractKeysFromFile(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    const keys = new Set();

    const addKey = (key) => {
        const trimmedKey = key.trim();
        // Use the new validation function before adding the key
        if (isValidKey(trimmedKey)) {
            keys.add(trimmedKey);
        }
    };

    for (const match of content.matchAll(REGEX_DATA_I18N)) {
        // For data-i18n="key1;key2", match[2] is the content inside quotes
        match[2].split(';').forEach(key => addKey(key));
    }

    for (const match of content.matchAll(REGEX_T_TEMPLATE)) {
        let i = 0;
        const key = match[1].replace(/\$\{[^}]+\}/g, () => `\${${i++}}`);
        addKey(key);
    }

    for (const match of content.matchAll(REGEX_TRANSLATE)) {
        // match[4] is the optional second argument (the key), match[2] is the first
        const key = match[4] || match[2];
        if (key) {
            addKey(key);
        }
    }

    return keys;
}

/**
 * The main function.
 */
async function main() {
    console.log('🚀 Starting to build the master en.json file...');

    let allFiles = [];
    for (const dir of DIRS_TO_SCAN) {
        allFiles = allFiles.concat(await findFiles(path.join(PROJECT_ROOT, dir)));
    }
    console.log(`🔍 Found ${allFiles.length} files to scan.`);

    let allKeys = new Set();
    for (const file of allFiles) {
        const keysFromFile = await extractKeysFromFile(file);
        keysFromFile.forEach(key => allKeys.add(key));
    }
    console.log(`✅ Extracted ${allKeys.size} unique & valid keys from source code.`);

    const baseLangPath = path.join(LANG_DIR, BASE_LANG_FILE);
    let existingLangData = {};
    try {
        existingLangData = JSON.parse(await fs.readFile(baseLangPath, 'utf-8'));
        console.log(`📘 Loaded existing ${BASE_LANG_FILE} with ${Object.keys(existingLangData).length} keys.`);
    } catch (error) {
        console.warn(`⚠️ Could not read existing ${BASE_LANG_FILE}. A new file will be created.`);
    }

    const newLangData = {};
    const cleanKey = (key) => key.replace(/\[\S+\]/, '');

    for (const rawKey of allKeys) {
        const key = cleanKey(rawKey);
        if (Object.hasOwn(existingLangData, key)) {
            newLangData[key] = existingLangData[key];
        } else {
            newLangData[key] = key;
        }
    }

    const sortedLangData = Object.keys(newLangData)
        .sort((a, b) => a.localeCompare(b))
        .reduce((obj, key) => {
            obj[key] = newLangData[key];
            return obj;
        }, {});

    const newKeyCount = Object.keys(sortedLangData).length - Object.keys(existingLangData).length;

    try {
        await fs.writeFile(baseLangPath, JSON.stringify(sortedLangData, null, 4));
        console.log(`\n💾 Successfully wrote updated ${BASE_LANG_FILE} with ${Object.keys(sortedLangData).length} keys.`);

        if (newKeyCount > 0) {
            console.log(`✨ Added ${newKeyCount} new key(s).`);
        } else if (newKeyCount === 0) {
            console.log('✨ No new keys were added.');
        } else {
            console.log(`✨ Note: ${-newKeyCount} key(s) were removed as they are no longer found in the source code.`);
        }

        console.log('\n🎉 Awesome! Your en.json is now perfectly in sync with the source code!');

    } catch (error) {
        console.error(`❌ Failed to write to ${baseLangPath}`, error);
    }
}

main().catch(console.error);
