import { getRequestHeaders } from '../script.js';

/**
 * A client for interacting with MCP servers via SSE.
 */
export class McpSseClient {
    /**
     * The URL of the MCP server.
     * @type {string}
     */
    #url;

    /**
     * The EventSource connection to the MCP server.
     * @type {EventSource|null}
     */
    #eventSource = null;

    /**
     * A map of pending requests.
     * @type {Map<number, {resolve: Function, reject: Function, timeoutId: ReturnType<typeof setTimeout>}>}
     */
    #pendingRequests = new Map();

    /**
     * The request timeout in milliseconds.
     * @type {number}
     */
    #requestTimeout = 30000;

    /**
     * Client information for MCP server.
     * @type {object}
     */
    #clientInfo = {
        name: 'sillytavern-client',
        version: '1.0.0',
    };

    /**
     * Client capabilities for MCP server.
     * @type {object}
     */
    #capabilities = {
        prompts: {},
        resources: {},
        tools: {},
    };

    /**
     * Protocol version for MCP server.
     * @type {string}
     */
    #protocolVersion = '2024-11-05';

    /**
     * Creates a new McpSseClient.
     * @param {string} url The URL of the MCP server.
     */
    constructor(url) {
        this.#url = url;
    }

    /**
     * Connects to the MCP server.
     * @returns {Promise<boolean>} Whether the connection was successful.
     */
    async connect() {
        try {
            if (this.#eventSource) {
                console.log('[McpSseClient] Already connected');
                return true;
            }

            console.log(`[McpSseClient] Connecting to ${this.#url}`);

            // Create a new EventSource connection
            this.#eventSource = new EventSource(this.#url);

            // Set up event handlers
            this.#eventSource.onopen = () => {
                console.log('[McpSseClient] Connection opened');
            };

            this.#eventSource.onerror = (error) => {
                console.error('[McpSseClient] Connection error:', error);
                this.close();
            };

            this.#eventSource.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    console.log('[McpSseClient] Received message:', message);

                    // Check if this is a response to a pending request
                    if (message.jsonrpc === '2.0' && message.id !== undefined) {
                        const pendingRequest = this.#pendingRequests.get(message.id);
                        if (pendingRequest) {
                            // Clear the timeout
                            if (pendingRequest.timeoutId) {
                                clearTimeout(pendingRequest.timeoutId);
                            }

                            // Resolve or reject the promise
                            if (message.error) {
                                pendingRequest.reject(new Error(`JSON-RPC error ${message.error.code}: ${message.error.message}`));
                            } else {
                                pendingRequest.resolve(message);
                            }

                            // Remove from pending requests
                            this.#pendingRequests.delete(message.id);
                        }
                    }
                } catch (error) {
                    console.error('[McpSseClient] Error parsing message:', error);
                }
            };

            // Send initialization message
            await this.sendJsonRpcRequest('initialize', {
                clientInfo: {
                    name: 'sillytavern-client',
                    version: '1.0.0',
                },
                capabilities: {
                    prompts: {},
                    resources: {},
                    tools: {},
                },
                protocolVersion: '2024-11-05',
            }, true);

            return true;
        } catch (error) {
            console.error('[McpSseClient] Error connecting:', error);
            return false;
        }
    }

    /**
     * Closes the connection to the MCP server.
     */
    close() {
        if (!this.#eventSource) {
            return;
        }

        try {
            // Send shutdown request
            this.sendJsonRpcRequest('shutdown', {}, true).catch(error => {
                console.error('[McpSseClient] Error sending shutdown request:', error);
            });

            // Close the EventSource connection
            this.#eventSource.close();
            this.#eventSource = null;

            // Reject all pending requests
            for (const [id, pendingRequest] of this.#pendingRequests.entries()) {
                if (pendingRequest.timeoutId) {
                    clearTimeout(pendingRequest.timeoutId);
                }
                pendingRequest.reject(new Error('Connection closed'));
                this.#pendingRequests.delete(id);
            }

            console.log('[McpSseClient] Connection closed');
        } catch (error) {
            console.error('[McpSseClient] Error closing connection:', error);
        }
    }

    /**
     * Sends a JSON-RPC request to the MCP server.
     * @param {string} method Method name
     * @param {object} params Method parameters
     * @param {boolean} [ignoreConnectionCheck=false] Whether to ignore the connection check
     * @returns {Promise<any>} Response from the server
     */
    async sendJsonRpcRequest(method, params, ignoreConnectionCheck = false) {
        if (!ignoreConnectionCheck && !this.#eventSource) {
            throw new Error('Not connected');
        }

        const request = {
            jsonrpc: '2.0',
            id: Date.now(),
            method,
            params,
        };

        return new Promise((resolve, reject) => {
            try {
                // For initialization and shutdown, we don't need to wait for a response
                const isSpecialMethod = method === 'initialize' || method === 'shutdown';

                // Send the request via fetch
                (async () => {
                    try {
                        const url = new URL(this.#url);
                        const response = await fetch(`${url.origin}${url.pathname}`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                ...getRequestHeaders(),
                            },
                            body: JSON.stringify(request),
                        });

                        if (!response.ok) {
                            throw new Error(`HTTP error! status: ${response.status}`);
                        }

                        // For special methods, resolve immediately
                        if (isSpecialMethod) {
                            resolve({
                                jsonrpc: '2.0',
                                id: request.id,
                                result: { success: true },
                            });
                            return;
                        }

                        // For regular methods, store the request and wait for a response via EventSource
                        // Set up timeout
                        const timeoutId = setTimeout(() => {
                            if (this.#pendingRequests.has(request.id)) {
                                this.#pendingRequests.delete(request.id);
                                reject(new Error(`Request timed out after ${this.#requestTimeout}ms`));
                            }
                        }, this.#requestTimeout);

                        // Store the request
                        this.#pendingRequests.set(request.id, { resolve, reject, timeoutId });

                    } catch (error) {
                        console.error('[McpSseClient] Error sending request:', error);

                        // Clean up the pending request
                        if (this.#pendingRequests.has(request.id)) {
                            const pendingRequest = this.#pendingRequests.get(request.id);
                            if (pendingRequest.timeoutId) {
                                clearTimeout(pendingRequest.timeoutId);
                            }
                            this.#pendingRequests.delete(request.id);
                        }

                        reject(error);
                    }
                })();
            } catch (error) {
                console.error('[McpSseClient] Error preparing request:', error);
                reject(error);
            }
        });
    }

    /**
     * Lists tools available from the MCP server.
     * @returns {Promise<{tools: Array<object>}>} List of tools
     */
    async listTools() {
        try {
            const response = await this.sendJsonRpcRequest('tools/list', {});
            return response.result || { tools: [] };
        } catch (error) {
            console.error('[McpSseClient] Error listing tools:', error);
            throw error;
        }
    }

    /**
     * Calls a tool on the MCP server.
     * @param {object} params Tool parameters
     * @param {string} params.name Tool name
     * @param {object} params.arguments Tool arguments
     * @returns {Promise<any>} Tool result
     */
    async callTool(params) {
        try {
            const response = await this.sendJsonRpcRequest('tools/call', params);
            return response.result;
        } catch (error) {
            console.error('[McpSseClient] Error calling tool:', error);
            throw error;
        }
    }

    /**
     * Lists resources available from the MCP server.
     * @returns {Promise<{resources: Array<object>}>} List of resources
     */
    async listResources() {
        try {
            const response = await this.sendJsonRpcRequest('resources/list', {});
            return response.result || { resources: [] };
        } catch (error) {
            console.error('[McpSseClient] Error listing resources:', error);
            throw error;
        }
    }

    /**
     * Lists resource templates available from the MCP server.
     * @returns {Promise<{resourceTemplates: Array<object>}>} List of resource templates
     */
    async listResourceTemplates() {
        try {
            const response = await this.sendJsonRpcRequest('resources/list-templates', {});
            return response.result || { resourceTemplates: [] };
        } catch (error) {
            console.error('[McpSseClient] Error listing resource templates:', error);
            throw error;
        }
    }

    /**
     * Reads a resource from the MCP server.
     * @param {string} uri Resource URI
     * @returns {Promise<{contents: Array<{uri: string, mimeType: string, text: string}>}>} Resource contents
     */
    async readResource(uri) {
        try {
            const response = await this.sendJsonRpcRequest('resources/read', { uri });
            return response.result || { contents: [] };
        } catch (error) {
            console.error('[McpSseClient] Error reading resource:', error);
            throw error;
        }
    }
}
