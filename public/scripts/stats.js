// statsHelper.js
import { getRequestHeaders, callPopup, characters, this_chid, buildAvatarList, characterToEntity } from '../script.js';
import { humanizeGenTime } from './RossAscends-mods.js';
import { registerDebugFunction } from './power-user.js';
import { timestampToMoment } from './utils.js';

const MIN_TIMESTAMP = 0;
const MAX_TIMESTAMP = new Date('9999-12-31T23:59:59.999Z').getTime();
const CURRENT_STATS_VERSION = '1.0';

/** @typedef {import('../script.js').Character} Character */

/**
 * @typedef {object} AggregateStat
 * @property {number[]} list - The values stored, so they can be recalculated
 * @property {number} total - Total / Sum
 * @property {number} min - Minimum value
 * @property {number} max - Maximum value
 * @property {number} avg - Average value
 */

/**
 * @typedef {object} Stats - Stats for a chat
 * @property {number} chat_size - The size of the actual chat file
 * @property {number} date_first_chat - Timestamp of the first chat message (made by user)
 * @property {number} date_last_chat - Timestamp of the last chat message in this chat (made by anyone)
 * @property {number} total_gen_time - Total generation time in milliseconds
 * @property {number} total_msg_count - The total messages of user and non-user, not including swipes
 * @property {number} total_swipe_count - The number of swipes in the whole chat
 * @property {number} avg_gen_time - Average generation tme in milliseconds
 * @property {number} avg_swipe_count - Average swipes per non-user message
 *
 * @property {number} avg_chat_msg_count - Average messages per chat
 * @property {number} avg_chat_duration - Average duration of a chat (from first till last message)
 *
 * @property {AggregateStat} msg -
 * @property {AggregateStat} user_msg -
 * @property {AggregateStat} non_user_msg -
 * @property {AggregateStat} words -
 * @property {AggregateStat} user_words -
 * @property {AggregateStat} non_user_words -
 *
 */



/** @type {StatsCollection} The collection of all stats, accessable via their key */
let charStats = { timestamp: 0, version: CURRENT_STATS_VERSION, stats: {} };

/**
 * Creates an empty new stats object with default values
 * @returns {Stats} The stats
 */
function createEmptyStats() {
    return {
        total_gen_time: 0,
        user_word_count: 0,
        non_user_word_count: 0,
        user_msg_count: 0,
        non_user_msg_count: 0,
        total_swipe_count: 0,
        chat_size: 0,
        date_first_chat: MAX_TIMESTAMP,
        date_last_chat: MIN_TIMESTAMP,
    };
}

/**
 * Verifies and returns a numerical stat value. If the provided stat is not a number, returns 0.
 *
 * @param {number|string} stat - The stat value to be checked and returned.
 * @returns {number} - The stat value if it is a number, otherwise 0.
 */
function verifyStatValue(stat) {
    return isNaN(Number(stat)) ? 0 : Number(stat);
}

/**
 * Calculates total stats from character statistics.
 *
 * @returns {Stats} - Object containing total statistics.
 */
function calculateTotalStats() {
    let totalStats = createEmptyStats();

    for (let stats of Object.values(charStats.stats)) {
        totalStats.total_gen_time += verifyStatValue(stats.total_gen_time);
        totalStats.user_msg_count += verifyStatValue(stats.user_msg_count);
        totalStats.non_user_msg_count += verifyStatValue(stats.non_user_msg_count);
        totalStats.user_word_count += verifyStatValue(stats.user_word_count);
        totalStats.non_user_word_count += verifyStatValue(stats.non_user_word_count);
        totalStats.total_swipe_count += verifyStatValue(stats.total_swipe_count);
        totalStats.date_last_chat = Math.max(totalStats.date_last_chat, verifyStatValue(stats.date_last_chat) || MIN_TIMESTAMP);
        totalStats.date_first_chat = Math.min(totalStats.date_first_chat, verifyStatValue(stats.date_first_chat) || MAX_TIMESTAMP);
    }

    return totalStats;
}

/**
 * Build a humanized string for a duration
 * @param {number} start - Start time (in milliseconds)
 * @param {number|null} end - End time (in milliseconds), if null will be replaced with Date.now()
 * @param {object} param2 - Optional parameters
 * @param {string} [param2.fallback='Never'] - Fallback value no duration can be calculated
 * @param {function(string): string} [param2.wrapper=null] - Optional function to wrap/format the resulting humanized duration
 * @returns {string} Humanized duration string
 */
