const fs = require('fs');
const path = require('path');
const express = require('express');
const writeFileAtomic = require('write-file-atomic');
const crypto = require('crypto');
const sanitize = require('sanitize-filename');

const { jsonParser } = require('../express-common');
const { readAndParseJsonlFile, parseJson, timestampToMoment, humanizedToDate, calculateDuration, minDate, maxDate, now } = require('../util');
const { getAllUserHandles, getUserDirectories } = require('../users');

const readFile = fs.promises.readFile;
const readdir = fs.promises.readdir;

const MIN_TIMESTAMP = 0;
const MAX_TIMESTAMP = new Date('9999-12-31T23:59:59.999Z').getTime();
const MIN_DATE = new Date(MIN_TIMESTAMP);
const MAX_DATE = new Date(MAX_TIMESTAMP);
const STATS_LANGUAGE = 'en';
const STATS_FILE = 'stats.json';
const CURRENT_STATS_VERSION = '1.2';

/** @type {Map<string, UserStatsCollection>} The stats collections for each user, accessable via their key - gets set/built on init */
const STATS = new Map();

let lastSaveDate = MIN_DATE;

/**
 * Gets the user stats collection. Creates a new empty one, if it didn't exist before
 * @param {string} userHandle - The user handle
 * @returns {UserStatsCollection}
 */
function getUserStats(userHandle) {
    return STATS.get(userHandle) ?? createEmptyStats(userHandle)
}

/**
 * Loads the stats file into memory. If the file doesn't exist or is invalid,
 * initializes stats by collecting and creating them for each character.
 */
async function init() {
    const userHandles = await getAllUserHandles();
    for (const userHandle of userHandles) {
        try {
            const directories = getUserDirectories(userHandle);
            const statsFilePath = path.join(directories.root, STATS_FILE);
            const statsFileContent = await readFile(statsFilePath, 'utf-8');
            let userStats = parseJson(statsFileContent);

            // Migrate/recreate stats if the version has changed
            if (userStats.version !== CURRENT_STATS_VERSION) {
                console.info(`Found outdated stats for user ${userHandle} of version '${userStats.version}'. Recreating stats for current version '${CURRENT_STATS_VERSION}'...`);
                userStats = await recreateStats(userHandle);
            }

            STATS.set(userHandle, userStats);
        } catch (err) {
            // If the file doesn't exist or is invalid, initialize stats
            if (err.code === 'ENOENT' || err instanceof SyntaxError) {
                console.warn(`Error on reading stats file for user ${userHandle}. Trying to recreate it... Error was: ${err.message}`);
                recreateStats(userHandle);
            } else {
                throw err; // Rethrow the error if it's something we didn't expect
            }
        }
    }
}

/**
 * Attempts to save charStats to a file and then terminates the process.
 * If an error occurs during the file write, it logs the error before exiting.
 */
async function onExit() {
    try {
        await saveStatsToFile();
    } catch (err) {
        console.error('Failed to write stats to file:', err);
    }
}

/**
 * @typedef {object} MessageLine - The chat message object to process.
 */

/**
 * @typedef {object} UserStatsCollection - An object holding all character stats, and some additional main stats
 * @property {string} version - Version number indication the version of this stats data - so it can be automatically migrated/recalculated if any of the calculation logic changes
 * @property {CharacterStats} global - global user/profile stats
 * @property {{[characterKey: string]: CharacterStats}} stats - All the dynamically saved stats objecs
 * @property {Date} _calculated -
 * @property {Date} _recalcualted -
 */

