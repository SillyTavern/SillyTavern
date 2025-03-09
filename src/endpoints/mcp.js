import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { URL } from 'node:url';

import express from 'express';
import { sync as writeFileAtomicSync } from 'write-file-atomic';
import { jsonParser } from '../express-common.js';

import { getUserDirectories } from '../users.js';
import { DEFAULT_USER } from '../constants.js';

export const MCP_SETTINGS_FILE = 'mcp_settings.json';

/** @type {Map<string, McpJsonRpcClient>} */
const mcpClients = new Map();

/**
 * Reads MCP settings from the settings file
 * @param {import('../users.js').UserDirectoryList} directories User directories
 * @returns {object} MCP settings
 */
export function readMcpSettings(directories) {
    const filePath = path.join(directories.root, MCP_SETTINGS_FILE);

    if (!fs.existsSync(filePath)) {
        const defaultSettings = { mcpServers: {} };
        writeFileAtomicSync(filePath, JSON.stringify(defaultSettings, null, 4), 'utf-8');
        return defaultSettings;
    }

    const fileContents = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(fileContents);
}

/**
 * Writes MCP settings to the settings file
 * @param {import('../users.js').UserDirectoryList} directories User directories
 * @param {object} settings MCP settings
 */
export function writeMcpSettings(directories, settings) {
    const filePath = path.join(directories.root, MCP_SETTINGS_FILE);
    writeFileAtomicSync(filePath, JSON.stringify(settings, null, 4), 'utf-8');
}

/**
 * JSON-RPC client for MCP communication
 */
class McpJsonRpcClient {
    /**
     * @param {object} clientInfo Client metadata
     * @param {string} clientInfo.name Client name
     * @param {string} clientInfo.version Client version
     * @param {object} capabilities Client capabilities
     */
    constructor(clientInfo, capabilities) {
        this.clientInfo = clientInfo;
        this.capabilities = capabilities;
        this.transport = null;
        this.connected = false;
        this.requestId = 1;
        this.childProcess = null;
        this.eventSource = null;
        this.protocolVersion = '2024-11-05'; // Latest protocol version

        // Map to store pending requests
        this.pendingRequests = new Map();

        // Request timeout in milliseconds
        this.requestTimeout = 30000;
    }

    /**
     * Connect to an MCP server using the specified transport
     * @param {object} transportConfig Transport configuration
     * @returns {Promise<void>}
     */
    async connect(transportConfig) {
        if (this.connected) {
            throw new Error('Client is already connected');
        }

        this.transport = transportConfig;

        if (transportConfig.type === 'stdio') {
            await this.connectStdio(transportConfig);
        } else if (transportConfig.type === 'sse') {
            await this.connectSse(transportConfig);
        } else {
            throw new Error(`Unsupported transport type: ${transportConfig.type}`);
        }

        // Set connected to true after successful connection
        this.connected = true;
    }

