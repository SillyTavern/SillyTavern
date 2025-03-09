import { DOMPurify } from '../lib.js';

import { addOneMessage, chat, event_types, eventSource, getRequestHeaders, main_api, saveChatConditional, system_avatar, systemUserName } from '../script.js';
import { chat_completion_sources, oai_settings } from './openai.js';
import { Popup } from './popup.js';
import { SlashCommand } from './slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } from './slash-commands/SlashCommandArgument.js';
import { SlashCommandClosure } from './slash-commands/SlashCommandClosure.js';
import { enumIcons } from './slash-commands/SlashCommandCommonEnumsProvider.js';
import { enumTypes, SlashCommandEnumValue } from './slash-commands/SlashCommandEnumValue.js';
import { SlashCommandParser } from './slash-commands/SlashCommandParser.js';
import { slashCommandReturnHelper } from './slash-commands/SlashCommandReturnHelper.js';
import { isTrueBoolean } from './utils.js';

/**
 * @typedef {object} ToolInvocation
 * @property {string} id - A unique identifier for the tool invocation.
 * @property {string} displayName - The display name of the tool.
 * @property {string} name - The name of the tool.
 * @property {string} parameters - The parameters for the tool invocation.
 * @property {string} result - The result of the tool invocation.
 */

/**
 * @typedef {object} ToolInvocationResult
 * @property {ToolInvocation[]} invocations Successful tool invocations
 * @property {Error[]} errors Errors that occurred during tool invocation
 * @property {string[]} stealthCalls Names of stealth tools that were invoked
 */

/**
 * @typedef {object} ToolRegistration
 * @property {string} name - The name of the tool.
 * @property {string} displayName - The display name of the tool.
 * @property {string} description - A description of the tool.
 * @property {object} parameters - The parameters for the tool.
 * @property {function} action - The action to perform when the tool is invoked.
 * @property {function} [formatMessage] - A function to format the tool call message.
 * @property {function} [shouldRegister] - A function to determine if the tool should be registered.
 * @property {boolean} [stealth] - A tool call result will not be shown in the chat. No follow-up generation will be performed.
 */

/**
 * @typedef {object} ToolDefinitionOpenAI
 * @property {string} type - The type of the tool.
 * @property {object} function - The function definition.
 * @property {string} function.name - The name of the function.
 * @property {string} function.description - The description of the function.
 * @property {object} function.parameters - The parameters of the function.
 * @property {function} toString - A function to convert the tool to a string.
 */

/**
 * Assigns nested variables to a scope.
 * @param {import('./slash-commands/SlashCommandScope.js').SlashCommandScope} scope The scope to assign variables to.
 * @param {object} arg Object to assign variables from.
 * @param {string} prefix Prefix for the variable names.
 */
function assignNestedVariables(scope, arg, prefix) {
    Object.entries(arg).forEach(([key, value]) => {
        const newPrefix = `${prefix}.${key}`;
        if (typeof value === 'object' && value !== null) {
            assignNestedVariables(scope, value, newPrefix);
        } else {
            scope.letVariable(newPrefix, value);
        }
    });
}

/**
 * Checks if a string is a valid JSON string.
 * @param {string} str The string to check
 * @returns {boolean} If the string is a valid JSON string
 */
function isJson(str) {
    try {
        JSON.parse(str);
        return true;
    } catch {
        return false;
    }
}

/**
 * Tries to parse a string as JSON, returning the original string if parsing fails.
 * @param {string} str The string to try to parse
 * @returns {object|string} Parsed JSON or the original string
 */
function tryParse(str) {
    try {
        return JSON.parse(str);
    } catch {
        return str;
    }
}

/**
 * Stringifies an object if it is not already a string.
 * @param {any} obj The object to stringify
 * @returns {string} A JSON string representation of the object.
 */
function stringify(obj) {
    return typeof obj === 'string' ? obj : JSON.stringify(obj);
}

/**
 * A class that represents a tool definition.
 */
class ToolDefinition {
    /**
     * A unique name for the tool.
     * @type {string}
     */
    #name;

    /**
     * A user-friendly display name for the tool.
     * @type {string}
     */
    #displayName;

    /**
     * A description of what the tool does.
     * @type {string}
     */
    #description;

    /**
     * A JSON schema for the parameters that the tool accepts.
     * @type {object}
     */
    #parameters;

    /**
     * A function that will be called when the tool is executed.
     * @type {function}
     */
    #action;

    /**
     * A function that will be called to format the tool call toast.
     * @type {function}
     */
    #formatMessage;

    /**
     * A function that will be called to determine if the tool should be registered.
     * @type {function}
     */
    #shouldRegister;

    /**
     * A tool call result will not be shown in the chat. No follow-up generation will be performed.
     * @type {boolean}
     */
    #stealth;

    /**
     * Creates a new ToolDefinition.
     * @param {string} name A unique name for the tool.
     * @param {string} displayName A user-friendly display name for the tool.
     * @param {string} description A description of what the tool does.
     * @param {object} parameters A JSON schema for the parameters that the tool accepts.
     * @param {function} action A function that will be called when the tool is executed.
     * @param {function} formatMessage A function that will be called to format the tool call toast.
     * @param {function} shouldRegister A function that will be called to determine if the tool should be registered.
     * @param {boolean} stealth A tool call result will not be shown in the chat. No follow-up generation will be performed.
     */
    constructor(name, displayName, description, parameters, action, formatMessage, shouldRegister, stealth) {
        this.#name = name;
        this.#displayName = displayName;
        this.#description = description;
        this.#parameters = parameters;
        this.#action = action;
        this.#formatMessage = formatMessage;
        this.#shouldRegister = shouldRegister;
        this.#stealth = stealth;
    }

    /**
     * Converts the ToolDefinition to an OpenAI API representation
     * @returns {ToolDefinitionOpenAI} OpenAI API representation of the tool.
     */
    toFunctionOpenAI() {
        return {
            type: 'function',
            function: {
                name: this.#name,
                description: this.#description,
                parameters: this.#parameters,
            },
            toString: function () {
                return `<div><b>${this.function.name}</b></div><div><small>${this.function.description}</small></div><pre class="justifyLeft wordBreakAll"><code class="flex padding5">${JSON.stringify(this.function.parameters, null, 2)}</code></pre><hr>`;
            },
        };
    }

    /**
     * Invokes the tool with the given parameters.
     * @param {object} parameters The parameters to pass to the tool.
     * @returns {Promise<any>} The result of the tool's action function.
     */
    async invoke(parameters) {
        return await this.#action(parameters);
    }

    /**
     * Formats a message with the tool invocation.
     * @param {object} parameters The parameters to pass to the tool.
     * @returns {Promise<string>} The formatted message.
     */
    async formatMessage(parameters) {
        return typeof this.#formatMessage === 'function'
            ? await this.#formatMessage(parameters)
            : `Invoking tool: ${this.#displayName || this.#name}`;
    }