/**
 * @typedef {object} CharacterStats
 * @property {string} characterKey -
 * @property {string} charName -
 * @property {string} userName -
 * @property {number} chats - The creation date of the chat.
 * @property {number} chatSize - The size of all chats
 *
 * @property {Date} firstCreateDate -
 * @property {Date} lastCreateDate -
 * @property {Date} firstlastInteractionDate -
 * @property {Date} lastLastInteractionDate -
 *
 * @property {AggregateStat} chattingTime -
 * @property {AggregateStat} messages -
 * @property {AggregateStat} systemMessages -
 * @property {AggregateStat} userMessages -
 * @property {AggregateStat} charMessages -
 *
 * @property {AggregateStat} genTime -
 * @property {AggregateStat} genTokenCount -
 * @property {AggregateStat} swipeGenTime -
 * @property {AggregateStat} swipes -
 * @property {AggregateStat} userResponseTime -
 * @property {AggregateStat} words -
 * @property {AggregateStat} userWords -
 * @property {AggregateStat} charWords -
 *
 * @property {AggregateStat} perMessageGenTime -
 * @property {AggregateStat} perMessageGenTokenCount -
 * @property {AggregateStat} perMessageSwipeGenTime -
 * @property {AggregateStat} perMessageSwipeCount -
 * @property {AggregateStat} perMessageUserResponseTime -
 * @property {AggregateStat} perMessageWords -
 * @property {AggregateStat} perMessageUserWords -
 * @property {AggregateStat} perMessageCharWords -
 *
 * @property {{[model: string]: { count: number, tokens: number}}} genModels - model usages
 * @property {ChatStats[]} chatsStats -
 * @property {Date} _calculated -
 */

/**
 * @typedef {object} ChatStats
 * @property {string} characterKey -
 * @property {string} chatName - The unique identifier for the chat.
 * @property {number} chatId - hash
 * @property {string} charName - Current character name
 * @property {string} userName - Current user name
 * @property {number} chatSize -
 * @property {Date} createDate - The creation date of the chat. (time in ISO 8601 format)
 * @property {Date} lastInteractionDate - (time in ISO 8601 format)
 *
 * @property {number} chattingTime -
 * @property {number} messages -
 * @property {number} systemMessages -
 * @property {number} userMessages -
 * @property {number} charMessages -
 *
 * @property {AggregateStat} genTime -
 * @property {AggregateStat} genTokenCount -
 * @property {AggregateStat} swipeGenTime -
 * @property {AggregateStat} swipes -
 * @property {AggregateStat} userResponseTime -
 * @property {AggregateStat} words -
 * @property {AggregateStat} userWords -
 * @property {AggregateStat} charWords -
 *
 * @property {{[model: string]: { count: number, tokens: number}}} genModels - model usages
 * @property {MessageStats[]} messagesStats - An array of MessageStats objects for individual message analysis.
 * @property {Date} _calculated -
 */

/**
 * @typedef {object} MessageStats
 * @property {boolean} isUser -
 * @property {boolean} isChar -
 * @property {string} hash -
 * @property {Date} sendDate - The time when the message was sent.
 * @property {number?} genTime - The total time taken to generate this message and all swipes.
 * @property {number?} genTokenCount -
 * @property {number?} swipeGenTime - The total generation time for all swipes excluding the first generation.
 * @property {number?} swipes - The count of additional swipes minus the first generated message.
 * @property {number} words - The number of words in the message.
 * @property {Date[]} genEndDates -
 * @property {{[model: string]: { count: number, tokens: number}}} genModels - model usages
 * @property {Date} _calculated -
 */

/**
 * An object that aggregates stats for a specific value
 *
 * By adding values to it, it'll automatically recalculate min, max and average
 */
class AggregateStat {
    /** @type {number} The number of stats used for this aggregation - used for recalculating avg */
    count = 0;
    /** @type {number} Total / Sum */
    total = 0;
    /** @type {number} Minimum value */
    min = Number.NaN;
    /** @type {number} Maximum value */
    max = 0;
    /** @type {number} Average value */
    avg = 0;
    /** @type {number[]} All values listed and saved, so the aggregate stats can be updated if needed when elements get removed */
    values = [];
    /** @type {number?} The number of stats used when this is aggregated over the totals of aggregated stats, meaning based on any amount of sub/inner values */
    subCount = null;

    constructor() { }

    reset() {
        this.count, this.total, this.min, this.max, this.avg = 0, this.subCount = 0;
        this.values.length = 0;
    }

    /**
     * Adds a given value to this aggregation
     * If you want to add all values of an `AggregateStat`, use `addAggregated`
     * @param {number?} value - The value to add
     */
    add(value) {
        if (value === null || isNaN(value)) return;
        this.count++;
        this.total += value;
        this.avg = this.total / this.count;

        this.values.push(value);
        this.min = Math.min(isNaN(this.min) ? Number.MAX_SAFE_INTEGER : this.min, value);
        this.max = Math.max(this.max, value);
    }

