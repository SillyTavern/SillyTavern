/**
 * @todo One shot collection of all stats for all characters
 * @todo Endpoint for getting stats for a single character
 * @todo Endpoint for writing stats on update
 * @todo Frontend for viewing stats
 * @todo Frontend for viewing stats for a single character
 * @todo Frontend for viewing stats for all characters
 */

const fs = require('fs');
const path = require('path');
const util = require('util');
const writeFile = util.promisify(fs.writeFile);
const readFile = util.promisify(fs.readFile);
const readdir = util.promisify(fs.readdir);
const crypto = require('crypto');



let charStats = {};
let lastSaveTimestamp = 0;
const statsFilePath = 'public/stats.json';


async function collectAndCreateStats(chatsPath, charactersPath) {
    console.log('Collecting and creating stats...');
    const files = await readdir(charactersPath);

    const pngFiles = files.filter(file => file.endsWith('.png'));

    let processingPromises = pngFiles.map((file, index) => calculateStats(chatsPath, file, index));
    const statsArr = await Promise.all(processingPromises);

    let finalStats = {};
    for (let stat of statsArr) {
        finalStats = { ...finalStats, ...stat }
    }
    // tag with timestamp on when stats were generated
    finalStats.timestamp = Date.now();
    return finalStats;
}


// Function to load the stats file into memory
async function loadStatsFile(chatsPath, charactersPath) {
    try {
        const statsFileContent = await readFile(statsFilePath, 'utf-8');
        charStats = JSON.parse(statsFileContent);
    } catch (err) {
        // If the file doesn't exist or is invalid, initialize stats
        if (err.code === 'ENOENT' || err instanceof SyntaxError) {
            charStats = await collectAndCreateStats(chatsPath, charactersPath); // Call your function to collect and create stats
            await saveStatsToFile();
        } else {
            throw err; // Rethrow the error if it's something we didn't expect
        }
    }
    console.log('Stats loaded from file:', charStats);
}

// Function to save the stats to file

async function saveStatsToFile() {
    if (charStats.timestamp > lastSaveTimestamp) {
        console.debug('Saving stats to file...');
        await writeFile(statsFilePath, JSON.stringify(charStats));
        lastSaveTimestamp = Date.now();
    } else {
        //console.debug('Stats have not changed since last save. Skipping file write.');
    }
}

async function writeStatsToFileAndExit(charStats) {
    try {
        await saveStatsToFile(charStats);
    } catch (err) {
        console.error('Failed to write stats to file:', err);
    } finally {
        process.exit();
    }
}



/**
 * Reads the contents of a file and returns the lines in the file as an array.
 *
 * @param {string} filepath - The path of the file to be read.
 * @returns {Array<string>} - The lines in the file.
 * @throws Will throw an error if the file cannot be read.
 */
function readAndParseFile(filepath) {
    try {
        let file = fs.readFileSync(filepath, 'utf8');
        let lines = file.split('\n');
        return lines;
    } catch (error) {
        console.error(`Error reading file at ${filepath}: ${error}`);
        return [];
    }
}

/**
 * Calculates the time difference between two dates.
 *
 * @param {string} gen_started - The start time in ISO 8601 format.
 * @param {string} gen_finished - The finish time in ISO 8601 format.
 * @returns {number} - The difference in time in milliseconds.
 */
function calculateGenTime(gen_started, gen_finished) {
    let startDate = new Date(gen_started);
    let endDate = new Date(gen_finished);
    return endDate - startDate;
}

/**
 * Counts the number of words in a string.
 *
 * @param {string} str - The string to count words in.
 * @returns {number} - The number of words in the string.
 */
function countWordsInString(str) {
    return str.split(" ").length;
}


/**
 * calculateStats - Calculate statistics for a given character chat directory.
 *
 * @param  {string} char_dir The directory containing the chat files.
 * @param  {string} item     The name of the character.
 * @return {object}          An object containing the calculated statistics.
 */