    async shouldRegister() {
        return typeof this.#shouldRegister === 'function'
            ? await this.#shouldRegister()
            : true;
    }

    get displayName() {
        return this.#displayName;
    }

    get stealth() {
        return this.#stealth;
    }
}

/**
 * A class for interacting with MCP servers.
 * TODO: Move to a separate file
 */
export class MCPClient {
    /**
     * A map of connected MCP servers.
     * @type {Map<string, object>}
     */
    static #connectedServers = new Map();

    /**
     * A map of MCP server tools.
     * @type {Map<string, Array<{name: string, description: string, inputSchema: object}>>}
     */
    static #serverTools = new Map();

    /**
     * Initializes the MCP client by fetching servers from the backend and registering MCP tools.
     * @returns {Promise<boolean>} Whether the initialization was successful.
     */
    static async init() {
        try {
            console.log('[MCPClient] Initializing MCP client');

            // Fetch servers from the backend
            const response = await fetch('/api/mcp/servers', {
                method: 'GET',
                headers: getRequestHeaders(),
            });

            if (!response.ok) {
                console.error('[MCPClient] Failed to fetch servers:', response.statusText);
                return false;
            }

            const servers = await response.json();

            // Clear existing connected servers
            this.#connectedServers.clear();
            this.#serverTools.clear();

            // Add running servers to the connected servers map
            for (const server of servers) {
                if (server.isRunning) {
                    this.#connectedServers.set(server.name, server.config);
                    console.log(`[MCPClient] Added running server "${server.name}" to connected servers`);

                    // Fetch and register tools for this server
                    await this.#fetchAndRegisterServerTools(server.name);
                }
            }

            console.log('[MCPClient] Initialization complete');
            return true;
        } catch (error) {
            console.error('[MCPClient] Error initializing MCP client:', error);
            return false;
        }
    }

    /**
     * Fetches tools from an MCP server and registers them with the ToolManager.
     * @param {string} serverName The name of the server to fetch tools from.
     * @returns {Promise<boolean>} Whether the tools were fetched and registered successfully.
     */
    static async #fetchAndRegisterServerTools(serverName) {
        try {
            // Fetch tools from the server
            const response = await fetch(`/api/mcp/servers/${serverName}/list-tools`, {
                method: 'GET',
                headers: getRequestHeaders(),
            });

            if (!response.ok) {
                console.error(`[MCPClient] Failed to fetch tools for server "${serverName}":`, response.statusText);
                return false;
            }

            const tools = await response.json();

            if (!Array.isArray(tools) || tools.length === 0) {
                console.log(`[MCPClient] No tools found for server "${serverName}"`);
                return true;
            }

            // Store the tools for this server
            this.#serverTools.set(serverName, tools);

            // Register each tool with the ToolManager
            for (const tool of tools) {
                this.#registerMcpTool(serverName, tool);
            }

            console.log(`[MCPClient] Registered ${tools.length} tools for server "${serverName}"`);
            return true;
        } catch (error) {
            console.error(`[MCPClient] Error fetching tools for server "${serverName}":`, error);
            return false;
        }
    }

    /**
     * Registers an MCP tool with the ToolManager.
     * @param {string} serverName The name of the server the tool belongs to.
     * @param {object} tool The tool to register.
     */
    static #registerMcpTool(serverName, tool) {
        const toolId = `mcp_${serverName}_${tool.name}`;

        ToolManager.registerFunctionTool({
            name: toolId,
            displayName: `${serverName}: ${tool.name}`,
            description: tool.description || `Tool from MCP server "${serverName}"`,
            parameters: tool.inputSchema || { type: 'object', properties: {} },
            action: async (parameters) => {
                return await this.callTool(serverName, tool.name, parameters);
            },
            formatMessage: async (parameters) => {
                return `Calling MCP tool "${tool.name}" on server "${serverName}"`;
            },
        });

        console.log(`[MCPClient] Registered tool "${tool.name}" from server "${serverName}"`);
    }

    /**
     * Adds a new MCP server configuration.
     * @param {string} name The name of the server to add.
     * @param {object} config The server configuration.
     * @returns {Promise<boolean>} Whether the server was added successfully.
     */
    static async addServer(name, config) {
        try {
            const response = await fetch('/api/mcp/servers', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({
                    name,
                    config,
                }),
            });

            const data = await response.json();

            if (data.success) {
                console.log(`[MCPClient] Added server "${name}"`);

                // Start the server immediately if autoStart is true
                if (config.autoStart) {
                    console.log(`[MCPClient] Auto-starting server "${name}"`);
                    await this.connect(name, config);
                }

                return true;
            } else {
                console.error(`[MCPClient] Failed to add server "${name}":`, data.error);
                return false;
            }
        } catch (error) {
            console.error(`[MCPClient] Error adding server "${name}":`, error);
            return false;
        }
    }

    /**
     * Connects to an MCP server.
     * @param {string} name The name of the server to connect to.
     * @param {object} config The server configuration.
     * @returns {Promise<boolean>} Whether the connection was successful.
     */
    static async connect(name, config) {
        try {
            const response = await fetch(`/api/mcp/servers/${name}/start`, {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify(config),
            });

            const data = await response.json();

            if (data.success) {
                this.#connectedServers.set(name, config);
                console.log(`[MCPClient] Connected to server "${name}"`);

                // Fetch and register tools for this server
                await this.#fetchAndRegisterServerTools(name);

                return true;
            } else {
                console.error(`[MCPClient] Failed to connect to server "${name}":`, data.error);
                return false;
            }
        } catch (error) {
            console.error(`[MCPClient] Error connecting to server "${name}":`, error);
            return false;
        }
    }

    /**
     * Disconnects from an MCP server.
     * @param {string} name The name of the server to disconnect from.
     * @returns {Promise<boolean>} Whether the disconnection was successful.
     */
    static async disconnect(name) {
        try {
            const response = await fetch(`/api/mcp/servers/${name}/stop`, {
                method: 'POST',
                headers: getRequestHeaders(),
            });

            const data = await response.json();

            if (data.success) {
                this.#connectedServers.delete(name);
                console.log(`[MCPClient] Disconnected from server "${name}"`);

                // Unregister all tools for this server
                this.#unregisterServerTools(name);

                return true;
            } else {
                console.error(`[MCPClient] Failed to disconnect from server "${name}":`, data.error);
                return false;
            }
        } catch (error) {
            console.error(`[MCPClient] Error disconnecting from server "${name}":`, error);
            return false;
        }
    }

    /**
     * Unregisters all tools for a server from the ToolManager.
     * @param {string} serverName The name of the server to unregister tools for.
     */
    static #unregisterServerTools(serverName) {
        const tools = this.#serverTools.get(serverName) || [];

        for (const tool of tools) {
            const toolId = `mcp_${serverName}_${tool.name}`;
            ToolManager.unregisterFunctionTool(toolId);
            console.log(`[MCPClient] Unregistered tool "${tool.name}" from server "${serverName}"`);
        }

        this.#serverTools.delete(serverName);
        console.log(`[MCPClient] Unregistered all tools for server "${serverName}"`);
    }

    /**
     * Deletes an MCP server configuration.
     * @param {string} name The name of the server to delete.
     * @returns {Promise<boolean>} Whether the deletion was successful.
     */
    static async deleteServer(name) {
        try {
            // First disconnect if connected
            if (this.isConnected(name)) {
                await this.disconnect(name);
            }

            const response = await fetch(`/api/mcp/servers/${encodeURIComponent(name)}`, {
                method: 'DELETE',
                headers: getRequestHeaders(),
            });

            const data = await response.json();

            if (data.success) {
                console.log(`[MCPClient] Deleted server "${name}"`);
                return true;
            } else {
                console.error(`[MCPClient] Failed to delete server "${name}":`, data.error);
                return false;
            }
        } catch (error) {
            console.error(`[MCPClient] Error deleting server "${name}":`, error);
            return false;
        }
    }

    /**
     * Gets a list of connected MCP servers.
     * @returns {string[]} A list of connected MCP server names.
     */
    static getConnectedServers() {
        return Array.from(this.#connectedServers.keys());
    }

    /**
     * Checks if an MCP server is connected.
     * @param {string} name The name of the server to check.
     * @returns {boolean} Whether the server is connected.
     */
    static isConnected(name) {
        return this.#connectedServers.has(name);
    }

    /**
     * Calls a tool on an MCP server.
     * @param {string} serverName The name of the server to call the tool on.
     * @param {string} toolName The name of the tool to call.
     * @param {object} args The arguments to pass to the tool.
     * @returns {Promise<any>} The result of the tool call.
     */
    static async callTool(serverName, toolName, args) {
        try {
            if (!this.isConnected(serverName)) {
                throw new Error(`MCP server "${serverName}" is not connected.`);
            }

            const response = await fetch(`/api/mcp/servers/${serverName}/call-tool`, {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({
                    toolName,
                    arguments: args,
                }),
            });

            const data = await response.json();

            if (data.success) {
                console.log(`[MCPClient] Successfully called tool "${toolName}" on server "${serverName}":`, data.result);
                return data.result;
            } else {
                console.error(`[MCPClient] Failed to call tool "${toolName}" on server "${serverName}":`, data.error);
                throw new Error(data.error || 'Unknown error');
            }
        } catch (error) {
            console.error(`[MCPClient] Error calling tool "${toolName}" on server "${serverName}":`, error);
            throw error;
        }
    }
}