    /**
     * Adds the total of the aggregated value as a single value, and also marks the count as sub values for analysis purposes
     * @param {AggregateStat} aggregatedValue - The aggregate stat
     */
    addAggregatedAsOne(aggregatedValue) {
        this.add(aggregatedValue.total);
        this.subCount = (this.subCount ?? 0) + aggregatedValue.count;
    }

    /**
     * Adds all values of a given aggregation as single values
     * @param {AggregateStat} aggregatedValue - The aggregate stat
     */
    addAggregated(aggregatedValue) {
        aggregatedValue.values.forEach(x => this.add(x));
    }

    /**
     * Removes a given value from this aggregation
     * If you want to remove all values of an `AggregateStat`, use `removeAggregated`
     * @param {number?} value - The value to remove
     */
    remove(value) {
        if (value === null || isNaN(value)) return;

        this.count--;
        this.total -= value;
        this.avg = this.count === 0 ? 0 : this.total / this.count;

        const index = this.values.indexOf(value);
        if (index === -1) {
            console.warn(`Tried to remove aggregation value ${value} that does not exist. This should not happen...`);
            return;
        }
        this.values.splice(index, 1);

        if (value === this.min) {
            this.min = this.values.length > 0 ? Math.min(...this.values) : Number.NaN;
        }
        if (value === this.max) {
            this.max = this.values.length > 0 ? Math.max(...this.values) : 0;
        }
    }

    /**
     * Removes all values of a given aggregation as their respective values
     * @param {AggregateStat} aggregatedValue - The aggregate stat
     */
    removeAggregated(aggregatedValue) {
        aggregatedValue.values.forEach(x => this.add(x));
    }

    /**
     * Removes the total of the aggregated value as a single value, and also marks the count as sub values for analysis purposes
     * @param {AggregateStat} aggregatedValue - The aggregate stat
     */
    removeAggregatedAsOne(aggregatedValue) {
        this.remove(aggregatedValue.total);
        this.subCount = this.subCount ? this.subCount - aggregatedValue.count : null;
    }
}

/**
 *
 * @param {string} userHandle - User handle
 * @returns {UserStatsCollection} The aggregated stats object
 */
function createEmptyStats(userHandle) {
    const EMPTY_USER_STATS = { _calculated: MIN_DATE, _recalcualted: MIN_DATE, version: CURRENT_STATS_VERSION, global: newCharacterStats(userHandle, 'Global'), stats: {} };

    // Resetting global user stats
    const userStats = { ...EMPTY_USER_STATS };
    STATS.set(userHandle, userStats);
    return userStats;
}

/**
 *
 * @param {string} userHandle - User handle
 * @returns {Promise<UserStatsCollection>} The aggregated stats object
 */
async function recreateStats(userHandle) {
    console.log('Collecting and creating stats...');

    const userStats = createEmptyStats(userHandle);

    // Load all char files to process their chat folders
    const directories = getUserDirectories(userHandle);
    const files = await readdir(directories.characters);
    const charFiles = files.filter((file) => file.endsWith('.png'));
    let processingPromises = charFiles.map((charFileName, _) =>
        recreateCharacterStats(userHandle, charFileName)
    );
    await Promise.all(processingPromises);

    // Remember the date at which those stats were recalculated from the ground up
    userStats._recalcualted = now();

    await saveStatsToFile();
    console.info(`Stats for user ${userHandle} (re)created and saved to file.`);

    return userStats;
}

/**
 * Recreates stats for a specific character.
 * Should be used very carefully, as it still has to recalculate most of the global stats.
 *
 * @param {string} userHandle - User handle
 * @param {string} characterKey -
 * @return {CharacterStats?}
 */