    /**
     * Connect to an MCP server using stdio transport
     * @param {object} config Transport configuration
     * @returns {Promise<void>}
     */
    async connectStdio(config) {
        const env = { ...process.env, ...config.env };
        let command = config.command || '';
        let args = config.args || [];

        if (!command) {
            throw new Error('Command is required for stdio transport');
        }

        // Windows-specific fix: Wrap the command in cmd /C to ensure proper path resolution
        if (process.platform === 'win32' && !command.toLowerCase().includes('cmd')) {
            const originalCommand = command;
            const originalArgs = [...args];
            command = 'cmd';
            args = ['/C', originalCommand, ...originalArgs];
            console.log(`[MCP] Windows detected, wrapping command: cmd /C ${originalCommand} ${originalArgs.join(' ')}`);
        }

        return new Promise((resolve, reject) => {
            try {
                this.childProcess = spawn(command, args, {
                    env,
                    stdio: ['pipe', 'pipe', 'pipe'],
                });

                this.childProcess.on('error', (error) => {
                    console.error('[MCP] Child process error:', error);
                    this.connected = false;
                    reject(error);
                });

                this.childProcess.on('exit', (code, signal) => {
                    console.log(`[MCP] Child process exited with code ${code} and signal ${signal}`);
                    this.connected = false;
                });

                // Buffer for incomplete data
                let buffer = '';

                this.childProcess.stdout.on('data', (data) => {
                    const text = data.toString();
                    buffer += text;

                    // Try to parse complete JSON objects
                    let newlineIndex;
                    while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
                        const line = buffer.substring(0, newlineIndex);
                        buffer = buffer.substring(newlineIndex + 1);

                        if (line.trim()) {
                            try {
                                const message = JSON.parse(line);
                                console.log('[MCP] Received message:', message);

                                // Check if this is a response to a pending request
                                if (message.jsonrpc === '2.0' && message.id !== undefined) {
                                    const pendingRequest = this.pendingRequests.get(message.id);
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
                                        this.pendingRequests.delete(message.id);
                                    }
                                }
                            } catch (error) {
                                console.error('[MCP] Error parsing JSON:', error, 'Line:', line);
                            }
                        }
                    }
                });

                this.childProcess.stderr.on('data', (data) => {
                    console.error(`[MCP] stderr: ${data.toString()}`);
                });

                // Send initialization message with ignoreConnectionCheck=true
                this.sendJsonRpcRequest('initialize', {
                    clientInfo: this.clientInfo,
                    capabilities: this.capabilities,
                    protocolVersion: this.protocolVersion,
                }, true);

                // Wait a bit to ensure the server has started
                setTimeout(() => resolve(), 500);
            } catch (error) {
                console.error('[MCP] Error spawning child process:', error);
                reject(error);
            }
        });
    }

    /**
     * Connect to an MCP server using SSE transport
     * @param {object} config Transport configuration
     * @returns {Promise<void>}
     */
    async connectSse(config) {
        if (!config.url) {
            throw new Error('URL is required for SSE transport');
        }

        // For SSE transport, we just mark the connection as established
        // The actual SSE connection will be handled by the frontend
        this.connected = true;
        console.log('[MCP] SSE transport configured, connection will be handled by frontend');

        // Send initialization message via POST with ignoreConnectionCheck=true
        try {
            await this.sendJsonRpcRequest('initialize', {
                clientInfo: this.clientInfo,
                capabilities: this.capabilities,
                protocolVersion: this.protocolVersion,
            }, true);
        } catch (error) {
            console.error('[MCP] Error sending initialization message:', error);
            throw error;
        }

        return Promise.resolve();
    }

    /**
     * Send a JSON-RPC request to the MCP server
     * @param {string} method Method name
     * @param {object} params Method parameters
     * @param {boolean} [ignoreConnectionCheck=false] Whether to ignore the connection check
     * @returns {Promise<any>} Response from the server
     */
    async sendJsonRpcRequest(method, params, ignoreConnectionCheck = false) {
        if (!ignoreConnectionCheck && !this.connected) {
            throw new Error('Client is not connected');
        }

        const request = {
            jsonrpc: '2.0',
            id: this.requestId++,
            method,
            params,
        };

        return new Promise(async (resolve, reject) => {
            try {
                // For initialization and shutdown, we don't need to wait for a response
                const isSpecialMethod = method === 'initialize' || method === 'shutdown';

                if (this.transport.type === 'stdio' && this.childProcess) {
                    const requestStr = JSON.stringify(request) + '\n';

                    // Store the request in pendingRequests if it's not a special method
                    if (!isSpecialMethod) {
                        // Set up timeout
                        const timeoutId = setTimeout(() => {
                            if (this.pendingRequests.has(request.id)) {
                                this.pendingRequests.delete(request.id);
                                reject(new Error(`Request timed out after ${this.requestTimeout}ms`));
                            }
                        }, this.requestTimeout);

                        // Store the request
                        this.pendingRequests.set(request.id, { resolve, reject, timeoutId });
                    }

                    // Send the request
                    this.childProcess.stdin.write(requestStr, (error) => {
                        if (error) {
                            console.error('[MCP] Error writing to stdin:', error);

                            // Clean up the pending request
                            if (!isSpecialMethod && this.pendingRequests.has(request.id)) {
                                const pendingRequest = this.pendingRequests.get(request.id);
                                if (pendingRequest.timeoutId) {
                                    clearTimeout(pendingRequest.timeoutId);
                                }
                                this.pendingRequests.delete(request.id);
                            }

                            reject(error);
                        } else if (isSpecialMethod) {
                            // For special methods, resolve immediately
                            resolve({
                                jsonrpc: '2.0',
                                id: request.id,
                                result: { success: true },
                            });
                        }
                    });
                } else if (this.transport.type === 'sse') {
                    // For SSE transport, we only handle special methods (initialize, shutdown) directly
                    // Regular methods will be handled by the frontend
                    if (isSpecialMethod) {
                        try {
                            const url = new URL(this.transport.url);
                            const response = await fetch(`${url.origin}${url.pathname}`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify(request),
                            });

                            if (!response.ok) {
                                throw new Error(`HTTP error! status: ${response.status}`);
                            }

                            // For special methods, resolve immediately
                            resolve({
                                jsonrpc: '2.0',
                                id: request.id,
                                result: { success: true },
                            });
                        } catch (error) {
                            console.error('[MCP] Error sending request via fetch:', error);
                            reject(error);
                        }
                    } else {
                        // For regular methods, we'll just resolve with a message indicating
                        // that the request should be handled by the frontend
                        console.log('[MCP] SSE request will be handled by frontend:', request);
                        resolve({
                            jsonrpc: '2.0',
                            id: request.id,
                            result: {
                                handled_by_frontend: true,
                                request: request,
                            },
                        });
                    }
                } else {
                    reject(new Error('No valid transport available'));
                }
            } catch (error) {
                console.error('[MCP] Error sending JSON-RPC request:', error);
                reject(error);
            }
        });
    }

    /**
     * List tools available from the MCP server
     * @returns {Promise<{tools: Array<object>}>} List of tools
     */
    async listTools() {
        try {
            const response = await this.sendJsonRpcRequest('tools/list', {});
            return response.result || { tools: [] };
        } catch (error) {
            console.error('[MCP] Error listing tools:', error);
            throw error;
        }
    }

    /**
     * Call a tool on the MCP server
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
            console.error('[MCP] Error calling tool:', error);
            throw error;
        }
    }

    /**
     * Close the connection to the MCP server
     * @returns {Promise<void>}
     */
    async close() {
        if (!this.connected) {
            return;
        }

        try {
            // Send shutdown request
            await this.sendJsonRpcRequest('shutdown', {}, true);

            if (this.childProcess) {
                // Give the process a chance to exit gracefully
                setTimeout(() => {
                    if (this.childProcess) {
                        this.childProcess.kill();
                    }
                }, 1000);
            }

            if (this.eventSource) {
                this.eventSource.close();
            }
        } catch (error) {
            console.error('[MCP] Error closing connection:', error);
        } finally {
            this.connected = false;
            this.childProcess = null;
            this.eventSource = null;
        }
    }
}

