/**
 * Convert a prompt from the ChatML objects to the format used by Claude.
 * @param {object[]} messages Array of messages
 * @param {boolean} addHumanPrefix Add Human prefix
 * @param {boolean} addAssistantPostfix Add Assistant postfix
 * @returns {string} Prompt for Claude
 * @copyright Prompt Conversion script taken from RisuAI by kwaroran (GPLv3).
 */
function convertClaudePrompt(messages, addHumanPrefix, addAssistantPostfix) {
    // Claude doesn't support message names, so we'll just add them to the message content.
    for (const message of messages) {
        if (message.name && message.role !== "system") {
            message.content = message.name + ": " + message.content;
            delete message.name;
        }
    }

    let requestPrompt = messages.map((v) => {
        let prefix = '';
        switch (v.role) {
            case "assistant":
                prefix = "\n\nAssistant: ";
                break
            case "user":
                prefix = "\n\nHuman: ";
                break
            case "system":
                // According to the Claude docs, H: and A: should be used for example conversations.
                if (v.name === "example_assistant") {
                    prefix = "\n\nA: ";
                } else if (v.name === "example_user") {
                    prefix = "\n\nH: ";
                } else {
                    prefix = "\n\n";
                }
                break
        }
        return prefix + v.content;
    }).join('');

    if (addHumanPrefix) {
        requestPrompt = "\n\nHuman: " + requestPrompt;
    }

    if (addAssistantPostfix) {
        requestPrompt = requestPrompt + '\n\nAssistant: ';
    }

    return requestPrompt;
}

module.exports = {
    convertClaudePrompt,
}
