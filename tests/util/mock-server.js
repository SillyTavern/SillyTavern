import http from 'node:http';
import { readAllChunks, tryParse } from '../../src/util.js';

export class MockServer {
    /** @type {string} */
    host;
    /** @type {number} */
    port;
    /** @type {import('http').Server} */
    server;

    /**
     * Creates an instance of MockServer.
     * @param {object} [param] Options object.
     * @param {string} [param.host] The hostname or IP address to bind the server to.
     * @param {number} [param.port] The port number to listen on.
     */
    constructor({ host, port } = {}) {
        this.host = host ?? '127.0.0.1';
        this.port = port ?? 3000;
    }

    /**
     * Handles Chat Completions requests.
     * @param {object} jsonBody The parsed JSON body from the request.
     * @returns {object} Mock response object.
     */
    handleChatCompletions(jsonBody) {
        const messages = jsonBody?.messages;
        const lastMessage = messages?.[messages.length - 1];
        const mockResponse = {
            choices: [
                {
                    finish_reason: 'stop',
                    index: 0,
                    message: {
                        role: 'assistant',
                        reasoning_content: `${jsonBody?.model}\n${messages?.length}\n${jsonBody?.max_tokens}`,
                        content: String(lastMessage?.content ?? 'No prompt messages.'),
                    },
                },
            ],
            created: 0,
            model: jsonBody?.model,
        };
        return mockResponse;
    }

    /**
     * Starts the mock server.
     * @returns {Promise<void>}
     */
    async start() {
        return new Promise((resolve, reject) => {
            this.server = http.createServer(async (req, res) => {
                try {
                    const body = await readAllChunks(req);
                    const jsonBody = tryParse(body.toString());
                    if (req.method === 'POST' && req.url === '/v1/chat/completions') {
                        const mockResponse = this.handleChatCompletions(jsonBody);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(mockResponse));
                    } else {
                        res.writeHead(404);
                        res.end();
                    }
                } catch (error) {
                    res.writeHead(500);
                    res.end();
                }
            });

            this.server.on('error', (err) => {
                reject(err);
            });

            this.server.listen(this.port, this.host, () => {
                resolve();
            });
        });
    }

    /**
     * Stops the mock server.
     * @returns {Promise<void>}
     */
    async stop() {
        return new Promise((resolve, reject) => {
            if (!this.server) {
                return reject(new Error('Server is not running.'));
            }
            this.server.closeAllConnections();
            this.server.close(( /** @type {NodeJS.ErrnoException|undefined} */ err) => {
                if (err && (err?.code !== 'ERR_SERVER_NOT_RUNNING')) {
                    return reject(err);
                }
                resolve();
            });
        });
    }
}
