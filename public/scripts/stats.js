// statsHelper.js
import { getRequestHeaders, callPopup, token  } from '../script.js';
import { humanizeGenTime } from './RossAscends-mods.js';



// Function for creating stat block HTML
function createStatBlock(statName, statValue) {
    return `<div class="rm_stat_block">
                <div class="rm_stat_name">${statName}:</div>
                <div class="rm_stat_value">${statValue}</div>
            </div>`;
}

function calculateTotal(stat) {
    return isNaN(stat) ? 0 : stat;
}

function calculateTotalStats(charStats) {
    let totalStats = {
        total_gen_time: 0,
        user_msg_count: 0,
        non_user_msg_count: 0,
        user_word_count: 0,
        non_user_word_count: 0,
        total_swipe_count: 0
    };

    for (let stats of Object.values(charStats)) {
        totalStats.total_gen_time += calculateTotal(stats.total_gen_time);
        totalStats.user_msg_count += calculateTotal(stats.user_msg_count);
        totalStats.non_user_msg_count += calculateTotal(stats.non_user_msg_count);
        totalStats.user_word_count += calculateTotal(stats.user_word_count);
        totalStats.non_user_word_count += calculateTotal(stats.non_user_word_count);
        totalStats.total_swipe_count += calculateTotal(stats.total_swipe_count);
    }

    return totalStats;
}

function createHtml(statsType, stats) {
    // Get time string
    let timeStirng = humanizeGenTime(stats.total_gen_time);

    // Create popup HTML with stats
    let html = `<h3>${statsType} Stats</h3>`;
    html += createStatBlock('Chat Time', timeStirng);
    html += createStatBlock('Total User Messages', stats.user_msg_count);
    html += createStatBlock('Total Character Messages', stats.non_user_msg_count);
    html += createStatBlock('Total User Words', stats.user_word_count);
    html += createStatBlock('Total Character Words', stats.non_user_word_count);
    html += createStatBlock('Swipes', stats.total_swipe_count);

    callPopup(html, 'text');
}

async function userStatsHandler(charStats) {
    // Get stats from server
    let stats = await getStats(charStats);

    // Calculate total stats
    let totalStats = calculateTotalStats(stats);
    console.log(totalStats);

    // Create HTML with stats
    createHtml('User', totalStats);
}

async function characterStatsHandler(charStats, characters, this_chid) {
    // Get stats from server
    let stats = await getStats(charStats);

    // Get character stats
    let myStats = stats[characters[this_chid].avatar];

    // Create HTML with stats
    createHtml('Character', myStats);
}

async function getStats(charStats) {
    const response = await fetch("/getstats", {
        method: "POST",
        headers: getRequestHeaders(),
        body: JSON.stringify({}),
        cache: "no-cache",
    });

    if (!response.ok) {
        toastr.error('Stats could not be loaded. Try reloading the page.');
        throw new Error('Error getting stats');
    }
    charStats = await response.json();
    return charStats;

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

async function updateStats(stats) {
    const response = await fetch('/updatestats', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(stats),

    });

    if (response.status !== 200) {
        console.error('Failed to update stats');
        console.log(response).status;
    }
}


async function statMesProcess(line, type, characters, this_chid, charStats, oldMesssage) {
    console.log(type);
    if (this_chid === undefined) {
        console.log(charStats);
        return;
    }
    let stats = await getStats(charStats);
    let stat = stats[characters[this_chid].avatar];
    console.log(stat); // add this line to check the value of stat

    stat.total_gen_time += calculateGenTime(line.gen_started, line.gen_finished);
    if (line.is_user) {
        if (type != 'append' && type != 'continue' && type != 'appendFinal') {
            stat.user_msg_count++;
            stat.user_word_count += line.mes.split(' ').length;
        }
        else{
            let oldLen = oldMesssage.split(' ').length;
            console.log(`Subtracting ${oldLen} from ${line.mes.split(' ').length}`);
            stat.user_word_count += line.mes.split(' ').length - oldLen;
        }
    }
    else {
        // if continue, don't add a message, get the last message and subtract it from the word count of 
        // the new message
        if (type != 'append' && type != 'continue' && type != 'appendFinal') {
            stat.non_user_msg_count++;
            stat.non_user_word_count += line.mes.split(' ').length;
        }
        else{
            let oldLen = oldMesssage.split(' ').length;
            console.log(`Subtracting ${oldLen} from ${line.mes.split(' ').length}`);
            stat.non_user_word_count += line.mes.split(' ').length - oldLen;
        }
    }



    if (type === 'swipe') {
        stat.total_swipe_count++;
    }
    stat.date_last_chat = Date.now();
    updateStats(stats);
}


export { userStatsHandler, characterStatsHandler, getStats, statMesProcess };
