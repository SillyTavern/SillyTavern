const path = require('path');
const fs = require('fs');
const { DIRECTORIES } = require('./constants');

function readWorldInfoFile(worldInfoName) {
    const dummyObject = { entries: {} };

    if (!worldInfoName) {
        return dummyObject;
    }

    const filename = `${worldInfoName}.json`;
    const pathToWorldInfo = path.join(DIRECTORIES.worlds, filename);

    if (!fs.existsSync(pathToWorldInfo)) {
        console.log(`World info file ${filename} doesn't exist.`);
        return dummyObject;
    }

    const worldInfoText = fs.readFileSync(pathToWorldInfo, 'utf8');
    const worldInfo = JSON.parse(worldInfoText);
    return worldInfo;
}

/**
 * @param {string} name Name of World Info file
 * @param {object} entries Entries object
 */
function convertWorldInfoToCharacterBook(name, entries) {
    /** @type {{ entries: object[]; name: string }} */
    const result = { entries: [], name };

    for (const index in entries) {
        const entry = entries[index];

        const originalEntry = {
            id: entry.uid,
            keys: entry.key,
            secondary_keys: entry.keysecondary,
            comment: entry.comment,
            content: entry.content,
            constant: entry.constant,
            selective: entry.selective,
            insertion_order: entry.order,
            enabled: !entry.disable,
            position: entry.position == 0 ? 'before_char' : 'after_char',
            extensions: {
                position: entry.position,
                exclude_recursion: entry.excludeRecursion,
                display_index: entry.displayIndex,
                probability: entry.probability ?? null,
                useProbability: entry.useProbability ?? false,
                depth: entry.depth ?? 4,
                selectiveLogic: entry.selectiveLogic ?? 0,
                group: entry.group ?? '',
            },
        };

        result.entries.push(originalEntry);
    }

    return result;
}

module.exports = {
    readWorldInfoFile,
    convertWorldInfoToCharacterBook,
};
