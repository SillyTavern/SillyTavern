import { substituteParams } from "../../../script.js";
import { getApiUrl, getContext } from "../../extensions.js";
import { stringFormat } from "../../utils.js";

// Wraps a string into monospace font-face span
const m = x => `<span class="monospace">${x}</span>`;
// Joins an array of strings with ' / '
const j = a => a.join(' / ');

const generationMode = {
    CHARACTER: 0,
    USER: 1,
    SCENARIO: 2,
    FREE: 3,
}

const triggerWords = {
    [generationMode.CHARACTER]: ['yourself', 'you', 'bot', 'AI', 'character'],
    [generationMode.USER]: ['me', 'user', 'myself'],
    [generationMode.SCENARIO]: ['scenario', 'world', 'surroundings', 'scenery'],
}

const quietPrompts = {
    [generationMode.CHARACTER]: "Please provide a detailed description of {{char}}'s appearance",
    [generationMode.USER]: "Please provide a detailed description of {{user}}'s appearance",
    [generationMode.SCENARIO]: 'Please provide a detailed description of your surroundings and what you are doing right now',
    [generationMode.FREE]: 'Please provide a detailed and vivid description of {0}',
}


const helpString = [
    `${m('what')} – requests an SD generation. Supported "what" arguments:`,
    '<ul>',
    `<li>${m(j(triggerWords[generationMode.CHARACTER]))} – AI character image</li>`,
    `<li>${m(j(triggerWords[generationMode.USER]))} – user character image</li>`,
    `<li>${m(j(triggerWords[generationMode.SCENARIO]))} – world scenario image</li>`,
    '</ul>',
    `Anything else would trigger a "free mode" with AI describing whatever you prompted.`
].join('<br>');

function getGenerationType(prompt) {
    for (const [key, values] of Object.entries(triggerWords)) {
        for (const value of values) {
            if (value.toLowerCase() === prompt.toLowerCase().trim()) {
                return key;
            }
        }
    }

    return generationMode.FREE;
}

function getQuietPrompt(mode, trigger) {
    return substituteParams(stringFormat(quietPrompts[mode], trigger));
}

function processReply(str) {
    str = str.replaceAll('"', '')
    str = str.replaceAll('“', '')
    str = str.replaceAll('\n', ' ')
    str = str.trim();

    return str;
}

async function generatePicture(_, trigger) {
    if (!trigger || trigger.trim().length === 0) {
        console.log('Trigger word empty, aborting');
        return;
    }

    trigger = trigger.trim();
    const generationMode = getGenerationType(trigger);
    console.log('Generation mode', generationMode, 'triggered with', trigger);
    const quiet_prompt = getQuietPrompt(generationMode, trigger);
    const context = getContext();

    try {
        const prompt = processReply(await new Promise(
            async function promptPromise(resolve, reject) {
                try {
                    await context.generate('quiet', { resolve, reject, quiet_prompt });
                }
                catch {
                    reject();
                }
            }));

        context.deactivateSendButtons();

        const url = new URL(getApiUrl());
        url.pathname = '/api/image';
        const result = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Bypass-Tunnel-Reminder': 'bypass',
            },
            body: JSON.stringify({ prompt: prompt })
        });

        if (result.ok) {
            const data = await result.json();
            const base64Image = `data:image/jpeg;base64,${data.image}`;
            sendMessage(prompt, base64Image);
        }
    } catch {
        throw new Error('SD prompt text generation failed.')
    }
    finally {
        context.activateSendButtons();
    }
}

async function sendMessage(prompt, image) {
    const context = getContext();
    const messageText = `[${context.name2} sends a picture that contains: ${prompt}]`;
    const message = {
        name: context.name2,
        is_user: false,
        is_name: true,
        send_date: Date.now(),
        mes: messageText,
        extra: {
            image: image,
            title: prompt,
        },
    };
    context.chat.push(message);
    context.addOneMessage(message);
    context.saveChat();
}

jQuery(() => {
    getContext().registerSlashCommand('sd', generatePicture, ['picture', 'image'], helpString, true, true);
});