const calculateStats = (chatsPath, item, index) => {
    console.log('Calculating stats for', item);
    const char_dir = path.join(chatsPath, item.replace('.png', ''));
    let chat_size = 0;
    let date_last_chat = 0;
    const stats = {
        total_gen_time: 0,
        user_word_count: 0,
        non_user_word_count: 0,
        user_msg_count: 0,
        non_user_msg_count: 0,
        total_swipe_count: 0,
        chat_size: 0,
        date_last_chat: 0
    };
    let uniqueGenStartTimes = new Set();

    if (fs.existsSync(char_dir)) {
        const chats = fs.readdirSync(char_dir);
        if (Array.isArray(chats) && chats.length) {
            for (const chat of chats) {
                console.log(uniqueGenStartTimes);
                const result = calculateTotalGenTimeAndWordCount(char_dir, chat, uniqueGenStartTimes);
                stats.total_gen_time += result.totalGenTime || 0;
                stats.user_word_count += result.userWordCount || 0;
                stats.non_user_word_count += result.nonUserWordCount || 0;
                stats.user_msg_count += result.userMsgCount || 0;
                stats.non_user_msg_count += result.nonUserMsgCount || 0;
                stats.total_swipe_count += result.totalSwipeCount || 0;

                const chatStat = fs.statSync(path.join(char_dir, chat));
                stats.chat_size += chatStat.size;
                stats.date_last_chat = Math.max(stats.date_last_chat, chatStat.mtimeMs);
                console.log(stats);
            }
        }
    }

    return { [item]: stats };
}

function getCharStats() {
    return charStats;
}

function setCharStats(stats) {
    charStats = stats;
    charStats.timestamp = Date.now();
}



/**
 * Calculates the total generation time and word count for a chat with a character.
 *
 * @param {string} char_dir - The directory path where character chat files are stored.
 * @param {string} chat - The name of the chat file.
 * @returns {Object} - An object containing the total generation time, user word count, and non-user word count.
 * @throws Will throw an error if the file cannot be read or parsed.
 */
function calculateTotalGenTimeAndWordCount(char_dir, chat, uniqueGenStartTimes) {
    let filepath = path.join(char_dir, chat);
    let lines = readAndParseFile(filepath);

    let totalGenTime = 0;
    let userWordCount = 0;
    let nonUserWordCount = 0;
    let nonUserMsgCount = 0;
    let userMsgCount = 0;
    let totalSwipeCount = 0;
    let firstNonUserMsgSkipped = false;

    for (let [index, line] of lines.entries()) {
        if (line.length) {
            try {
                let json = JSON.parse(line);
                if (json.mes) {
                    let hash = crypto.createHash('sha256').update(json.mes).digest('hex');
                    if (uniqueGenStartTimes.has(hash)) {
                        continue;
                    }
                    if (hash) {
                        uniqueGenStartTimes.add(hash);
                    }
                }

                if (json.gen_started && json.gen_finished) {
                    let genTime = calculateGenTime(json.gen_started, json.gen_finished);
                    totalGenTime += genTime;

                    if (json.swipes && !json.swipe_info) {
                        // If there are swipes but no swipe_info, estimate the genTime
                        totalGenTime += genTime * json.swipes.length;
                    }
                }

                if (json.mes) {
                    let wordCount = countWordsInString(json.mes);
                    json.is_user ? userWordCount += wordCount : nonUserWordCount += wordCount;
                    json.is_user ? userMsgCount++ : nonUserMsgCount++;
                }

                if (json.swipes && json.swipes.length > 1) {
                    totalSwipeCount += json.swipes.length - 1; // Subtract 1 to not count the first swipe
                    for (let i = 1; i < json.swipes.length; i++) { // Start from the second swipe
                        let swipeText = json.swipes[i];

                        let wordCount = countWordsInString(swipeText);
                        json.is_user ? userWordCount += wordCount : nonUserWordCount += wordCount;
                        json.is_user ? userMsgCount++ : nonUserMsgCount++;

                    }
                }

                if (json.swipe_info && json.swipe_info.length > 1) {
                    for (let i = 1; i < json.swipe_info.length; i++) { // Start from the second swipe
                        let swipe = json.swipe_info[i];
                        if (swipe.gen_started && swipe.gen_finished) {
                            totalGenTime += calculateGenTime(swipe.gen_started, swipe.gen_finished);
                        }
                    }
                }
            } catch (error) {
                console.error(`Error parsing line ${line}: ${error}`);
            }
        }
    }
    return { totalGenTime, userWordCount, nonUserWordCount, userMsgCount, nonUserMsgCount, totalSwipeCount };
}

module.exports = {
    saveStatsToFile,
    loadStatsFile,
    writeStatsToFileAndExit,
    getCharStats,
    setCharStats,
};