function humanizedDuration(start, end = null, { fallback = 'Never', wrapper = null } = {}) {
    end = end ?? Date.now();
    if (!start || start > end) {
        return fallback;
    }
    // @ts-ignore
    const humanized = moment.duration(end - start).humanize();
    return wrapper ? wrapper(humanized) : humanized;
}

/**
 * @typedef {object} StatField A stat block value to print
 * @property {any} value - The value to print
 * @property {boolean} [isHeader=false] - Flag indicating whether this is a header
 * @property {string|null} [info=null] - Optional text that will be shown as an info icon
 * @property {string|null} [title=null] - Optional title for the value - if null and info is set, info will be used as title too
 * @property {string[]|null} [classes=null] - Optional list of classes for the stat field
 */


/** @param {StatField|any} x @returns {StatField} gets the stat field object for any value */
function field(x) { return (typeof x === 'object' && x !== null && Object.hasOwn(x, 'value')) ? x : { value: x }; }

/**
 * Creates an HTML stat block
 *
 * @param {StatField|any} name - The name content of the stat to be displayed
 * @param {StatField[]|any[]} values - Value or values to be listed for the stat block
 * @returns {string} - An HTML string representing the stat block
 */
function createStatBlock(name, ...values) {
    /** @param {StatField} stat @returns {string} */
    function buildField(stat) {
        const classes = ['rm_stat_field', stat.isHeader ? 'rm_stat_header' : '', ...(stat.classes ?? [])].filter(x => x?.length);
        return `<div class="${classes.join(' ')}" ${stat.title || stat.info ? `title="${stat.title ?? stat.info}"` : ''}>
            ${stat.value === null || stat.value === '' ? '&zwnj;' : stat.value}
            ${stat.info ? `<small><div class="fa-solid fa-circle-info opacity50p" data-i18n="[title]${stat.info}" title="${stat.info}"></div></small>` : ''}
        </div>`;
    }

    const statName = field(name);
    const statValues = values.flat(Infinity).map(field);

    const isDataRow = !statName.isHeader && !statValues.some(x => x.isHeader);
    const isRightSpacing = statValues.slice(-1)[0]?.classes?.includes('rm_stat_right_spacing');
    // Hack right spacing, which is added via a value just having the class
    if (isRightSpacing) {
        statValues.pop();
    }

    const classes = ['rm_stat_block', isDataRow ? 'rm_stat_block_data_row' : null, isRightSpacing ? 'rm_stat_right_spacing' : null].filter(x => x?.length);
    return `<div class="${classes.join(' ')}">
                <div class="rm_stat_name">${buildField(statName)}</div>
                <div class="rm_stat_values">${statValues.map(x => buildField(x)).join('')}</div>
            </div>`;
}

/**
 * Generates an HTML report of stats.
 *
 * This function creates an HTML report from the provided stats, including chat age,
 * chat time, number of user messages and character messages, word count, and swipe count.
 * The stat blocks are tailored depending on the stats type ("User" or "Character").
 *
 * @param {'User'|'Character'} statsType - The type of stats (e.g., "User", "Character")
 * @param {number|null} characterId - Character id for these stats, null if global
 * @param {Stats} stats - The stats data
 */