function recreateCharacterStats(userHandle, characterKey) {
    const userStats = getUserStats(userHandle);

    // If we are replacing on a existing global stats, we need to "remove" all old stats
    if (userStats.stats[characterKey]) {
        for (const chatStats of userStats.stats[characterKey].chatsStats) {
            removeChatFromCharStats(userStats.global, chatStats);
        }
        delete userStats.stats[characterKey];
    }

    // Then load chats dir for this character to process
    const charChatsDir = getCharChatsDir(userHandle, characterKey);
    if (!fs.existsSync(charChatsDir)) {
        return null;
    }

    const chatFiles = fs.readdirSync(charChatsDir);
    chatFiles.forEach(chatFile => {
        const chatName = chatFile.replace(/\.jsonl$/i, '');
        triggerChatUpdate(userHandle, characterKey, chatName);
    });

    console.info(`(Re)created ${characterKey}'s character stats for user ${userHandle}.`);
    return userStats[characterKey];
};

/**
 *
 * @param {string} userHandle - The user handle
 * @param {string} characterKey - The character key
 * @returns {string} The chats directory for this specific char
 */
function getCharChatsDir(userHandle, characterKey) {
    const charName = characterKey.replace('.png', '');
    const directories = getUserDirectories(userHandle);
    const charChatsDir = path.join(directories.chats, charName);
    return charChatsDir;
}

/**
 *
 * @param {string} userHandle - The user handle
 * @param {string} characterKey
 * @param {string} chatName
 * @returns {{chatName: string, filePath: string, lines: object[]}}
 */
function loadChatFile(userHandle, characterKey, chatName) {
    const charChatsDir = getCharChatsDir(userHandle, characterKey);

    const filePath = path.join(charChatsDir, `${sanitize(chatName)}.jsonl`);
    const lines = readAndParseJsonlFile(filePath);
    return { chatName, filePath, lines };
}


/**
 *
 * @param {string} userHandle - The user handle
 * @param {string} characterKey - The character key
 * @param {string} chatName - The name of the chat
 * @returns {ChatStats?}
 */
function triggerChatUpdate(userHandle, characterKey, chatName) {
    // Load and process chats to get its stats
    const loadedChat = loadChatFile(userHandle, characterKey, chatName);
    const fsStats = fs.statSync(loadedChat.filePath);

    const chatStats = processChat(characterKey, chatName, loadedChat.lines, { chatSize: fsStats.size });
    if (chatStats === null) {
        return null;
    }

    const userStats = getUserStats(userHandle);

    // Create empty stats if character stats don't exist yet
    userStats.stats[characterKey] ??= newCharacterStats(characterKey);

    // Update both the char stats and the global user stats with this chat
    updateCharStatsWithChat(userStats.stats[characterKey], chatStats);
    updateCharStatsWithChat(userStats.global, chatStats);

    // For global chats, we always overwrite the char name with a default one
    userStats.global.charName = 'Character';

    userStats._calculated = now();
    return chatStats;
}

/**
 * Recalculates character stats based on the current chat.
 * Works with both updating/replacing an existing chat and also adding a new one.
 *
 * @param {CharacterStats} stats - The stats of the character
 * @param {ChatStats} chatStats - The chat stats to add/update
 * @returns {boolean}
 */