/**
 * A class that manages the registration and invocation of tools.
 */
export class ToolManager {
    /**
     * A map of tool names to tool definitions.
     * @type {Map<string, ToolDefinition>}
     */
    static #tools = new Map();

    static #INPUT_DELTA_KEY = '__input_json_delta';

    /**
     * The maximum number of times to recurse when parsing tool calls.
     * @type {number}
     */
    static RECURSE_LIMIT = 5;

    /**
     * Returns an Array of all tools that have been registered.
     * @type {ToolDefinition[]}
     */
    static get tools() {
        return Array.from(this.#tools.values());
    }

    /**
     * Registers a new tool with the tool registry.
     * @param {ToolRegistration} tool The tool to register.
     */
    static registerFunctionTool({ name, displayName, description, parameters, action, formatMessage, shouldRegister, stealth }) {
        // Convert WIP arguments
        if (typeof arguments[0] !== 'object') {
            [name, description, parameters, action] = arguments;
        }

        if (this.#tools.has(name)) {
            console.warn(`[ToolManager] A tool with the name "${name}" has already been registered. The definition will be overwritten.`);
        }

        const definition = new ToolDefinition(
            name,
            displayName,
            description,
            parameters,
            action,
            formatMessage,
            shouldRegister,
            stealth,
        );
        this.#tools.set(name, definition);
        console.log('[ToolManager] Registered function tool:', definition);
    }

    /**
     * Removes a tool from the tool registry.
     * @param {string} name The name of the tool to unregister.
     */
    static unregisterFunctionTool(name) {
        if (!this.#tools.has(name)) {
            return;
        }

        this.#tools.delete(name);
        console.log(`[ToolManager] Unregistered function tool: ${name}`);
    }

    /**
     * Invokes a tool by name. Returns the result of the tool's action function.
     * @param {string} name The name of the tool to invoke.
     * @param {object} parameters Function parameters. For example, if the tool requires a "name" parameter, you would pass {name: "value"}.
     * @returns {Promise<string|Error>} The result of the tool's action function. If an error occurs, null is returned. Non-string results are JSON-stringified.
     */
    static async invokeFunctionTool(name, parameters) {
        try {
            if (!this.#tools.has(name)) {
                throw new Error(`No tool with the name "${name}" has been registered.`);
            }

            const invokeParameters = typeof parameters === 'string' ? JSON.parse(parameters) : parameters;
            const tool = this.#tools.get(name);
            const result = await tool.invoke(invokeParameters);
            return typeof result === 'string' ? result : JSON.stringify(result);
        } catch (error) {
            console.error(`[ToolManager] An error occurred while invoking the tool "${name}":`, error);

            if (error instanceof Error) {
                error.cause = name;
                return error.toString();
            }

            return new Error('Unknown error occurred while invoking the tool.', { cause: name }).toString();
        }
    }

    /**
     * Checks if a tool is a stealth tool.
     * @param {string} name The name of the tool to check.
     * @returns {boolean} Whether the tool is a stealth tool.
     */
    static isStealthTool(name) {
        if (!this.#tools.has(name)) {
            return false;
        }

        const tool = this.#tools.get(name);
        return !!tool.stealth;
    }

    /**
     * Formats a message for a tool call by name.
     * @param {string} name The name of the tool to format the message for.
     * @param {object} parameters Function tool call parameters.
     * @returns {Promise<string>} The formatted message for the tool call.
     */
    static async formatToolCallMessage(name, parameters) {
        if (!this.#tools.has(name)) {
            return `Invoked unknown tool: ${name}`;
        }

        try {
            const tool = this.#tools.get(name);
            const formatParameters = typeof parameters === 'string' ? JSON.parse(parameters) : parameters;
            return await tool.formatMessage(formatParameters);
        } catch (error) {
            console.error(`[ToolManager] An error occurred while formatting the tool call message for "${name}":`, error);
            return `Invoking tool: ${name}`;
        }
    }

    /**
     * Gets the display name of a tool by name.
     * @param {string} name
     * @returns {string} The display name of the tool.
     */
    static getDisplayName(name) {
        if (!this.#tools.has(name)) {
            return name;
        }

        const tool = this.#tools.get(name);
        return tool.displayName || name;
    }

    /**
     * Register function tools for the next chat completion request.
     * @param {object} data Generation data
     */
    static async registerFunctionToolsOpenAI(data) {
        const tools = [];

        for (const tool of ToolManager.tools) {
            const register = await tool.shouldRegister();
            if (!register) {
                console.log('[ToolManager] Skipping tool registration:', tool);
                continue;
            }
            tools.push(tool.toFunctionOpenAI());
        }

        if (tools.length) {
            console.log('[ToolManager] Registered function tools:', tools);

            data['tools'] = tools;
            data['tool_choice'] = 'auto';
        }
    }

    /**
     * Utility function to parse tool calls from a parsed response.
     * @param {any[]} toolCalls The tool calls to update.
     * @param {any} parsed The parsed response from the OpenAI API.
     * @returns {void}
     */
    static parseToolCalls(toolCalls, parsed) {
        if (!this.isToolCallingSupported()) {
            return;
        }
        if (Array.isArray(parsed?.choices)) {
            for (const choice of parsed.choices) {
                const choiceIndex = (typeof choice.index === 'number') ? choice.index : null;
                const choiceDelta = choice.delta;

                if (choiceIndex === null || !choiceDelta) {
                    continue;
                }

                const toolCallDeltas = choiceDelta?.tool_calls;

                if (!Array.isArray(toolCallDeltas)) {
                    continue;
                }

                if (!Array.isArray(toolCalls[choiceIndex])) {
                    toolCalls[choiceIndex] = [];
                }

                for (const toolCallDelta of toolCallDeltas) {
                    const toolCallIndex = (typeof toolCallDelta?.index === 'number') ? toolCallDelta.index : toolCallDeltas.indexOf(toolCallDelta);

                    if (isNaN(toolCallIndex) || toolCallIndex < 0) {
                        continue;
                    }

                    if (toolCalls[choiceIndex][toolCallIndex] === undefined) {
                        toolCalls[choiceIndex][toolCallIndex] = {};
                    }

                    const targetToolCall = toolCalls[choiceIndex][toolCallIndex];

                    ToolManager.#applyToolCallDelta(targetToolCall, toolCallDelta);
                }
            }
        }
        const cohereToolEvents = ['message-start', 'tool-call-start', 'tool-call-delta', 'tool-call-end'];
        if (cohereToolEvents.includes(parsed?.type) && typeof parsed?.delta?.message === 'object') {
            const choiceIndex = 0;
            const toolCallIndex = parsed?.index ?? 0;

            if (!Array.isArray(toolCalls[choiceIndex])) {
                toolCalls[choiceIndex] = [];
            }

            if (toolCalls[choiceIndex][toolCallIndex] === undefined) {
                toolCalls[choiceIndex][toolCallIndex] = {};
            }

            const targetToolCall = toolCalls[choiceIndex][toolCallIndex];
            ToolManager.#applyToolCallDelta(targetToolCall, parsed.delta.message);
        }
        if (typeof parsed?.content_block === 'object') {
            const choiceIndex = 0;
            const toolCallIndex = parsed?.index ?? 0;

            if (parsed?.content_block?.type === 'tool_use') {
                if (!Array.isArray(toolCalls[choiceIndex])) {
                    toolCalls[choiceIndex] = [];
                }
                if (toolCalls[choiceIndex][toolCallIndex] === undefined) {
                    toolCalls[choiceIndex][toolCallIndex] = {};
                }
                const targetToolCall = toolCalls[choiceIndex][toolCallIndex];
                ToolManager.#applyToolCallDelta(targetToolCall, parsed.content_block);
            }
        }
        if (typeof parsed?.delta === 'object') {
            const choiceIndex = 0;
            const toolCallIndex = parsed?.index ?? 0;
            const targetToolCall = toolCalls[choiceIndex]?.[toolCallIndex];
            if (targetToolCall) {
                if (parsed?.delta?.type === 'input_json_delta') {
                    const jsonDelta = parsed?.delta?.partial_json;
                    if (!targetToolCall[this.#INPUT_DELTA_KEY]) {
                        targetToolCall[this.#INPUT_DELTA_KEY] = '';
                    }
                    targetToolCall[this.#INPUT_DELTA_KEY] += jsonDelta;
                }
            }
        }
        if (parsed?.type === 'content_block_stop') {
            const choiceIndex = 0;
            const toolCallIndex = parsed?.index ?? 0;
            const targetToolCall = toolCalls[choiceIndex]?.[toolCallIndex];
            if (targetToolCall) {
                const jsonDeltaString = targetToolCall[this.#INPUT_DELTA_KEY];
                if (jsonDeltaString) {
                    try {
                        const jsonDelta = { input: JSON.parse(jsonDeltaString) };
                        delete targetToolCall[this.#INPUT_DELTA_KEY];
                        ToolManager.#applyToolCallDelta(targetToolCall, jsonDelta);
                    } catch (error) {
                        console.warn('[ToolManager] Failed to apply input JSON delta:', error);
                    }
                }
            }
        }
        if (Array.isArray(parsed?.candidates)) {
            for (let choiceIndex = 0; choiceIndex < parsed.candidates.length; choiceIndex++) {
                const candidate = parsed.candidates[choiceIndex];
                if (Array.isArray(candidate?.content?.parts)) {
                    for (let toolCallIndex = 0; toolCallIndex < candidate.content.parts.length; toolCallIndex++) {
                        const part = candidate.content.parts[toolCallIndex];
                        if (part.functionCall) {
                            if (!Array.isArray(toolCalls[choiceIndex])) {
                                toolCalls[choiceIndex] = [];
                            }
                            if (toolCalls[choiceIndex][toolCallIndex] === undefined) {
                                toolCalls[choiceIndex][toolCallIndex] = {};
                            }
                            const targetToolCall = toolCalls[choiceIndex][toolCallIndex];
                            ToolManager.#applyToolCallDelta(targetToolCall, part.functionCall);
                        }
                    }
                }
            }
        }
    }

    /**
     * Apply a tool call delta to a target object.
     * @param {object} target The target object to apply the delta to
     * @param {object} delta The delta object to apply
     */
    static #applyToolCallDelta(target, delta) {
        for (const key in delta) {
            if (!Object.prototype.hasOwnProperty.call(delta, key)) continue;
            if (key === '__proto__' || key === 'constructor') continue;

            const deltaValue = delta[key];
            const targetValue = target[key];

            if (deltaValue === null || deltaValue === undefined) {
                target[key] = deltaValue;
                continue;
            }

            if (typeof deltaValue === 'string') {
                if (typeof targetValue === 'string') {
                    // Concatenate strings
                    target[key] = targetValue + deltaValue;
                } else {
                    target[key] = deltaValue;
                }
            } else if (typeof deltaValue === 'object' && !Array.isArray(deltaValue)) {
                if (typeof targetValue !== 'object' || targetValue === null || Array.isArray(targetValue)) {
                    target[key] = {};
                }
                // Recursively apply deltas to nested objects
                ToolManager.#applyToolCallDelta(target[key], deltaValue);
            } else {
                // Assign other types directly
                target[key] = deltaValue;
            }
        }
    }

    /**
     * Checks if tool calling is supported for the current settings and generation type.
     * @returns {boolean} Whether tool calling is supported for the given type
     */
    static isToolCallingSupported() {
        if (main_api !== 'openai' || !oai_settings.function_calling) {
            return false;
        }

        const supportedSources = [
            chat_completion_sources.OPENAI,
            chat_completion_sources.CUSTOM,
            chat_completion_sources.MISTRALAI,
            chat_completion_sources.CLAUDE,
            chat_completion_sources.OPENROUTER,
            chat_completion_sources.GROQ,
            chat_completion_sources.COHERE,
            chat_completion_sources.DEEPSEEK,
            chat_completion_sources.MAKERSUITE,
            chat_completion_sources.AI21,
        ];
        return supportedSources.includes(oai_settings.chat_completion_source);
    }

    /**
     * Checks if tool calls can be performed for the current settings and generation type.
     * @param {string} type Generation type
     * @returns {boolean} Whether tool calls can be performed for the given type
     */
    static canPerformToolCalls(type) {
        const noToolCallTypes = ['impersonate', 'quiet', 'continue'];
        const isSupported = ToolManager.isToolCallingSupported();
        return isSupported && !noToolCallTypes.includes(type);
    }

    /**
     * Utility function to get tool calls from the response data.
     * @param {any} data Response data
     * @returns {any[]} Tool calls from the response data
     */
    static #getToolCallsFromData(data) {
        const getRandomId = () => Math.random().toString(36).substring(2);
        const isClaudeToolCall = c => Array.isArray(c) ? c.filter(x => x).every(isClaudeToolCall) : c?.input && c?.name && c?.id;
        const isGoogleToolCall = c => Array.isArray(c) ? c.filter(x => x).every(isGoogleToolCall) : c?.name && c?.args;
        const convertClaudeToolCall = c => ({ id: c.id, function: { name: c.name, arguments: c.input } });
        const convertGoogleToolCall = (c) => ({ id: getRandomId(), function: { name: c.name, arguments: c.args } });

        // Parsed tool calls from streaming data
        if (Array.isArray(data) && data.length > 0 && Array.isArray(data[0])) {
            if (isClaudeToolCall(data[0])) {
                return data[0].filter(x => x).map(convertClaudeToolCall);
            }

            if (isGoogleToolCall(data[0])) {
                return data[0].filter(x => x).map(convertGoogleToolCall);
            }

            if (typeof data[0]?.[0]?.tool_calls === 'object') {
                return Array.isArray(data[0]?.[0]?.tool_calls) ? data[0][0].tool_calls : [data[0][0].tool_calls];
            }

            return data[0];
        }

        // Google AI Studio tool calls
        if (Array.isArray(data?.responseContent?.parts)) {
            return data.responseContent.parts.filter(p => p.functionCall).map(p => convertGoogleToolCall(p.functionCall));
        }

        // Parsed tool calls from non-streaming data
        if (Array.isArray(data?.choices)) {
            // Find a choice with 0-index
            const choice = data.choices.find(choice => choice.index === 0);

            if (choice) {
                return choice.message.tool_calls;
            }
        }

        // Claude tool calls to OpenAI tool calls
        if (Array.isArray(data?.content)) {
            const content = data.content.filter(c => c.type === 'tool_use').map(convertClaudeToolCall);

            if (content) {
                return content;
            }
        }

        // Cohere tool calls
        if (typeof data?.message?.tool_calls === 'object') {
            return Array.isArray(data?.message?.tool_calls) ? data.message.tool_calls : [data.message.tool_calls];
        }
    }

    /**
     * Checks if the response data contains tool calls.
     * @param {object} data Response data
     * @returns {boolean} Whether the response data contains tool calls
     */
    static hasToolCalls(data) {
        const toolCalls = ToolManager.#getToolCallsFromData(data);
        return Array.isArray(toolCalls) && toolCalls.length > 0;
    }

    /**
     * Check for function tool calls in the response data and invoke them.
     * @param {any} data Reply data
     * @returns {Promise<ToolInvocationResult>} Successful tool invocations
     */
    static async invokeFunctionTools(data) {
        /** @type {ToolInvocationResult} */
        const result = {
            invocations: [],
            errors: [],
            stealthCalls: [],
        };
        const toolCalls = ToolManager.#getToolCallsFromData(data);

        if (!Array.isArray(toolCalls)) {
            return result;
        }

        for (const toolCall of toolCalls) {
            if (typeof toolCall.function !== 'object') {
                continue;
            }

            console.log('[ToolManager] Function tool call:', toolCall);
            const id = toolCall.id;
            const parameters = toolCall.function.arguments;
            const name = toolCall.function.name;
            const displayName = ToolManager.getDisplayName(name);
            const isStealth = ToolManager.isStealthTool(name);
            const message = await ToolManager.formatToolCallMessage(name, parameters);
            const toast = message && toastr.info(message, 'Tool Calling', { timeOut: 0 });
            const toolResult = await ToolManager.invokeFunctionTool(name, parameters);
            toastr.clear(toast);
            console.log('[ToolManager] Function tool result:', result);

            // Save a successful invocation
            if (toolResult instanceof Error) {
                result.errors.push(toolResult);
                continue;
            }

            // Don't save stealth tool invocations
            if (isStealth) {
                result.stealthCalls.push(name);
                continue;
            }

            const invocation = {
                id,
                displayName,
                name,
                parameters: stringify(parameters),
                result: toolResult,
            };
            result.invocations.push(invocation);
        }

        return result;
    }

    /**
     * Groups tool names by count.
     * @param {string[]} toolNames Tool names
     * @returns {string} Grouped tool names
     */
    static #groupToolNames(toolNames) {
        const toolCounts = toolNames.reduce((acc, name) => {
            acc[name] = (acc[name] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(toolCounts).map(([name, count]) => count > 1 ? `${name} (${count})` : name).join(', ');
    }

    /**
     * Formats a message with tool invocations.
     * @param {ToolInvocation[]} invocations Tool invocations.
     * @returns {string} Formatted message with tool invocations.
     */
    static #formatToolInvocationMessage(invocations) {
        const data = structuredClone(invocations);
        const detailsElement = document.createElement('details');
        const summaryElement = document.createElement('summary');
        const preElement = document.createElement('pre');
        const codeElement = document.createElement('code');
        codeElement.classList.add('language-json');
        data.forEach(i => {
            i.parameters = tryParse(i.parameters);
            i.result = tryParse(i.result);
        });
        codeElement.textContent = JSON.stringify(data, null, 2);
        const toolNames = data.map(i => i.displayName || i.name);
        summaryElement.textContent = `Tool calls: ${this.#groupToolNames(toolNames)}`;
        preElement.append(codeElement);
        detailsElement.append(summaryElement, preElement);
        return detailsElement.outerHTML;
    }

    /**
     * Saves function tool invocations to the last user chat message extra metadata.
     * @param {ToolInvocation[]} invocations Successful tool invocations
     */
    static async saveFunctionToolInvocations(invocations) {
        if (!Array.isArray(invocations) || invocations.length === 0) {
            return;
        }
        const message = {
            name: systemUserName,
            force_avatar: system_avatar,
            is_system: true,
            is_user: false,
            mes: ToolManager.#formatToolInvocationMessage(invocations),
            extra: {
                isSmallSys: true,
                tool_invocations: invocations,
            },
        };
        chat.push(message);
        await eventSource.emit(event_types.TOOL_CALLS_PERFORMED, invocations);
        addOneMessage(message);
        await eventSource.emit(event_types.TOOL_CALLS_RENDERED, invocations);
        await saveChatConditional();
    }

    /**
     * Shows an error message for tool calls.
     * @param {Error[]} errors Errors that occurred during tool invocation
     * @returns {void}
     */
    static showToolCallError(errors) {
        toastr.error('An error occurred while invoking function tools. Click here for more details.', 'Tool Calling', {
            onclick: () => Popup.show.text('Tool Calling Errors', DOMPurify.sanitize(errors.map(e => `${e.cause}: ${e.message}`).join('<br>'))),
            timeOut: 5000,
        });
    }

    static initToolSlashCommands() {
        const toolsEnumProvider = () => ToolManager.tools.map(tool => {
            const toolOpenAI = tool.toFunctionOpenAI();
            return new SlashCommandEnumValue(toolOpenAI.function.name, toolOpenAI.function.description, enumTypes.enum, enumIcons.closure);
        });

        const mcpServersEnumProvider = () => {
            const servers = [];
            for (const serverName of MCPClient.getConnectedServers()) {
                servers.push(new SlashCommandEnumValue(serverName, `MCP Server: ${serverName}`, enumTypes.enum, enumIcons.server));
            }
            return servers;
        };

        // MCP Server Commands
        // TODO: Move this to a separate file
        SlashCommandParser.addCommandObject(SlashCommand.fromProps({
            name: 'mcp-add-server',
            aliases: ['mcp-server-add'],
            helpString: 'Adds a new MCP server configuration.',
            namedArgumentList: [
                SlashCommandNamedArgument.fromProps({
                    name: 'name',
                    description: 'The name of the server to add.',
                    typeList: [ARGUMENT_TYPE.STRING],
                    isRequired: true,
                    acceptsMultiple: false,
                }),
                SlashCommandNamedArgument.fromProps({
                    name: 'command',
                    description: 'The command to execute for stdio transport.',
                    typeList: [ARGUMENT_TYPE.STRING],
                    isRequired: true,
                    acceptsMultiple: false,
                }),
                SlashCommandNamedArgument.fromProps({
                    name: 'args',
                    description: 'The arguments to pass to the command.',
                    typeList: [ARGUMENT_TYPE.STRING, ARGUMENT_TYPE.LIST],
                    isRequired: false,
                    acceptsMultiple: true,
                }),
                SlashCommandNamedArgument.fromProps({
                    name: 'env',
                    description: 'Environment variables to set (JSON object).',
                    typeList: [ARGUMENT_TYPE.DICTIONARY],
                    isRequired: false,
                    acceptsMultiple: false,
                }),
                SlashCommandNamedArgument.fromProps({
                    name: 'autoStart',
                    description: 'Whether to automatically start the server on startup.',
                    typeList: [ARGUMENT_TYPE.BOOLEAN],
                    isRequired: false,
                    acceptsMultiple: false,
                    defaultValue: String(true),
                }),
            ],
            callback: async (args) => {
                const { name, command, args: commandArgs, env, autoStart } = args;

                if (!name || typeof name !== 'string') {
                    throw new Error('The "name" argument must be a non-empty string.');
                }

                if (!command || typeof command !== 'string') {
                    throw new Error('The "command" argument must be a non-empty string.');
                }

                // Create the server configuration
                const config = {
                    command,
                    args: Array.isArray(commandArgs) ? commandArgs : [],
                    env: env && typeof env === 'string' && isJson(env) ? JSON.parse(env) : {},
                    autoStart: autoStart && isTrueBoolean(String(autoStart)),
                };

                const success = await MCPClient.addServer(name, config);

                if (success) {
                    return `Successfully added MCP server "${name}".`;
                } else {
                    throw new Error(`Failed to add MCP server "${name}".`);
                }
            },
        }));

        SlashCommandParser.addCommandObject(SlashCommand.fromProps({
            name: 'mcp-connect',
            aliases: ['mcp-server-connect'],
            helpString: 'Connects to an MCP server.',
            namedArgumentList: [
                SlashCommandNamedArgument.fromProps({
                    name: 'name',
                    description: 'The name of the server to connect to.',
                    typeList: [ARGUMENT_TYPE.STRING],
                    isRequired: true,
                    acceptsMultiple: false,
                }),
                SlashCommandNamedArgument.fromProps({
                    name: 'type',
                    description: 'The type of transport to use (stdio or sse).',
                    typeList: [ARGUMENT_TYPE.STRING],
                    isRequired: true,
                    acceptsMultiple: false,
                    enumList: [
                        new SlashCommandEnumValue('stdio', 'Standard IO Transport', enumTypes.enum, enumIcons.server),
                        new SlashCommandEnumValue('sse', 'Server-Sent Events Transport', enumTypes.enum, enumIcons.server),
                    ],
                    forceEnum: true,
                }),
                SlashCommandNamedArgument.fromProps({
                    name: 'command',
                    description: 'The command to execute for stdio transport.',
                    typeList: [ARGUMENT_TYPE.STRING],
                    isRequired: false,
                    acceptsMultiple: false,
                }),
                SlashCommandNamedArgument.fromProps({
                    name: 'args',
                    description: 'The arguments to pass to the command for stdio transport.',
                    typeList: [ARGUMENT_TYPE.STRING],
                    isRequired: false,
                    acceptsMultiple: true,
                }),
                SlashCommandNamedArgument.fromProps({
                    name: 'url',
                    description: 'The URL to connect to for SSE transport.',
                    typeList: [ARGUMENT_TYPE.STRING],
                    isRequired: false,
                    acceptsMultiple: false,
                }),
            ],
            callback: async (args) => {
                const { name, type, command, args: commandArgs, url } = args;

                if (!name || typeof name !== 'string') {
                    throw new Error('The "name" argument must be a non-empty string.');
                }

                if (!type || typeof type !== 'string') {
                    throw new Error('The "type" argument must be a non-empty string.');
                }

                const config = { type };

                if (type === 'stdio') {
                    if (!command || typeof command !== 'string') {
                        throw new Error('The "command" argument is required for stdio transport.');
                    }
                    config.command = command;
                    if (Array.isArray(commandArgs)) {
                        config.args = commandArgs;
                    }
                } else if (type === 'sse') {
                    if (!url || typeof url !== 'string') {
                        throw new Error('The "url" argument is required for SSE transport.');
                    }
                    config.url = url;
                } else {
                    throw new Error(`Unsupported transport type: ${type}`);
                }

                const success = await MCPClient.connect(name, config);

                if (success) {
                    return `Successfully connected to MCP server "${name}".`;
                } else {
                    throw new Error(`Failed to connect to MCP server "${name}".`);
                }
            },
        }));

        SlashCommandParser.addCommandObject(SlashCommand.fromProps({
            name: 'mcp-disconnect',
            aliases: ['mcp-server-disconnect'],
            helpString: 'Disconnects from an MCP server.',
            unnamedArgumentList: [
                SlashCommandArgument.fromProps({
                    description: 'The name of the server to disconnect from.',
                    typeList: [ARGUMENT_TYPE.STRING],
                    isRequired: true,
                    acceptsMultiple: false,
                    forceEnum: true,
                    enumProvider: mcpServersEnumProvider,
                }),
            ],
            callback: async (_, name) => {
                if (!name || typeof name !== 'string') {
                    throw new Error('The server name must be a non-empty string.');
                }

                const success = await MCPClient.disconnect(name);

                if (success) {
                    return `Successfully disconnected from MCP server "${name}".`;
                } else {
                    throw new Error(`Failed to disconnect from MCP server "${name}".`);
                }
            },
        }));

        SlashCommandParser.addCommandObject(SlashCommand.fromProps({
            name: 'mcp-list',
            aliases: ['mcp-servers', 'mcp-server-list'],
            helpString: 'Lists all connected MCP servers.',
            namedArgumentList: [
                SlashCommandNamedArgument.fromProps({
                    name: 'return',
                    description: 'The way how you want the return value to be provided',
                    typeList: [ARGUMENT_TYPE.STRING],
                    defaultValue: 'none',
                    enumList: slashCommandReturnHelper.enumList({ allowObject: true }),
                    forceEnum: true,
                }),
            ],
            callback: async (args) => {
                const servers = MCPClient.getConnectedServers();
                // Get the return type from args, defaulting to 'popup-html'
                const returnTypeStr = String(args?.return ?? 'popup-html').trim().toLowerCase();

                // Validate that it's a valid SlashCommandReturnType
                /** @type {import('./slash-commands/SlashCommandReturnHelper.js').SlashCommandReturnType} */
                let returnType;

                // Check if the string is a valid return type
                if (['pipe', 'object', 'chat-html', 'chat-text', 'popup-html', 'popup-text', 'toast-html', 'toast-text', 'console', 'none'].includes(returnTypeStr)) {
                    returnType = /** @type {import('./slash-commands/SlashCommandReturnHelper.js').SlashCommandReturnType} */ (returnTypeStr);
                } else {
                    returnType = 'popup-html';
                }

                if (servers.length === 0) {
                    return 'No MCP servers connected.';
                }

                const serverInfo = servers.map(name => ({
                    name,
                    connected: MCPClient.isConnected(name),
                }));

                return await slashCommandReturnHelper.doReturn(returnType, serverInfo ?? [], {
                    objectToStringFunc: (servers) => {
                        if (!Array.isArray(servers) || servers.length === 0) {
                            return 'No MCP servers connected.';
                        }
                        return servers.map(s => `${s.name}: ${s.connected ? 'Connected' : 'Disconnected'}`).join('\n');
                    },
                });
            },
        }));

        SlashCommandParser.addCommandObject(SlashCommand.fromProps({
            name: 'mcp-delete-server',
            aliases: ['mcp-server-delete', 'mcp-remove-server', 'mcp-server-remove'],
            helpString: 'Deletes an MCP server configuration.',
            unnamedArgumentList: [
                SlashCommandArgument.fromProps({
                    description: 'The name of the server to delete.',
                    typeList: [ARGUMENT_TYPE.STRING],
                    isRequired: true,
                    acceptsMultiple: false,
                    forceEnum: true,
                    enumProvider: mcpServersEnumProvider,
                }),
            ],
            callback: async (_, name) => {
                if (!name || typeof name !== 'string') {
                    throw new Error('The server name must be a non-empty string.');
                }

                const success = await MCPClient.deleteServer(name);

                if (success) {
                    return `Successfully deleted MCP server "${name}".`;
                } else {
                    throw new Error(`Failed to delete MCP server "${name}".`);
                }
            },
        }));

        // Tool Commands
        SlashCommandParser.addCommandObject(SlashCommand.fromProps({
            name: 'tools-list',
            aliases: ['tool-list'],
            helpString: 'Gets a list of all registered tools in the OpenAI function JSON format. Use the <code>return</code> argument to specify the return value type.',
            returns: 'A list of all registered tools.',
            namedArgumentList: [
                SlashCommandNamedArgument.fromProps({
                    name: 'return',
                    description: 'The way how you want the return value to be provided',
                    typeList: [ARGUMENT_TYPE.STRING],
                    defaultValue: 'none',
                    enumList: slashCommandReturnHelper.enumList({ allowObject: true }),
                    forceEnum: true,
                }),
            ],
            callback: async (args) => {
                /** @type {any} */
                const returnType = String(args?.return ?? 'popup-html').trim().toLowerCase();
                const objectToStringFunc = (tools) => Array.isArray(tools) ? tools.map(x => x.toString()).join('\n\n') : tools.toString();
                const tools = ToolManager.tools.map(tool => tool.toFunctionOpenAI());
                return await slashCommandReturnHelper.doReturn(returnType ?? 'popup-html', tools ?? [], { objectToStringFunc });
            },
        }));

        SlashCommandParser.addCommandObject(SlashCommand.fromProps({
            name: 'tools-invoke',
            aliases: ['tool-invoke'],
            helpString: 'Invokes a registered tool by name. The <code>parameters</code> argument MUST be a JSON-serialized object.',
            namedArgumentList: [
                SlashCommandNamedArgument.fromProps({
                    name: 'parameters',
                    description: 'The parameters to pass to the tool.',
                    typeList: [ARGUMENT_TYPE.DICTIONARY],
                    isRequired: true,
                    acceptsMultiple: false,
                }),
            ],
            unnamedArgumentList: [
                SlashCommandArgument.fromProps({
                    description: 'The name of the tool to invoke.',
                    typeList: [ARGUMENT_TYPE.STRING],
                    isRequired: true,
                    acceptsMultiple: false,
                    forceEnum: true,
                    enumProvider: toolsEnumProvider,
                }),
            ],
            callback: async (args, name) => {
                const { parameters } = args;

                const result = await ToolManager.invokeFunctionTool(String(name), parameters);
                if (result instanceof Error) {
                    throw result;
                }

                return result;
            },
        }));

        SlashCommandParser.addCommandObject(SlashCommand.fromProps({
            name: 'tools-register',
            aliases: ['tool-register'],
            helpString: `<div>Registers a new tool with the tool registry.</div>
                <ul>
                    <li>The <code>parameters</code> argument MUST be a JSON-serialized object with a valid JSON schema.</li>
                    <li>The unnamed argument MUST be a closure that accepts the function parameters as local script variables.</li>
                </ul>
                <div>See <a target="_blank" href="https://json-schema.org/learn/">json-schema.org</a> and <a target="_blank" href="https://platform.openai.com/docs/guides/function-calling">OpenAI Function Calling</a> for more information.</div>
                <div>Example:</div>
                <pre><code>/let key=echoSchema
{
    "$schema": "http://json-schema.org/draft-04/schema#",
    "type": "object",
    "properties": {
        "message": {
            "type": "string",
            "description": "The message to echo."
        }
    },
    "required": [
        "message"
    ]
}
||
/tools-register name=Echo description="Echoes a message. Call when the user is asking to repeat something" parameters={{var::echoSchema}} {: /echo {{var::arg.message}} :}</code></pre>`,
            namedArgumentList: [
                SlashCommandNamedArgument.fromProps({
                    name: 'name',
                    description: 'The name of the tool.',
                    typeList: [ARGUMENT_TYPE.STRING],
                    isRequired: true,
                    acceptsMultiple: false,
                }),
                SlashCommandNamedArgument.fromProps({
                    name: 'description',
                    description: 'A description of what the tool does.',
                    typeList: [ARGUMENT_TYPE.STRING],
                    isRequired: true,
                    acceptsMultiple: false,
                }),
                SlashCommandNamedArgument.fromProps({
                    name: 'parameters',
                    description: 'The parameters for the tool.',
                    typeList: [ARGUMENT_TYPE.DICTIONARY],
                    isRequired: true,
                    acceptsMultiple: false,
                }),
                SlashCommandNamedArgument.fromProps({
                    name: 'displayName',
                    description: 'The display name of the tool.',
                    typeList: [ARGUMENT_TYPE.STRING],
                    isRequired: false,
                    acceptsMultiple: false,
                }),
                SlashCommandNamedArgument.fromProps({
                    name: 'formatMessage',
                    description: 'The closure to be executed to format the tool call message. Must return a string.',
                    typeList: [ARGUMENT_TYPE.CLOSURE],
                    isRequired: true,
                    acceptsMultiple: false,
                }),
                SlashCommandNamedArgument.fromProps({
                    name: 'shouldRegister',
                    description: 'The closure to be executed to determine if the tool should be registered. Must return a boolean.',
                    typeList: [ARGUMENT_TYPE.CLOSURE],
                    isRequired: false,
                    acceptsMultiple: false,
                }),
                SlashCommandNamedArgument.fromProps({
                    name: 'stealth',
                    description: 'If true, a tool call result will not be shown in the chat and no follow-up generation will be performed.',
                    typeList: [ARGUMENT_TYPE.BOOLEAN],
                    isRequired: false,
                    acceptsMultiple: false,
                    defaultValue: String(false),
                }),
            ],
            unnamedArgumentList: [
                SlashCommandArgument.fromProps({
                    description: 'The closure to be executed when the tool is invoked.',
                    typeList: [ARGUMENT_TYPE.CLOSURE],
                    isRequired: true,
                    acceptsMultiple: false,
                }),
            ],
            callback: async (args, action) => {
                /**
                 * Converts a slash command closure to a function.
                 * @param {SlashCommandClosure} action Closure to convert to a function
                 * @param {function(any): any} convertResult Function to convert the result
                 * @returns {function} Function that executes the closure
                 */
                function closureToFunction(action, convertResult) {
                    return async (args) => {
                        const localClosure = action.getCopy();
                        localClosure.onProgress = () => { };
                        const scope = localClosure.scope;
                        if (typeof args === 'object' && args !== null) {
                            assignNestedVariables(scope, args, 'arg');
                        } else if (typeof args !== 'undefined') {
                            scope.letVariable('arg', args);
                        }
                        const result = await localClosure.execute();
                        return convertResult(result.pipe);
                    };
                }

                const { name, displayName, description, parameters, formatMessage, shouldRegister, stealth } = args;

                if (!(action instanceof SlashCommandClosure)) {
                    throw new Error('The unnamed argument must be a closure.');
                }
                if (typeof name !== 'string' || !name) {
                    throw new Error('The "name" argument must be a non-empty string.');
                }
                if (typeof description !== 'string' || !description) {
                    throw new Error('The "description" argument must be a non-empty string.');
                }
                if (typeof parameters !== 'string' || !isJson(parameters)) {
                    throw new Error('The "parameters" argument must be a JSON-serialized object.');
                }
                if (displayName && typeof displayName !== 'string') {
                    throw new Error('The "displayName" argument must be a string.');
                }
                if (formatMessage && !(formatMessage instanceof SlashCommandClosure)) {
                    throw new Error('The "formatMessage" argument must be a closure.');
                }
                if (shouldRegister && !(shouldRegister instanceof SlashCommandClosure)) {
                    throw new Error('The "shouldRegister" argument must be a closure.');
                }

                const actionFunc = closureToFunction(action, x => x);
                const formatMessageFunc = formatMessage instanceof SlashCommandClosure ? closureToFunction(formatMessage, x => String(x)) : null;
                const shouldRegisterFunc = shouldRegister instanceof SlashCommandClosure ? closureToFunction(shouldRegister, x => isTrueBoolean(x)) : null;

                ToolManager.registerFunctionTool({
                    name: String(name ?? ''),
                    displayName: String(displayName ?? ''),
                    description: String(description ?? ''),
                    parameters: JSON.parse(parameters ?? '{}'),
                    action: actionFunc,
                    formatMessage: formatMessageFunc,
                    shouldRegister: shouldRegisterFunc,
                    stealth: stealth && isTrueBoolean(String(stealth)),
                });

                return '';
            },
        }));

        SlashCommandParser.addCommandObject(SlashCommand.fromProps({
            name: 'tools-unregister',
            aliases: ['tool-unregister'],
            helpString: 'Unregisters a tool from the tool registry.',
            unnamedArgumentList: [
                SlashCommandArgument.fromProps({
                    description: 'The name of the tool to unregister.',
                    typeList: [ARGUMENT_TYPE.STRING],
                    isRequired: true,
                    acceptsMultiple: false,
                    forceEnum: true,
                    enumProvider: toolsEnumProvider,
                }),
            ],
            callback: async (_, name) => {
                if (typeof name !== 'string' || !name) {
                    throw new Error('The unnamed argument must be a non-empty string.');
                }

                ToolManager.unregisterFunctionTool(name);
                return '';
            },
        }));
    }
}
