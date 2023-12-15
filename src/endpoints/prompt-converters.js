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

    console.log(JSON.stringify(messages, null, 2));
    //Prepare messages for claude.
    if (messages.length > 0) {
        //Add the assistant's message to the end of messages.
        if (addAssistantPostfix) {
            messages.push({
                role: 'assistant',
                content: addAssistantPrefill || '',
            });
        }
        // Find the index of the first message with an assistant role and check for a "'user' role/Human:" before it.
        let hasUser = false;
        const firstAssistantIndex = messages.findIndex((message, i) => {
            if (i > 0 && (message.role === 'user' || message.content.includes('Human:'))) {
                hasUser = true;
            }
            return message.role === 'assistant' && i > 0;
        });
        // When 2.1 and 'Use system prompt" checked, switches to system prompt format by setting the first message's role to 'system'.
        // Also, insert the human's message before the first the assistant one, in case there are no such message or prefix found.
        if (withSyspromptSupport && useSystemPrompt) {
            messages[0].role = 'system';
            if (firstAssistantIndex > 0 && !hasUser) {
                messages.splice(firstAssistantIndex, 0, {
                    role: 'user',
                    content: addSysHumanMsg || 'Let\'s get started.',
                });
            }
        } else {
            // Otherwise, use the default message format by setting the first message's role to 'user'(compatible with all claude models including 2.1.)
            messages[0].role = 'user';
            // Also, fix messages order for default claude format when(messages > Context Size) by merging two messages with "\n\nHuman: " prefixes into one before the first Assistant's message.
            if (firstAssistantIndex > 0) {
                messages[firstAssistantIndex - 1].role = firstAssistantIndex - 1 !== 0 && messages[firstAssistantIndex - 1].role === 'user' ? 'firstMsg' : messages[firstAssistantIndex - 1].role;
            }
        }
    }

    console.log(JSON.stringify(messages, null, 2));
    // Convert messages to requestPrompt.
    let requestPrompt = messages.map((v, i) => {
        // Claude doesn't support message names, so we'll just add them to the message content.
        if (v.name && v.role !== 'system') {
            v.content = `${v.name}: ${v.content}`;
            delete v.name;
        }

        let prefix = '';
        prefix = {
            'assistant': '\n\nAssistant: ',
            'user': '\n\nHuman: ',
            'system': i === 0 ? '' : v.name === 'example_assistant' ? '\n\nA: ' : v.name === 'example_user' ? '\n\nH: ' : '\n\n',
            'firstMsg': '\n\nFirst message: ',
        }[v.role] ?? '\n\n';
        //}
        return prefix + v.content;
    }).join('');

    return requestPrompt;
}

/**
 * Convert a prompt from the ChatML objects to the format used by Google MakerSuite models.
 * @param {object[]} messages Array of messages
 * @param {string} model Model name
 * @returns {object[]} Prompt for Google MakerSuite models
 */
function convertGooglePrompt(messages, model) {
    // This is a 1x1 transparent PNG
    const PNG_PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const contents = [];
    let lastRole = '';
    let currentText = '';

    const isMultimodal = model === 'gemini-pro-vision';

    if (isMultimodal) {
        const combinedText = messages.map((message) => {
            const role = message.role === 'assistant' ? 'MODEL: ' : 'USER: ';
            return role + message.content;
        }).join('\n\n').trim();

        const imageEntry = messages.find((message) => message.content?.[1]?.image_url);
        const imageData = imageEntry?.content?.[1]?.image_url?.data ?? PNG_PIXEL;
        contents.push({
            parts: [
                { text: combinedText },
                {
                    inlineData: {
                        mimeType: 'image/png',
                        data: imageData,
                    },
                },
            ],
            role: 'user',
        });
    } else {
        messages.forEach((message, index) => {
            const role = message.role === 'assistant' ? 'model' : 'user';
            if (lastRole === role) {
                currentText += '\n\n' + message.content;
            } else {
                if (currentText !== '') {
                    contents.push({
                        parts: [{ text: currentText.trim() }],
                        role: lastRole,
                    });
                }
                currentText = message.content;
                lastRole = role;
            }
            if (index === messages.length - 1) {
                contents.push({
                    parts: [{ text: currentText.trim() }],
                    role: lastRole,
                });
            }
        });
    }

    return contents;
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
    convertGooglePrompt,
    convertTextCompletionPrompt,
};