function updateCharStatsWithChat(stats, chatStats) {
    // Check if we need to remove this chat's previous data first
    removeChatFromCharStats(stats, chatStats);

    stats.chatsStats.push(chatStats);

    stats.chats++;
    stats.chatSize += chatStats.chatSize;
    stats.firstCreateDate = minDate(chatStats.createDate, stats.firstCreateDate) ?? stats.firstCreateDate;
    stats.lastCreateDate = maxDate(chatStats.createDate, stats.lastCreateDate) ?? stats.lastCreateDate;
    stats.firstlastInteractionDate = minDate(chatStats.lastInteractionDate, stats.firstlastInteractionDate) ?? stats.firstlastInteractionDate;
    stats.lastLastInteractionDate = maxDate(chatStats.lastInteractionDate, stats.lastLastInteractionDate) ?? stats.lastLastInteractionDate;

    stats.chattingTime.add(chatStats.chattingTime);
    stats.messages.add(chatStats.messages);
    stats.systemMessages.add(chatStats.systemMessages);
    stats.userMessages.add(chatStats.userMessages);
    stats.charMessages.add(chatStats.charMessages);

    stats.genTime.addAggregatedAsOne(chatStats.genTime);
    stats.genTokenCount.addAggregatedAsOne(chatStats.genTokenCount);
    stats.swipeGenTime.addAggregatedAsOne(chatStats.swipeGenTime);
    stats.swipes.addAggregatedAsOne(chatStats.swipes);
    stats.userResponseTime.addAggregatedAsOne(chatStats.userResponseTime);
    stats.words.addAggregatedAsOne(chatStats.words);
    stats.userWords.addAggregatedAsOne(chatStats.userWords);
    stats.charWords.addAggregatedAsOne(chatStats.charWords);

    stats.perMessageGenTime.addAggregated(chatStats.genTime);
    stats.perMessageGenTokenCount.addAggregated(chatStats.genTokenCount);
    stats.perMessageSwipeGenTime.addAggregated(chatStats.swipeGenTime);
    stats.perMessageSwipeCount.addAggregated(chatStats.swipes);
    stats.perMessageUserResponseTime.addAggregated(chatStats.userResponseTime);
    stats.perMessageWords.addAggregated(chatStats.words);
    stats.perMessageUserWords.addAggregated(chatStats.userWords);
    stats.perMessageCharWords.addAggregated(chatStats.charWords);

    Object.entries(chatStats.genModels).forEach(([model, data]) => addModelUsage(stats.genModels, model, data.tokens, data.count));

    // Update name (if it might have changed)
    stats.charName = chatStats.charName || stats.charName;
    stats.userName = chatStats.userName || stats.userName;

    stats._calculated = now();
    console.debug(`Successfully updated ${stats.charName}'s stats with chat '${chatStats.chatName}'`);
    return true;
}

/**
 * Removes the given chat stats from the character stats
 * Both removing the saved stats object and also "calculating it out" of all existing values
 * @param {CharacterStats} stats - The stats of the character
 * @param {ChatStats} chatStats - The chat stats to remove
 * @returns {boolean} Whether existed and was removed
 */
function removeChatFromCharStats(stats, chatStats) {
    const index = stats.chatsStats.findIndex(x => x.chatName == chatStats.chatName);
    if (index === -1) {
        return false;
    }
    this.values.splice(index, 1);

    stats.chats--;
    stats.chatSize -= chatStats.chatSize;
    stats.firstCreateDate = minDate(chatStats.createDate, stats.firstCreateDate) ?? stats.firstCreateDate;
    stats.lastCreateDate = maxDate(chatStats.createDate, stats.lastCreateDate) ?? stats.lastCreateDate;
    stats.firstlastInteractionDate = minDate(chatStats.lastInteractionDate, stats.firstlastInteractionDate) ?? stats.firstlastInteractionDate;
    stats.lastLastInteractionDate = maxDate(chatStats.lastInteractionDate, stats.lastLastInteractionDate) ?? stats.lastLastInteractionDate;

    stats.chattingTime.remove(chatStats.chattingTime);
    stats.messages.remove(chatStats.messages);
    stats.systemMessages.remove(chatStats.systemMessages);
    stats.userMessages.remove(chatStats.userMessages);
    stats.charMessages.remove(chatStats.charMessages);

    stats.genTime.removeAggregatedAsOne(chatStats.genTime);
    stats.genTokenCount.removeAggregatedAsOne(chatStats.genTokenCount);
    stats.swipeGenTime.removeAggregatedAsOne(chatStats.swipeGenTime);
    stats.swipes.removeAggregatedAsOne(chatStats.swipes);
    stats.userResponseTime.removeAggregatedAsOne(chatStats.userResponseTime);
    stats.words.removeAggregatedAsOne(chatStats.words);
    stats.userWords.removeAggregatedAsOne(chatStats.userWords);
    stats.charWords.removeAggregatedAsOne(chatStats.charWords);

    stats.perMessageGenTime.removeAggregated(chatStats.genTime);
    stats.perMessageGenTokenCount.removeAggregated(chatStats.genTokenCount);
    stats.perMessageSwipeGenTime.removeAggregated(chatStats.swipeGenTime);
    stats.perMessageSwipeCount.removeAggregated(chatStats.swipes);
    stats.perMessageUserResponseTime.removeAggregated(chatStats.userResponseTime);
    stats.perMessageWords.removeAggregated(chatStats.words);
    stats.perMessageUserWords.removeAggregated(chatStats.userWords);
    stats.perMessageCharWords.removeAggregated(chatStats.charWords);

    Object.entries(chatStats.genModels).forEach(([model, data]) => removeModelUsage(stats.genModels, model, data.tokens, data.count));

    console.debug(`Successfully removed old chat stats for chat ${chatStats.chatName}`);
    return true;
}

