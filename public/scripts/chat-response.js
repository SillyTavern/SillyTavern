/**
 * An error returned while loading a chat from the server.
 */
export class ChatLoadError extends Error {
    /**
     * @param {string} message Error message.
     * @param {object} [options] Error details.
     * @param {number} [options.status] HTTP response status.
     * @param {string} [options.serverMessage] Stable error message returned by the server.
     * @param {unknown} [options.cause] Original parsing error.
     */
    constructor(message, { status, serverMessage, cause } = {}) {
        super(message, { cause });
        this.name = 'ChatLoadError';
        this.status = status;
        this.serverMessage = serverMessage;
    }
}

/**
 * Parses and validates a chat endpoint response.
 * Successful chat responses must contain a JSON array. Error responses use a
 * JSON `error` string when available and otherwise fall back to HTTP status data.
 * @param {Response} response Chat endpoint response.
 * @returns {Promise<Array>} Parsed chat records.
 * @throws {ChatLoadError} If the request failed or the success body is not a JSON array.
 */
export async function parseChatResponse(response) {
    let data;
    try {
        data = await response.json();
    } catch (error) {
        const serverMessage = response.statusText || `HTTP ${response.status}`;
        throw new ChatLoadError(`Chat response was not valid JSON: ${response.status} ${serverMessage}`, {
            status: response.status,
            serverMessage,
            cause: error,
        });
    }

    if (!response.ok) {
        const serverMessage = typeof data?.error === 'string' && data.error
            ? data.error
            : response.statusText || `HTTP ${response.status}`;
        throw new ChatLoadError(`Chat could not be loaded: ${response.status} ${serverMessage}`, {
            status: response.status,
            serverMessage,
        });
    }

    if (!Array.isArray(data)) {
        throw new ChatLoadError(`Chat response was not an array: HTTP ${response.status}`, {
            status: response.status,
            serverMessage: 'Invalid chat response.',
        });
    }

    return data;
}
