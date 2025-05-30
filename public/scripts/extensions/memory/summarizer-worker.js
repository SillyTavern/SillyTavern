self.onmessage = async function(e) {
    const { chatMessages, latestSummary, config } = e.data;
    let rawPrompt = '';
    let lastUsedIndex = -1; // Index in the original full chat array
    const chatBuffer = [];

    // Simplified token counting based on average characters per token
    const estimateTokenCount = (text) => Math.ceil((text || '').length / config.averageCharsPerToken);

    function getCurrentPromptContent(includeSystem) {
        const bufferString = chatBuffer.join(config.delimiter);
        let content = latestSummary ? latestSummary + config.delimiter + bufferString : bufferString;
        if (includeSystem) {
            content = config.prompt + config.delimiter + content;
        }
        return content.trim();
    }

    for (let i = 0; i < chatMessages.length; i++) {
        const message = chatMessages[i]; // These are pre-filtered messages

        if (!message || message.is_system || !message.mes) {
            continue;
        }

        const entry = `${message.name}:\n${message.mes}`;
        chatBuffer.push(entry);

        const currentFullPromptEstimate = getCurrentPromptContent(true);
        const tokens = estimateTokenCount(currentFullPromptEstimate) + config.padding;

        if (tokens > config.promptSizeLimit) {
            chatBuffer.pop(); // Remove the last added message as it exceeds the limit
            break;
        }

        lastUsedIndex = message.originalIndex; // Assume originalIndex is passed with each message

        if (config.maxMessagesPerRequest > 0 && chatBuffer.length >= config.maxMessagesPerRequest) {
            break;
        }
    }

    rawPrompt = getCurrentPromptContent(false); // System prompt is not part of rawPrompt for API
    self.postMessage({ rawPrompt, lastUsedIndex });
};