function createHtml(statsType, characterId, stats) {
    const NOW = Date.now();
    const name = characters[characterId]?.name || 'User';
    const HMTL_STAT_SPACER = '<div class="rm_stat_spacer"></div>';

    /** @param {number} charVal @param {number} userVal @returns {string}  */
    function buildBar(userVal, charVal) {
        const percentUser = (userVal / (userVal + charVal)) * 100;
        const percentChar = 100 - percentUser;
        return `<div class="rm_stat_bar">
            <div style="width: ${percentUser}%" title="User: ${userVal}   (${percentUser.toFixed(1)}%)" class="rm_stat_bar_user"></div>
            <div style="width: ${percentChar}%" title="${name}: ${charVal}   (${percentChar.toFixed(1)}%)" class="rm_stat_bar_char"></div>
        </div>`;
    }
    /** @param {any[]} values @returns {StatField[]}  */
    function buildBarDesc(...values) {
        return values.flat(Infinity).map(field).map((x, i) => i % 2 == 0 ? { classes: [...(x.classes ?? []), 'rm_stat_field_lefty'], ...x } : x);
    }

    // Create popup HTML with stats
    let html = `<h3>${statsType} Stats - ${name}</h3>`;
    html += HMTL_STAT_SPACER;
    html += createStatBlock({ value: 'Character Overview', isHeader: true });
    html += createStatBlock('Chats', { value: 34 }, { value: null, classes: ['rm_stat_right_spacing'] });
    html += createStatBlock({ value: 'Chats Size', info: 'The chat file sizes calculated and summed.\nThis value is only estimated, and will be refreshed sporadically.' }, { value: `~${'3.54 mb'}` }, { value: null, classes: ['rm_stat_right_spacing'] });
    html += createStatBlock('Most Used Model', { value: 'Noromaid' }, { value: null, classes: ['rm_stat_right_spacing'] });
    html += HMTL_STAT_SPACER;
    html += createStatBlock('',
        { value: 'First', isHeader: true, info: `The data corresponding to the first chat with ${name}` },
        { value: 'Last', isHeader: true, info: `The data corresponding to the last chat with ${name}` },
        { value: null, classes: ['rm_stat_right_spacing'] },
    );
    html += createStatBlock({ value: 'New Chat', info: 'The first/last time when a new chat was started' },
        { value: humanizedDuration(stats.date_first_chat, NOW, { wrapper: x => `${x} ago` }), title: timestampToMoment(stats.date_first_chat).format('LL LT') },
        { value: humanizedDuration(stats.date_last_chat, NOW, { wrapper: x => `${x} ago` }), title: timestampToMoment(stats.date_last_chat).format('LL LT') },
        { value: null, classes: ['rm_stat_right_spacing'] },
    );
    html += createStatBlock({ value: 'Chat Ended', info: 'The first/last time when the last message was send to a chat' },
        { value: humanizedDuration(stats.date_first_chat, NOW, { wrapper: x => `${x} ago` }), title: timestampToMoment(stats.date_first_chat).format('LL LT') },
        { value: humanizedDuration(stats.date_last_chat, NOW, { wrapper: x => `${x} ago` }), title: timestampToMoment(stats.date_last_chat).format('LL LT') },
        { value: null, classes: ['rm_stat_right_spacing'] },
    );

    html += HMTL_STAT_SPACER;
    html += HMTL_STAT_SPACER;
    html += createStatBlock({ value: 'Aggregated Stats', isHeader: true, info: 'Values per chat, aggregated over all chats' });
    html += createStatBlock(null,
        { value: 'Total', isHeader: true, info: 'Total summed value over all chats' },
        { value: 'Min', isHeader: true, info: 'Minium value for any chat' },
        { value: 'Avg', isHeader: true, info: 'Average value over all chats' },
        { value: 'Max', isHeader: true, info: 'Maximum value for any chat' }
    );
    html += createStatBlock({ value: 'Chatting Time', info: 'Total chatting time over all chats, and min/avg/max chatting time per chat' },
        { value: humanizeGenTime(114387009, true) }, { value: humanizeGenTime(7203, true) }, { value: humanizeGenTime(159017, true) }, { value: humanizeGenTime(7884930, true) });
    html += createStatBlock({ value: 'Generation Time', info: 'Total generation time over all chats, and min/avg/max generation time per chat' },
        humanizeGenTime(34680309, true), humanizeGenTime(4566, true), humanizeGenTime(23523, true), humanizeGenTime(286230, true));
    html += createStatBlock('Generated Tokens', 2355, 43, 180, 2400);
    html += HMTL_STAT_SPACER;
    html += createStatBlock('Swiping Time', humanizeGenTime(34680309, true), humanizeGenTime(4566, true), humanizeGenTime(23523, true), humanizeGenTime(286230, true));
    html += createStatBlock({ value: 'Swipes', info: 'Total swipes over all chats, and min/avg/max swipes per chat' },
        { value: 256 }, { value: 1 }, { value: 4 }, { value: 25 });
    html += HMTL_STAT_SPACER;
    html += createStatBlock('User Response Time', humanizeGenTime(34680309, true), humanizeGenTime(4566, true), humanizeGenTime(23523, true), humanizeGenTime(286230, true));
    html += HMTL_STAT_SPACER;
    html += createStatBlock({ value: 'Messages', info: 'Total messages over all chats (excluding swipes), and min/avg/max messages per chat' },
        512, 2, 12, 100);
    html += createStatBlock('System Messages', 47, 0, 4, 85);
    html += createStatBlock({ value: 'Messages (User / Char)', classes: ['rm_stat_field_smaller'] }, buildBarDesc(145, 359, 2, 27, 8, 54, 66, 100));
    html += createStatBlock({ value: '', info: '' },
        buildBar(145, 359), buildBar(2, 27), buildBar(8, 54), buildBar(66, 100));
    html += HMTL_STAT_SPACER;
    html += createStatBlock({ value: 'Words', info: 'Total words over all chats, and min/avg/max words per chat' },
        { value: 5124 }, { value: 26 }, { value: 122 }, { value: 1008 });
    html += createStatBlock({ value: 'Words (User / Char)', classes: ['rm_stat_field_smaller'] }, buildBarDesc(1451, 3594, 22, 279, 84, 625, 762, 2505));
    html += createStatBlock({ value: '', info: '' },
        buildBar(1451, 3594), buildBar(22, 279), buildBar(84, 625), buildBar(762, 2505));

    html += HMTL_STAT_SPACER;
    html += HMTL_STAT_SPACER;
    html += createStatBlock({ value: 'Per Message Stats', isHeader: true, info: 'Values per message, aggregated over all chats' });
    html += createStatBlock('',
        null,
        { value: 'Min', isHeader: true, info: 'Minium ' },
        { value: 'Avg', isHeader: true },
        { value: 'Max', isHeader: true }
    );
    html += createStatBlock({ value: 'Generation Time', info: 'min/avg/max generation time per message' },
        null, { value: humanizeGenTime(4566, true) }, { value: humanizeGenTime(23523, true) }, { value: humanizeGenTime(286230, true) });
    html += createStatBlock('Generated Tokens', null, 43, 180, 2400);
    html += HMTL_STAT_SPACER;
    html += createStatBlock('Swiping Time', null, humanizeGenTime(1456, true), humanizeGenTime(2523, true), humanizeGenTime(28230, true));
    html += createStatBlock({ value: 'Swipes', info: 'min/avg/max swipes per <b>non-user</b> message' },
        null, { value: 1 }, { value: 4 }, { value: 25 });
    html += HMTL_STAT_SPACER;
    html += createStatBlock('User Response Time', null, humanizeGenTime(0, true), humanizeGenTime(233, true), humanizeGenTime(13630, true));
    html += HMTL_STAT_SPACER;
    html += createStatBlock({ value: 'Words', info: 'min/avg/max words per message' },
        null, { value: 4 }, { value: 145 }, { value: 431 });
    html += createStatBlock({ value: 'Words (User / Char)', classes: ['rm_stat_field_smaller'] }, buildBarDesc(null, null, 22, 279, 84, 625, 762, 2505));
    html += createStatBlock({ value: '', info: '' },
        null, buildBar(22, 279), buildBar(84, 625), buildBar(762, 2505));

    html += HMTL_STAT_SPACER;
    html += HMTL_STAT_SPACER;

    // Hijack avatar list function to draw the user avatar
    if (characters[characterId]) {
        const placeHolder = $('<div class="rm_stat_avatar_block"></div>');
        const entity = characterToEntity(characters[characterId], characterId);
        buildAvatarList(placeHolder, [entity]);
        html = placeHolder.prop('outerHTML') + html;
    }

    callPopup(html, 'text', '', { wider: true, allowVerticalScrolling: true });
}