/**
 *
 * @param {string} characterKey
 * @param {string} chatName
 * @param {object[]} lines
 * @param {{chatSize?: number}} [param0={}] - optional parameter that can be set when processing the chat
 * @return {ChatStats?}
 */
function processChat(characterKey, chatName, lines, { chatSize = 0 } = {}) {
    if (!lines.length) {
        console.warn('Processing chat file failed.');
        return null;
    }

    /** @type {ChatStats} build the stats object first, then fill */
    const stats = newChatStats(characterKey, chatName);

    // Fill stats that we already can
    stats.chatSize = chatSize;

    /** @type {MessageStats?} Always remember the message before, for calculations */
    let lastMessage = null;

    // Process each message
    for (const message of lines) {
        // Check if this is the first message, the "data storage"
        if (message.chat_metadata && message.create_date) {
            stats.createDate = humanizedToDate(message.create_date) ?? stats.createDate;
            stats.lastInteractionDate = stats.createDate;
            stats.chatId = message.chat_metadata['chat_id_hash'];
            continue;
        }

        const messageStats = processMessage(message);
        stats.messagesStats.push(messageStats);

        // Update names to the latest message
        stats.charName = messageStats.isChar ? message.name : stats.charName;
        stats.userName = messageStats.isUser ? message.name : stats.userName;

        stats.lastInteractionDate = maxDate(stats.lastInteractionDate, messageStats.sendDate, ...messageStats.genEndDates) ?? stats.lastInteractionDate;

        // Aggregate chat stats for each message
        // stats.chattingTime - is calculated at the end of message progressing
        stats.messages += 1;
        stats.systemMessages += message.is_system ? 1 : 0;
        stats.userMessages += messageStats.isUser ? 1 : 0;
        stats.charMessages += messageStats.isChar ? 1 : 0;

        stats.genTime.add(messageStats.genTime);
        stats.genTokenCount.add(messageStats.genTokenCount)
        stats.swipeGenTime.add(messageStats.swipeGenTime);
        stats.swipes.add(messageStats.swipes);

        // If this is a user message, we calculate the response time from the last interaction of the message before
        if (messageStats.isUser && lastMessage !== null) {
            const lastInteractionBefore = lastMessage.genEndDates.sort().findLast(x => x < messageStats.sendDate) ?? lastMessage.sendDate;
            const responseTime = calculateDuration(lastInteractionBefore, messageStats.sendDate);
            stats.userResponseTime.add(responseTime);
        }

        stats.words.add(messageStats.words);
        stats.userWords.add(messageStats.isUser ? messageStats.words : null);
        stats.charWords.add(messageStats.isChar ? messageStats.words : null);

        Object.entries(messageStats.genModels).forEach(([model, data]) => addModelUsage(stats.genModels, model, data.tokens, data.count));

        // Remember this as the last message, for time calculations
        lastMessage = messageStats;
    }

    // Set up the final values for chat
    stats.chattingTime = calculateDuration(stats.createDate, stats.lastInteractionDate);

    stats._calculated = now();
    return stats;
}

/**
 * Process a chat message and calculate relevant stats
 * @param {MessageLine} message - The parsed json message line
 * @returns {MessageStats}
 */