/**
 * Starts an MCP server process and connects to it using JSON-RPC
 * @param {string} serverName Name of the server
 * @param {object} config Server configuration
 * @param {string} config.type Transport type ('stdio' or 'sse')
 * @param {string} [config.command] Command to execute (for stdio transport)
 * @param {string[]} [config.args] Arguments to pass to the command (for stdio transport)
 * @param {object} [config.env] Environment variables to set (for stdio transport)
 * @param {string} [config.url] URL to connect to (for sse transport)
 * @returns {Promise<boolean>} Whether the server was started successfully
 */
async function startMcpServer(serverName, config) {
    if (mcpClients.has(serverName)) {
        console.warn(`[MCP] Server "${serverName}" is already running`);
        return true;
    }

    try {
        // Create a JSON-RPC client
        const client = new McpJsonRpcClient(
            {
                name: 'sillytavern-client',
                version: '1.0.0',
            },
            {
                prompts: {},
                resources: {},
                tools: {},
            },
        );

        // Set the transport type in the config
        const transportConfig = {
            ...config,
            type: config.type || 'stdio',
        };

        // Connect to the server
        await client.connect(transportConfig);
        mcpClients.set(serverName, client);

        console.log(`[MCP] Connected to server "${serverName}" using JSON-RPC with ${transportConfig.type} transport`);
        return true;
    } catch (error) {
        console.error(`[MCP] Failed to start server "${serverName}":`, error);
        return false;
    }
}