/**
 * Handles the user stats by getting them from the server, calculating the total and generating the HTML report.
 */
async function userStatsHandler() {
    // Get stats from server
    await getStats();

    // Calculate total stats
    let totalStats = calculateTotalStats();

    // Create HTML with stats
    createHtml('User', null, totalStats);
}

/**
 * Handles the character stats by getting them from the server and generating the HTML report.
 *
 * @param {{[characterKey: string]: Character}} characters - Object containing character data.
 * @param {string} this_chid - The character id.
 */
async function characterStatsHandler(characters, this_chid) {
    // Get stats from server
    await getStats();
    // Get character stats
    let myStats = charStats.stats[characters[this_chid].avatar];
    if (myStats === undefined) {
        myStats = createEmptyStats();
        myStats.non_user_word_count = countWords(characters[this_chid].first_mes);
        charStats.stats[characters[this_chid].avatar] = myStats;
        updateStats();
    }
    // Create HTML with stats
    createHtml('Character', this_chid, myStats);
}

/**
 * Fetches the character stats from the server.
 */
async function getStats() {
    const response = await fetch('/api/stats/get', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({}),
        cache: 'no-cache',
    });

    if (!response.ok) {
        toastr.error('Stats could not be loaded. Try reloading the page.');
        throw new Error('Error getting stats');
    }
    charStats = await response.json();
}

