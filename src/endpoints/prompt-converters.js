/**
 * Convert a prompt from the ChatML objects to the format used by Claude.
 * @param {object[]} messages Array of messages
 * @param {boolean}  addAssistantPostfix Add Assistant postfix.
 * @param {string}   addAssistantPrefill Add Assistant prefill after the assistant postfix.
 * @param {boolean}  withSyspromptSupport Indicates if the Claude model supports the system prompt format.
 * @param {boolean}  useSystemPrompt Indicates if the system prompt format should be used.
 * @param {string}   addSysHumanMsg Add Human message between system prompt and assistant.
 * @returns {string} Prompt for Claude
 * @copyright Prompt Conversion script taken from RisuAI by kwaroran (GPLv3).
 */

function convertClaudePrompt(messages, addAssistantPostfix, addAssistantPrefill, withSyspromptSupport, useSystemPrompt, addSysHumanMsg) {

    // Find the index of the first message with an assistant role and check for a "'user' role/Human:" before it.
    let hasUser = false;
    const firstAssistantIndex = messages.findIndex((message) => {
        if (message.role === 'user' || message.content.includes('Human:')) {
            hasUser = true;
        }
        return message.role === 'assistant';
    });

    let setHumanMsg = addSysHumanMsg ? '\n\nHuman: ' + addSysHumanMsg : '\n\nHuman: Let\'s get started.';
    let requestPrompt = messages.map((v, i) => {
        // Claude doesn't support message names, so we'll just add them to the message content.
        if (v.name && v.role !== 'system') {
            v.content = `${v.name}: ${v.content}`;
            delete v.name;
        }

        let prefix = '';
        // Switches to system prompt format by adding empty prefix to the first message of the assistant, when the "use system prompt" checked and the model is 2.1.
        // Otherwise, use the default message format by adding "Human: " prefix to the first message(compatible with all claude models including 2.1.)
        if (i === 0) {
            prefix = withSyspromptSupport && useSystemPrompt ? '' : '\n\nHuman: ';
            // For system prompt format. If there is no message with role "user" or prefix "Human:" change the first assistant's prefix(insert the human's message).
        } else if (i === firstAssistantIndex && !hasUser && withSyspromptSupport && useSystemPrompt) {
            prefix = `${setHumanMsg}\n\nAssistant: `;
            //prefix = addSysHumanMsg ? '\n\nHuman: ' + addSysHumanMsg + '\n\nAssistant: ' : '\n\nHuman: Let\'s get started.\n\nAssistant: ';
            // Merge two messages with "\n\nHuman: " prefixes into one before the first Assistant's message. Fix messages order for default claude format when(messages > Context Size).
        } else if (i > 0 && i === firstAssistantIndex - 1 && v.role === 'user' && !(withSyspromptSupport && useSystemPrompt)) {
            prefix = '\n\nFirst message: ';
            //Define role prefixes(role : prefix). Set the correct prefix according to the role/name.
        } else {
            prefix = {
                'assistant': '\n\nAssistant: ',
                'user': '\n\nHuman: ',
                'system': v.name === 'example_assistant' ? '\n\nA: ' : v.name === 'example_user' ? '\n\nH: ' : '\n\n',
            }[v.role] || '\n\n';
        }
        return prefix + v.content;
    }).join('');

    //Add the assistant suffix(if the option unchecked), add a prefill after it(if filled). Also Add the first human message before the assistant suffix(when using sysprompt and there are no other messages with the role 'Assistant').
    requestPrompt += addAssistantPostfix ? `${withSyspromptSupport && useSystemPrompt && firstAssistantIndex === -1 ? setHumanMsg : ''}\n\nAssistant: ${addAssistantPrefill ? addAssistantPrefill : ''}` : '';

    return requestPrompt;
}

/**
 * Convert a prompt from the ChatML objects to the format used by Text Completion API.
 * @param {object[]} messages Array of messages
 * @returns {string} Prompt for Text Completion API
 */
function convertTextCompletionPrompt(messages) {
    if (typeof messages === 'string') {
        return messages;
    }

    const messageStrings = [];
    messages.forEach(m => {
        if (m.role === 'system' && m.name === undefined) {
            messageStrings.push('System: ' + m.content);
        }
        else if (m.role === 'system' && m.name !== undefined) {
            messageStrings.push(m.name + ': ' + m.content);
        }
        else {
            messageStrings.push(m.role + ': ' + m.content);
        }
    });
    return messageStrings.join('\n') + '\nassistant:';
}

module.exports = {
    convertClaudePrompt,
    convertTextCompletionPrompt,
};
