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

    const data = await response.json();
    return data;

}

export { userStatsHandler, characterStatsHandler, getStats };