/**
 * Stops an MCP server process
 * @param {string} serverName Name of the server
 * @returns {Promise<boolean>} Whether the server was stopped successfully
 */
async function stopMcpServer(serverName) {
    if (!mcpClients.has(serverName)) {
        console.warn(`[MCP] Server "${serverName}" is not running`);
        return true;
    }

    try {
        const client = mcpClients.get(serverName);
        await client?.close();
        mcpClients.delete(serverName);
        console.log(`[MCP] Disconnected from server "${serverName}"`);
        return true;
    } catch (error) {
        console.error(`[MCP] Failed to stop server "${serverName}":`, error);
        return false;
    }
}

export const router = express.Router();

// Get all MCP servers
router.get('/servers', (request, response) => {
    try {
        const settings = readMcpSettings(request.user.directories);
        const servers = Object.entries(settings.mcpServers || {}).map(([name, config]) => ({
            name,
            isRunning: mcpClients.has(name),
            config: {
                command: config.command,
                args: config.args,
                // Don't send environment variables for security
            },
        }));

        response.json(servers);
    } catch (error) {
        console.error('[MCP] Error getting servers:', error);
        response.status(500).json({ error: 'Failed to get MCP servers' });
    }
});

// Add or update an MCP server
// @ts-ignore
router.post('/servers', jsonParser, (request, response) => {
    try {
        const { name, config } = request.body;

        if (!name || typeof name !== 'string') {
            return response.status(400).json({ error: 'Server name is required' });
        }

        if (!config || typeof config !== 'object') {
            return response.status(400).json({ error: 'Server configuration is required' });
        }

        // Validate based on transport type
        const transportType = config.type || 'stdio';
        if (transportType === 'stdio') {
            if (!config.command || typeof config.command !== 'string') {
                return response.status(400).json({ error: 'Server command is required for stdio transport' });
            }
        } else if (transportType === 'sse') {
            if (!config.url || typeof config.url !== 'string') {
                return response.status(400).json({ error: 'Server URL is required for SSE transport' });
            }
        } else {
            return response.status(400).json({ error: `Unsupported transport type: ${transportType}` });
        }

        const settings = readMcpSettings(request.user.directories);

        if (!settings.mcpServers) {
            settings.mcpServers = {};
        }

        settings.mcpServers[name] = config;
        writeMcpSettings(request.user.directories, settings);

        response.json({ success: true });
    } catch (error) {
        console.error('[MCP] Error adding/updating server:', error);
        response.status(500).json({ error: 'Failed to add/update MCP server' });
    }
});

// Delete an MCP server
// @ts-ignore
router.delete('/servers/:name', (request, response) => {
    try {
        const { name } = request.params;

        if (mcpClients.has(name)) {
            stopMcpServer(name);
        } else {
            return response.status(404).json({ error: 'Server not found' });
        }

        const settings = readMcpSettings(request.user.directories);

        if (settings.mcpServers && settings.mcpServers[name]) {
            delete settings.mcpServers[name];
            writeMcpSettings(request.user.directories, settings);
        }

        response.json({ success: true });
    } catch (error) {
        console.error('[MCP] Error deleting server:', error);
        response.status(500).json({ error: 'Failed to delete MCP server' });
    }
});