function processMessage(message, name = null) {
    /** @type {MessageStats} build the stats object first, then fill */
    const stats = newMessageStats();

    stats.isUser = message.is_user;
    stats.isChar = !message.is_user && !message.is_system && (!name || message.name == name);
    stats.hash = crypto.createHash('sha256').update(message.mes).digest('hex');

    // Count all additional swipes (this array stores the original message too)
    stats.swipes = message.swipe_info?.length ? message.swipe_info.length - 1 : null;

    // Use utility functions to process each message
    stats.words = countWordsInString(message.mes);
    stats.sendDate = new Date(timestampToMoment(message.send_date) ?? MIN_TIMESTAMP);

    // Only calculate generation time and token count for model messages
    if (!message.is_user) {
        if (message.gen_started && message.gen_finished) {
            stats.genTokenCount = message.extra?.token_count || 0;
            stats.genTime = calculateDuration(message.gen_started, message.gen_finished);
            stats.genEndDates.push((new Date(message.gen_finished)));
            addModelUsage(stats.genModels, message.extra?.model, message.extra?.token_count);
        }

        // Sum up swipes. As swiping time counts everything that was not the last, final chosen message
        // We also remember the highest timestamp for this message as the "last action"
        message.swipe_info?.filter(x => x.gen_started !== message.gen_started && x.gen_started && x.gen_finished)
            .forEach(swipeInfo => {
                stats.genTokenCount = (stats.genTokenCount ?? 0) + message.extra?.token_count || 0;
                const swipeGenTime = calculateDuration(swipeInfo.gen_started, swipeInfo.gen_finished);
                stats.genTime = (stats.genTime ?? 0) + swipeGenTime;
                stats.swipeGenTime = (stats.swipeGenTime ?? 0) + swipeGenTime;
                stats.genEndDates.push((new Date(swipeInfo.gen_finished)));
                addModelUsage(stats.genModels, swipeInfo.extra?.model, swipeInfo.extra?.token_count);
            });
    }

    stats._calculated = now();
    return stats;
}

/** @param {{[model: string]: { count: number, tokens: number}}} obj, @param {string} model, @param {number} tokens @param {number} count */
function addModelUsage(obj, model, tokens, count = 1) {
    if (!model) return;
    obj[model] ??= { count: 0, tokens: 0 };
    obj[model].count += (count ?? 1);
    obj[model].tokens += (tokens ?? 0);
}

/** @param {{[model: string]: { count: number, tokens: number}}} obj, @param {string} model, @param {number} tokens @param {number} count */
function removeModelUsage(obj, model, tokens, count = 1) {
    if (!model || !obj[model]) return;
    obj[model].count -= (count ?? 1);
    obj[model].tokens -= (tokens ?? 0);
    if (obj[model].count <= 0)
        delete obj[model];
}

/**
 * Counts the number of words in a string.
 *
 * @param {string} str - The string to count words in.
 * @returns {number} - The number of words in the string.
 */
function countWordsInString(str) {
    const words = Array.from(new Intl.Segmenter(STATS_LANGUAGE ?? 'en', { granularity: 'word' }).segment(str))
        .filter(it => it.isWordLike);
    return words.length;
}

/**
 * Creates a new, empty character stats object
 * @param {string} characterKey - The character key
 * @param {string} charName - The characters' name
 * @returns {CharacterStats}
 */
function newCharacterStats(characterKey = '', charName = '') {
    return {
        characterKey: characterKey,
        charName: charName,
        userName: '',
        chats: 0,
        chatSize: 0,

        firstCreateDate: MAX_DATE,
        lastCreateDate: MIN_DATE,
        firstlastInteractionDate: MAX_DATE,
        lastLastInteractionDate: MIN_DATE,

        chattingTime: new AggregateStat(),
        messages: new AggregateStat(),
        systemMessages: new AggregateStat(),
        userMessages: new AggregateStat(),
        charMessages: new AggregateStat(),

        genTime: new AggregateStat(),
        genTokenCount: new AggregateStat(),
        swipeGenTime: new AggregateStat(),
        swipes: new AggregateStat(),
        userResponseTime: new AggregateStat(),
        words: new AggregateStat(),
        userWords: new AggregateStat(),
        charWords: new AggregateStat(),

        perMessageGenTime: new AggregateStat(),
        perMessageGenTokenCount: new AggregateStat(),
        perMessageSwipeGenTime: new AggregateStat(),
        perMessageSwipeCount: new AggregateStat(),
        perMessageUserResponseTime: new AggregateStat(),
        perMessageWords: new AggregateStat(),
        perMessageUserWords: new AggregateStat(),
        perMessageCharWords: new AggregateStat(),

        genModels: {},
        chatsStats: [],
        _calculated: now(),
    };
}