/**
 * Asynchronously recreates the stats file from chat files.
 *
 * Sends a POST request to the "/api/stats/recreate" endpoint. If the request fails,
 * it displays an error notification and throws an error.
 *
 * @throws {Error} If the request to recreate stats is unsuccessful.
 */
async function recreateStats() {
    const response = await fetch('/api/stats/recreate', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({}),
        cache: 'no-cache',
    });

    if (!response.ok) {
        toastr.error('Stats could not be loaded. Try reloading the page.');
        throw new Error('Error getting stats');
    }
    else {
        toastr.success('Stats file recreated successfully!');
    }
}


/**
 * Calculates the generation time based on start and finish times.
 *
 * @param {string} gen_started - The start time in ISO 8601 format.
 * @param {string} gen_finished - The finish time in ISO 8601 format.
 * @returns {number} - The difference in time in milliseconds.
 */
function calculateGenTime(gen_started, gen_finished) {
    if (gen_started === undefined || gen_finished === undefined) {
        return 0;
    }
    let startDate = new Date(gen_started);
    let endDate = new Date(gen_finished);
    return endDate.getTime() - startDate.getTime();
}

/**
 * Sends a POST request to the server to update the statistics.
 */
async function updateStats() {
    const response = await fetch('/api/stats/update', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(charStats),
    });

    if (response.status !== 200) {
        console.error('Failed to update stats');
        console.log(response.status);
    }
}

/**
 * Returns the count of words in the given string.
 * A word is a sequence of alphanumeric characters (including underscore).
 *
 * @param {string} str - The string to count words in.
 * @returns {number} - Number of words.
 */
function countWords(str) {
    const match = str.match(/\b\w+\b/g);
    return match ? match.length : 0;
}

/**
 * Handles stat processing for messages.
 *
 * @param {Object} line - Object containing message data.
 * @param {string} type - The type of the message processing (e.g., 'append', 'continue', 'appendFinal', 'swipe').
 * @param {Character[]} characters - Object containing character data.
 * @param {string} this_chid - The character id.
 * @param {string} oldMesssage - The old message that's being processed.
 */
async function statMesProcess(line, type, characters, this_chid, oldMesssage) {
    if (this_chid === undefined || characters[this_chid] === undefined) {
        return;
    }
    await getStats();

    let stats = charStats.stats[characters[this_chid].avatar] ?? createEmptyStats();

    stats.total_gen_time += calculateGenTime(line.gen_started, line.gen_finished);
    if (line.is_user) {
        if (type != 'append' && type != 'continue' && type != 'appendFinal') {
            stats.user_msg_count++;
            stats.user_word_count += countWords(line.mes);
        } else {
            let oldLen = oldMesssage.split(' ').length;
            stats.user_word_count += countWords(line.mes) - oldLen;
        }
    } else {
        // if continue, don't add a message, get the last message and subtract it from the word count of
        // the new message
        if (type != 'append' && type != 'continue' && type != 'appendFinal') {
            stats.non_user_msg_count++;
            stats.non_user_word_count += countWords(line.mes);
        } else {
            let oldLen = oldMesssage.split(' ').length;
            stats.non_user_word_count += countWords(line.mes) - oldLen;
        }
    }

    if (type === 'swipe') {
        stats.total_swipe_count++;
    }

    // If this is the first user message, set the first chat time
    if (line.is_user) {
        //get min between firstChatTime and timestampToMoment(json.send_date)
        stats.date_first_chat = Math.min(timestampToMoment(line.send_date) ?? MAX_TIMESTAMP, stats.date_first_chat);
    }

    // For last chat time, we skip the original first message and then take all user and AI messages
    if ((stats.user_msg_count + stats.non_user_msg_count) > 1) {
        stats.date_last_chat = Math.max(timestampToMoment(line.send_date) ?? MIN_TIMESTAMP, stats.date_last_chat);
    }
    updateStats();
}

export function initStats() {
    $('.rm_stats_button').on('click', function () {
        characterStatsHandler(characters, this_chid);
    });
    // Wait for debug functions to load, then add the refresh stats function
    registerDebugFunction('refreshStats', 'Refresh Stat File', 'Recreates the stats file based on existing chat files', recreateStats);
}

export { userStatsHandler, characterStatsHandler, getStats, statMesProcess, charStats };
