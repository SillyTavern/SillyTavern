import { addOneMessage, chat, main_api, system_avatar, systemUserName } from '../script.js';
import { chat_completion_sources, oai_settings } from './openai.js';

/**
 * @typedef {object} ToolInvocation
 * @property {string} id - A unique identifier for the tool invocation.
 * @property {string} name - The name of the tool.
 * @property {string} parameters - The parameters for the tool invocation.
 * @property {string} result - The result of the tool invocation.
 */

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
     * Creates a new ToolDefinition.
     * @param {string} name A unique name for the tool.
     * @param {string} description A description of what the tool does.
     * @param {object} parameters A JSON schema for the parameters that the tool accepts.
     * @param {function} action A function that will be called when the tool is executed.
     */
    constructor(name, description, parameters, action) {
        this.#name = name;
        this.#description = description;
        this.#parameters = parameters;
        this.#action = action;
    }

    /**
     * Converts the ToolDefinition to an OpenAI API representation
     * @returns {object} OpenAI API representation of the tool.
     */
    toFunctionOpenAI() {
        return {
            type: 'function',
            function: {
                name: this.#name,
                description: this.#description,
                parameters: this.#parameters,
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

    /**
     * Returns an Array of all tools that have been registered.
     * @type {ToolDefinition[]}
     */
    static get tools() {
        return Array.from(this.#tools.values());
    }

    /**
     * Registers a new tool with the tool registry.
     * @param {string} name The name of the tool.
     * @param {string} description A description of what the tool does.
     * @param {object} parameters A JSON schema for the parameters that the tool accepts.
     * @param {function} action A function that will be called when the tool is executed.
     */
    static registerFunctionTool(name, description, parameters, action) {
        if (this.#tools.has(name)) {
            console.warn(`A tool with the name "${name}" has already been registered. The definition will be overwritten.`);
        }

        const definition = new ToolDefinition(name, description, parameters, action);
        this.#tools.set(name, definition);
        console.log('[ToolManager] Registered function tool:', definition);
    }

    /**
     * Removes a tool from the tool registry.
     * @param {string} name The name of the tool to unregister.
     */
    static unregisterFunctionTool(name) {
        if (!this.#tools.has(name)) {
            console.warn(`No tool with the name "${name}" has been registered.`);
            return;
        }

        this.#tools.delete(name);
        console.log(`[ToolManager] Unregistered function tool: ${name}`);
    }

    /**
     * Invokes a tool by name. Returns the result of the tool's action function.
     * @param {string} name The name of the tool to invoke.
     * @param {object} parameters Function parameters. For example, if the tool requires a "name" parameter, you would pass {name: "value"}.
     * @returns {Promise<string|null>} The result of the tool's action function. If an error occurs, null is returned. Non-string results are JSON-stringified.
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
            console.error(`An error occurred while invoking the tool "${name}":`, error);
            return null;
        }
    }

    /**
     * Register function tools for the next chat completion request.
     * @param {object} data Generation data
     */
    static async registerFunctionToolsOpenAI(data) {
        const tools = [];

        for (const tool of ToolManager.tools) {
            tools.push(tool.toFunctionOpenAI());
        }

        if (tools.length) {
            console.log('Registered function tools:', tools);

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
        if (!Array.isArray(parsed?.choices)) {
            return;
        }
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
                const toolCallIndex = (typeof toolCallDelta?.index === 'number') ? toolCallDelta.index : null;

                if (toolCallIndex === null) {
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

    static #applyToolCallDelta(target, delta) {
        for (const key in delta) {
            if (!delta.hasOwnProperty(key)) continue;
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
            //chat_completion_sources.COHERE,
            chat_completion_sources.CUSTOM,
            chat_completion_sources.MISTRALAI,
            //chat_completion_sources.CLAUDE,
            chat_completion_sources.OPENROUTER,
            chat_completion_sources.GROQ,
        ];
        return supportedSources.includes(oai_settings.chat_completion_source);
    }

    /**
     * Checks if tool calls can be performed for the current settings and generation type.
     * @param {string} type Generation type
     * @returns {boolean} Whether tool calls can be performed for the given type
     */
    static canPerformToolCalls(type) {
        const noToolCallTypes = ['swipe', 'impersonate', 'quiet', 'continue'];
        const isSupported = ToolManager.isToolCallingSupported();
        return isSupported && !noToolCallTypes.includes(type);
    }

    /**
     * Utility function to get tool calls from the response data.
     * @param {any} data Response data
     * @returns {any[]} Tool calls from the response data
     */
    static #getToolCallsFromData(data) {
        // Parsed tool calls from streaming data
        if (Array.isArray(data) && data.length > 0) {
            return data[0];
        }

        // Parsed tool calls from non-streaming data
        if (!Array.isArray(data?.choices)) {
            return;
        }

        // Find a choice with 0-index
        const choice = data.choices.find(choice => choice.index === 0);

        if (!choice) {
            return;
        }

        return choice.message.tool_calls;
    }

    /**
     * Check for function tool calls in the response data and invoke them.
     * @param {any} data Reply data
     * @returns {Promise<ToolInvocation[]>} Successful tool invocations
     */
    static async invokeFunctionTools(data) {
        /** @type {ToolInvocation[]} */
        const invocations = [];
        const toolCalls = ToolManager.#getToolCallsFromData(data);
        const oaiCompatibleSources = [
            chat_completion_sources.OPENAI,
            chat_completion_sources.CUSTOM,
            chat_completion_sources.MISTRALAI,
            chat_completion_sources.OPENROUTER,
            chat_completion_sources.GROQ,
        ];

        if (oaiCompatibleSources.includes(oai_settings.chat_completion_source)) {
            if (!Array.isArray(toolCalls)) {
                return [];
            }

            for (const toolCall of toolCalls) {
                if (typeof toolCall.function !== 'object') {
                    continue;
                }

                console.log('Function tool call:', toolCall);
                const id = toolCall.id;
                const parameters = toolCall.function.arguments;
                const name = toolCall.function.name;

                const toast = toastr.info(`Invoking function tool: ${name}`);
                const result = await ToolManager.invokeFunctionTool(name, parameters);
                toastr.clear(toast);
                console.log('Function tool result:', result);

                // Save a successful invocation
                if (result) {
                    invocations.push({ id, name, parameters, result });
                }
            }
        }

        /*
        if ([chat_completion_sources.CLAUDE].includes(oai_settings.chat_completion_source)) {
            if (!Array.isArray(data?.content)) {
                return;
            }

            for (const content of data.content) {
                if (content.type === 'tool_use') {
                    const args = { name: content.name, arguments: JSON.stringify(content.input) };
                }
            }
        }
        */

        /*
        if ([chat_completion_sources.COHERE].includes(oai_settings.chat_completion_source)) {
            if (!Array.isArray(data?.tool_calls)) {
                return;
            }

            for (const toolCall of data.tool_calls) {
                const args = { name: toolCall.name, arguments: JSON.stringify(toolCall.parameters) };
                console.log('Function tool call:', toolCall);
            }
        }
        */

        return invocations;
    }

    /**
     * Formats a message with tool invocations.
     * @param {ToolInvocation[]} invocations Tool invocations.
     * @returns {string} Formatted message with tool invocations.
     */
    static #formatMessage(invocations) {
        const tryParse = (x) => { try { return JSON.parse(x); } catch { return x; } };
        const data = structuredClone(invocations);
        const detailsElement = document.createElement('details');
        const summaryElement = document.createElement('summary');
        const preElement = document.createElement('pre');
        const codeElement = document.createElement('code');
        codeElement.classList.add('language-json');
        data.forEach(i => i.parameters = tryParse(i.parameters));
        codeElement.textContent = JSON.stringify(data, null, 2);
        const toolNames = data.map(i => i.name).join(', ');
        summaryElement.textContent = `Performed tool calls: ${toolNames}`;
        preElement.append(codeElement);
        detailsElement.append(summaryElement, preElement);
        return detailsElement.outerHTML;
    }

    /**
     * Saves function tool invocations to the last user chat message extra metadata.
     * @param {ToolInvocation[]} invocations Successful tool invocations
     */
    static saveFunctionToolInvocations(invocations) {
        const message = {
            name: systemUserName,
            force_avatar: system_avatar,
            is_system: true,
            is_user: false,
            mes: ToolManager.#formatMessage(invocations),
            extra: {
                isSmallSys: true,
                tool_invocations: invocations,
            },
        };
        chat.push(message);
        addOneMessage(message);
    }
}