/**
 * Creates a new, empty chat stats object
 * @param {string} characterKey - The character key
 * @param {string} chatName - The chats' name
 * @returns {ChatStats}
 */
function newChatStats(characterKey, chatName) {
    return {
        characterKey: characterKey,
        chatName: chatName,
        chatId: 0,
        charName: '',
        userName: '',
        chatSize: 0,
        createDate: MAX_DATE,
        lastInteractionDate: MIN_DATE,

        chattingTime: 0,
        messages: 0,
        systemMessages: 0,
        userMessages: 0,
        charMessages: 0,

        genTime: new AggregateStat(),
        genTokenCount: new AggregateStat(),
        swipeGenTime: new AggregateStat(),
        swipes: new AggregateStat(),
        userResponseTime: new AggregateStat(),
        words: new AggregateStat(),
        userWords: new AggregateStat(),
        charWords: new AggregateStat(),

        genModels: {},
        messagesStats: [],
        _calculated: now(),
    };
}

/**
 * Creates a new, empty message stats object
 * @returns {MessageStats}
 */
function newMessageStats() {
    return {
        isUser: false,
        isChar: false,
        hash: '',
        sendDate: MIN_DATE,
        genTime: null,
        genTokenCount: null,
        swipeGenTime: null,
        swipes: null,
        words: 0,
        genEndDates: [],
        genModels: {},
        _calculated: now(),
    };
}

/**
 * Saves the current state of charStats to a file, only if the data has changed since the last save.
 * @param {string?} [userHandle] - Optionally only save file for one user handle
 */
async function saveStatsToFile(userHandle = null) {
    const userHandles = userHandle ? [userHandle] : await getAllUserHandles();
    for (const userHandle of userHandles) {
        const userStats = getUserStats(userHandle);
        if (userStats._calculated > lastSaveDate) {
            try {
                const directories = getUserDirectories(userHandle);
                const statsFilePath = path.join(directories.root, STATS_FILE);
                await writeFileAtomic(statsFilePath, JSON.stringify(userStats));
                lastSaveDate = now();
            } catch (error) {
                console.log('Failed to save stats to file.', error);
            }
        }
    }
}

const router = express.Router();

/**
 * @typedef {object} StatsRequestBody
 * @property {boolean?} [global] - Whether the global stats are requested. If true, all other arguments are ignored
 * @property {string?} [characterKey] - The character key for the character to request stats from
 * @property {string?} [chatName] - The name of the chat file
 */

/**
 * Handle a POST request to get the stats fromm
 *
 * This function returns the stats object that was calculated and updated based on the chats.
 * Depending on the given request filter, it will either return global stats, character stats or chat stats.
 *
 * @param {Object} request - The HTTP request object.
 * @param {Object} response - The HTTP response object.
 * @returns {void}
 */
router.post('/get', jsonParser, function (request, response) {
    const send = (data) => response.send(JSON.stringify(data ?? null));
    /** @type {StatsRequestBody} */
    const body = request.body;

    const userHandle = request.user.profile.handle;
    const userStats = getUserStats(userHandle);

    if (!!body.global) {
        return send(userStats.global);
    }

    if (body.characterKey && body.chatName) {
        return send(userStats.stats[body.characterKey]?.chatsStats.find(x => x.chatName == body.chatName));
    }
    if (body.characterKey) {
        return send(userStats.stats[body.characterKey]);
    }

    // If no specific filter was requested, we send all stats back
    return send(userStats);
});

/**
 * Triggers the recreation of statistics from chat files.
 * - If successful: returns a 200 OK status.
 * - On failure: returns a 500 Internal Server Error status.
 *
 * @param {Object} request - Express request object.
 * @param {Object} response - Express response object.
 */
router.post('/recreate', jsonParser, async function (request, response) {
    const send = (data) => response.send(JSON.stringify(data ?? {}));
    /** @type {StatsRequestBody} */
    const body = request.body;

    const userHandle = request.user.profile.handle;

    try {
        if (body.characterKey) {
            recreateCharacterStats(userHandle, body.characterKey);
            return send(getUserStats(userHandle).stats[body.characterKey]);
        }
        await recreateStats(userHandle);
        return send(getUserStats(userHandle));
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

module.exports = {
    router,
    init,
    onExit,
};