// Start an MCP server
// @ts-ignore
router.post('/servers/:name/start', (request, response) => {
    try {
        const { name } = request.params;
        const settings = readMcpSettings(request.user.directories);

        if (!settings.mcpServers || !settings.mcpServers[name]) {
            return response.status(404).json({ error: 'Server not found' });
        }

        const config = settings.mcpServers[name];

        startMcpServer(name, config)
            .then(success => {
                if (success) {
                    response.json({ success: true });
                } else {
                    response.status(500).json({ error: 'Failed to start MCP server' });
                }
            })
            .catch(error => {
                console.error('[MCP] Error starting server:', error);
                response.status(500).json({ error: 'Failed to start MCP server' });
            });
    } catch (error) {
        console.error('[MCP] Error starting server:', error);
        response.status(500).json({ error: 'Failed to start MCP server' });
    }
});

// Stop an MCP server
// @ts-ignore
router.post('/servers/:name/stop', (request, response) => {
    try {
        const { name } = request.params;

        if (!mcpClients.has(name)) {
            return response.status(400).json({ error: 'Server is not running' });
        }

        stopMcpServer(name)
            .then(success => {
                if (success) {
                    response.json({ success: true });
                } else {
                    response.status(500).json({ error: 'Failed to stop MCP server' });
                }
            })
            .catch(error => {
                console.error('[MCP] Error stopping server:', error);
                response.status(500).json({ error: 'Failed to stop MCP server' });
            });
    } catch (error) {
        console.error('[MCP] Error stopping server:', error);
        response.status(500).json({ error: 'Failed to stop MCP server' });
    }
});

// List tools from an MCP server
// @ts-ignore
router.get('/servers/:name/list-tools', async (request, response) => {
    try {
        const { name } = request.params;

        if (!mcpClients.has(name)) {
            return response.status(400).json({ error: 'Server is not running' });
        }

        const client = mcpClients.get(name);

        console.log(`[MCP] Listing tools from server "${name}"`);

        try {
            // Use JSON-RPC to list tools
            const tools = await client?.listTools();
            response.json(tools?.tools || []);
        } catch (error) {
            console.error('[MCP] Error listing tools:', error);
            response.status(500).json({ error: `Failed to list tools: ${error.message}` });
        }
    } catch (error) {
        console.error('[MCP] Error listing tools:', error);
        response.status(500).json({ error: 'Failed to list tools from MCP server' });
    }
});

// Call a tool on an MCP server
// @ts-ignore
router.post('/servers/:name/call-tool', jsonParser, async (request, response) => {
    try {
        const { name } = request.params;
        const { toolName, arguments: toolArgs } = request.body;

        if (!mcpClients.has(name)) {
            return response.status(400).json({ error: 'Server is not running' });
        }

        if (!toolName || typeof toolName !== 'string') {
            return response.status(400).json({ error: 'Tool name is required' });
        }

        if (!toolArgs || typeof toolArgs !== 'object') {
            return response.status(400).json({ error: 'Tool arguments must be an object' });
        }

        const client = mcpClients.get(name);

        console.log(`[MCP] Calling tool "${toolName}" on server "${name}" with arguments:`, toolArgs);

        try {
            // Use JSON-RPC to call the tool
            const result = await client?.callTool({
                name: toolName,
                arguments: toolArgs,
            });

            response.json({
                success: true,
                result: {
                    toolName,
                    status: 'executed',
                    data: result,
                },
            });
        } catch (error) {
            console.error('[MCP] Error executing tool:', error);
            response.status(500).json({
                success: false,
                error: `Failed to execute tool: ${error.message}`,
            });
        }
    } catch (error) {
        console.error('[MCP] Error calling tool:', error);
        response.status(500).json({ error: 'Failed to call tool on MCP server' });
    }
});

// Initialize MCP servers on startup
export async function init() {
    try {
        // Use the default user's directories
        const defaultUserDirectories = getUserDirectories(DEFAULT_USER.handle);

        const settings = readMcpSettings(defaultUserDirectories);

        if (settings.mcpServers) {
            for (const [name, config] of Object.entries(settings.mcpServers)) {
                if (config.autoStart) {
                    console.log(`[MCP] Auto-starting server "${name}"`);
                    await startMcpServer(name, config);
                }
            }
        }
    } catch (error) {
        console.error('[MCP] Error initializing MCP servers:', error);
    }
}
