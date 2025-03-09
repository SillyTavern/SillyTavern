import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';

import express from 'express';
import { sync as writeFileAtomicSync } from 'write-file-atomic';
import { jsonParser } from '../express-common.js';

import { getUserDirectories } from '../users.js';
import { DEFAULT_USER } from '../constants.js';

export const MCP_SETTINGS_FILE = 'mcp_settings.json';

// Map of active MCP server processes
const mcpServers = new Map();
// Map of server event emitters for SSE
const serverEmitters = new Map();

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
 * Starts an MCP server process
 * @param {string} serverName Name of the server
 * @param {object} config Server configuration
 * @param {string} config.command Command to execute
 * @param {string[]} config.args Arguments to pass to the command
 * @param {object} config.env Environment variables to set
 * @returns {Promise<boolean>} Whether the server was started successfully
 */
async function startMcpServer(serverName, config) {
    if (mcpServers.has(serverName)) {
        console.warn(`[MCP] Server "${serverName}" is already running`);
        return true;
    }

    try {
        const env = { ...process.env, ...config.env };
        const serverProcess = spawn(config.command, config.args || [], {
            env,
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        // Create an event emitter for this server
        const emitter = new EventEmitter();
        serverEmitters.set(serverName, emitter);

        // Set up data handling
        serverProcess.stdout.on('data', (data) => {
            const message = data.toString();
            emitter.emit('message', message);
            console.log(`[MCP] ${serverName} stdout: ${message}`);
        });

        serverProcess.stderr.on('data', (data) => {
            const message = data.toString();
            emitter.emit('error', message);
            console.error(`[MCP] ${serverName} stderr: ${message}`);
        });

        serverProcess.on('close', (code) => {
            console.log(`[MCP] ${serverName} process exited with code ${code}`);
            mcpServers.delete(serverName);
            serverEmitters.delete(serverName);
            emitter.emit('close', code);
        });

        mcpServers.set(serverName, serverProcess);
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
    if (!mcpServers.has(serverName)) {
        console.warn(`[MCP] Server "${serverName}" is not running`);
        return true;
    }

    try {
        const serverProcess = mcpServers.get(serverName);
        serverProcess.kill();
        mcpServers.delete(serverName);
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
            isRunning: mcpServers.has(name),
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

        if (!config.command || typeof config.command !== 'string') {
            return response.status(400).json({ error: 'Server command is required' });
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
router.delete('/servers/:name', (request, response) => {
    try {
        const { name } = request.params;

        if (mcpServers.has(name)) {
            stopMcpServer(name);
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

        if (!mcpServers.has(name)) {
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

// Call a tool on an MCP server
// @ts-ignore
router.post('/servers/:name/call-tool', jsonParser, async (request, response) => {
    try {
        const { name } = request.params;
        const { toolName, arguments: toolArgs } = request.body;

        if (!mcpServers.has(name)) {
            return response.status(400).json({ error: 'Server is not running' });
        }

        if (!toolName || typeof toolName !== 'string') {
            return response.status(400).json({ error: 'Tool name is required' });
        }

        if (!toolArgs || typeof toolArgs !== 'object') {
            return response.status(400).json({ error: 'Tool arguments must be an object' });
        }

        const serverProcess = mcpServers.get(name);

        // Create a unique request ID for this tool call
        const requestId = `tool-call-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

        // Create an MCP protocol message for calling a tool
        const mcpRequest = {
            jsonrpc: '2.0',
            id: requestId,
            method: 'callTool',
            params: {
                name: toolName,
                arguments: toolArgs,
            },
        };

        console.log(`[MCP] Calling tool "${toolName}" on server "${name}" with arguments:`, toolArgs);

        // Create a promise that will be resolved when we get a response
        const responsePromise = new Promise((resolve, reject) => {
            // Set up a timeout to prevent hanging if the server doesn't respond
            const timeout = setTimeout(() => {
                reject(new Error('Tool call timed out after 30 seconds'));
            }, 30000);

            // Function to handle data from the server
            const dataHandler = (data) => {
                try {
                    const message = data.toString();
                    // Try to parse each line as JSON
                    const lines = message.split('\n').filter(line => line.trim());

                    for (const line of lines) {
                        try {
                            const parsed = JSON.parse(line);

                            // Check if this is a response to our request
                            if (parsed.id === requestId && parsed.jsonrpc === '2.0') {
                                // Clean up
                                clearTimeout(timeout);
                                serverProcess.stdout.removeListener('data', dataHandler);

                                if (parsed.error) {
                                    reject(new Error(parsed.error.message || 'Unknown error'));
                                } else {
                                    resolve(parsed.result);
                                }
                                return;
                            }
                        } catch (e) {
                            // Not valid JSON or not our response, continue
                        }
                    }
                } catch (e) {
                    console.error('[MCP] Error parsing server response:', e);
                }
            };

            // Listen for data from the server
            serverProcess.stdout.on('data', dataHandler);
        });

        // Send the request to the server
        serverProcess.stdin.write(JSON.stringify(mcpRequest) + '\n');

        try {
            // Wait for the response
            const result = await responsePromise;

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

// SSE endpoint for MCP server communication
// @ts-ignore
router.get('/servers/:name/events', (request, response) => {
    const { name } = request.params;

    if (!mcpServers.has(name)) {
        return response.status(400).json({ error: 'Server is not running' });
    }

    const emitter = serverEmitters.get(name);

    if (!emitter) {
        return response.status(500).json({ error: 'Server emitter not found' });
    }

    // Set up SSE
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');
    response.flushHeaders();

    const messageListener = (message) => {
        response.write(`data: ${JSON.stringify({ type: 'message', data: message })}\n\n`);
    };

    const errorListener = (error) => {
        response.write(`data: ${JSON.stringify({ type: 'error', data: error })}\n\n`);
    };

    const closeListener = (code) => {
        response.write(`data: ${JSON.stringify({ type: 'close', data: code })}\n\n`);
        response.end();
    };

    emitter.on('message', messageListener);
    emitter.on('error', errorListener);
    emitter.on('close', closeListener);

    // Clean up when client disconnects
    request.on('close', () => {
        emitter.off('message', messageListener);
        emitter.off('error', errorListener);
        emitter.off('close', closeListener);
    });
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
