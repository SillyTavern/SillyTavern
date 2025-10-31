import crypto from 'node:crypto';
import { getConfigValue, tryParse } from './util.js';

const PROMPT_PLACEHOLDER = getConfigValue('promptPlaceholder', 'Let\'s get started.');

const REASONING_EFFORT = {
    auto: 'auto',
    low: 'low',
    medium: 'medium',
    high: 'high',
    min: 'min',
    max: 'max',
};

export const PROMPT_PROCESSING_TYPE = {
    NONE: '',
    /** @deprecated Use MERGE instead. */
    CLAUDE: 'claude',
    MERGE: 'merge',
    MERGE_TOOLS: 'merge_tools',
    SEMI: 'semi',
    SEMI_TOOLS: 'semi_tools',
    STRICT: 'strict',
    STRICT_TOOLS: 'strict_tools',
    SINGLE: 'single',
};

/**
 * @typedef {object} PromptNames
 * @property {string} charName Character name
 * @property {string} userName User name
 * @property {string[]} groupNames Group member names
 * @property {function(string): boolean} startsWithGroupName Check if a message starts with a group name
 */

/**
 * Extracts the character name, user name, and group member names from the request.
 * @param {import('express').Request} request Express request object
 * @returns {PromptNames} Prompt names
 */
export function getPromptNames(request) {
    return {
        charName: String(request.body.char_name || ''),
        userName: String(request.body.user_name || ''),
        groupNames: Array.isArray(request.body.group_names) ? request.body.group_names.map(String) : [],
        startsWithGroupName: function (message) {
            return this.groupNames.some(name => message.startsWith(`${name}: `));
        },
    };
}

/**
 * Adds an assistant prefix to the last message.
 * @param {any[]} prompt Prompt messages array
 * @param {any[]} tools Array of tool definitions
 * @param {string} property The property to set the prefix on
 * @returns {any[]} Transformed messages array
 */
export function addAssistantPrefix(prompt, tools, property) {
    if (!prompt.length) {
        return prompt;
    }
    const hasAnyTools = (Array.isArray(tools) && tools.length > 0) || prompt.some(x => x.role === 'tool');
    if (!hasAnyTools && prompt[prompt.length - 1].role === 'assistant') {
        prompt[prompt.length - 1][property] = true;
    }
    return prompt;
}

/**
 * Applies a post-processing step to the generated messages.
 * @param {object[]} messages Messages to post-process
 * @param {string} type Prompt conversion type
 * @param {PromptNames} names Prompt names
 * @returns
 */
export function postProcessPrompt(messages, type, names) {
    switch (type) {
        case PROMPT_PROCESSING_TYPE.MERGE:
        case PROMPT_PROCESSING_TYPE.CLAUDE:
            return mergeMessages(messages, names, { strict: false, placeholders: false, single: false, tools: false });
        case PROMPT_PROCESSING_TYPE.MERGE_TOOLS:
            return mergeMessages(messages, names, { strict: false, placeholders: false, single: false, tools: true });
        case PROMPT_PROCESSING_TYPE.SEMI:
            return mergeMessages(messages, names, { strict: true, placeholders: false, single: false, tools: false });
        case PROMPT_PROCESSING_TYPE.SEMI_TOOLS:
            return mergeMessages(messages, names, { strict: true, placeholders: false, single: false, tools: true });
        case PROMPT_PROCESSING_TYPE.STRICT:
            return mergeMessages(messages, names, { strict: true, placeholders: true, single: false, tools: false });
        case PROMPT_PROCESSING_TYPE.STRICT_TOOLS:
            return mergeMessages(messages, names, { strict: true, placeholders: true, single: false, tools: true });
        case PROMPT_PROCESSING_TYPE.SINGLE:
            return mergeMessages(messages, names, { strict: true, placeholders: false, single: true, tools: false });
        default:
            return messages;
    }
}

/**
 * Convert a prompt from the ChatML objects to the format used by Claude.
 * Mainly deprecated. Only used for counting tokens.
 * @param {object[]} messages Array of messages
 * @param {boolean}  addAssistantPostfix Add Assistant postfix.
 * @param {string}   addAssistantPrefill Add Assistant prefill after the assistant postfix.
 * @param {boolean}  withSysPromptSupport Indicates if the Claude model supports the system prompt format.
 * @param {boolean}  useSystemPrompt Indicates if the system prompt format should be used.
 * @param {boolean}  excludePrefixes Exlude Human/Assistant prefixes.
 * @param {string}   addSysHumanMsg Add Human message between system prompt and assistant.
 * @returns {string} Prompt for Claude
 * @copyright Prompt Conversion script taken from RisuAI by kwaroran (GPLv3).
 */
export function convertClaudePrompt(messages, addAssistantPostfix, addAssistantPrefill, withSysPromptSupport, useSystemPrompt, addSysHumanMsg, excludePrefixes) {

    //Prepare messages for claude.
    //When 'Exclude Human/Assistant prefixes' checked, setting messages role to the 'system'(last message is exception).
    if (messages.length > 0) {
        messages.forEach((m) => {
            if (!m.content) {
                m.content = '';
            }
            if (m.tool_calls) {
                m.content += JSON.stringify(m.tool_calls);
            }
        });
        if (excludePrefixes) {
            messages.slice(0, -1).forEach(message => message.role = 'system');
        } else {
            messages[0].role = 'system';
        }
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
            if (i >= 0 && (message.role === 'user' || message.content.includes('\n\nHuman: '))) {
                hasUser = true;
            }
            return message.role === 'assistant' && i > 0;
        });
        // When 2.1+ and 'Use system prompt' checked, switches to the system prompt format by setting the first message's role to the 'system'.
        // Inserts the human's message before the first the assistant one, if there are no such message or prefix found.
        if (withSysPromptSupport && useSystemPrompt) {
            messages[0].role = 'system';
            if (firstAssistantIndex > 0 && addSysHumanMsg && !hasUser) {
                messages.splice(firstAssistantIndex, 0, {
                    role: 'user',
                    content: addSysHumanMsg,
                });
            }
        } else {
            // Otherwise, use the default message format by setting the first message's role to 'user'(compatible with all claude models including 2.1.)
            messages[0].role = 'user';
            // Fix messages order for default message format when(messages > Context Size) by merging two messages with "\n\nHuman: " prefixes into one, before the first Assistant's message.
            if (firstAssistantIndex > 0 && !excludePrefixes) {
                messages[firstAssistantIndex - 1].role = firstAssistantIndex - 1 !== 0 && messages[firstAssistantIndex - 1].role === 'user' ? 'FixHumMsg' : messages[firstAssistantIndex - 1].role;
            }
        }
    }

    // Convert messages to the prompt.
    let requestPrompt = messages.map((v, i) => {
        // Set prefix according to the role. Also, when "Exclude Human/Assistant prefixes" is checked, names are added via the system prefix.
        let prefix = {
            'assistant': '\n\nAssistant: ',
            'user': '\n\nHuman: ',
            'system': i === 0 ? '' : v.name === 'example_assistant' ? '\n\nA: ' : v.name === 'example_user' ? '\n\nH: ' : excludePrefixes && v.name ? `\n\n${v.name}: ` : '\n\n',
            'FixHumMsg': '\n\nFirst message: ',
        }[v.role] ?? '';
        // Claude doesn't support message names, so we'll just add them to the message content.
        return `${prefix}${v.name && v.role !== 'system' ? `${v.name}: ` : ''}${v.content}`;
    }).join('');

    return requestPrompt;
}

/**
 * Convert ChatML objects into working with Anthropic's new Messaging API.
 * @param {object[]} messages Array of messages
 * @param {string}   prefillString User determined prefill string
 * @param {boolean}  useSysPrompt See if we want to use a system prompt
 * @param {boolean}  useTools See if we want to use tools
 * @param {PromptNames} names Prompt names
 * @returns {{messages: object[], systemPrompt: object[]}} Prompt for Anthropic
 */
export function convertClaudeMessages(messages, prefillString, useSysPrompt, useTools, names) {
    let systemPrompt = [];
    if (useSysPrompt) {
        // Collect all the system messages up until the first instance of a non-system message, and then remove them from the messages array.
        let i;
        for (i = 0; i < messages.length; i++) {
            if (messages[i].role !== 'system') {
                break;
            }
            // Append example names if not already done by the frontend (e.g. for group chats).
            if (names.userName && messages[i].name === 'example_user') {
                if (!messages[i].content.startsWith(`${names.userName}: `)) {
                    messages[i].content = `${names.userName}: ${messages[i].content}`;
                }
            }
            if (names.charName && messages[i].name === 'example_assistant') {
                if (!messages[i].content.startsWith(`${names.charName}: `) && !names.startsWithGroupName(messages[i].content)) {
                    messages[i].content = `${names.charName}: ${messages[i].content}`;
                }
            }
            systemPrompt.push({ type: 'text', text: messages[i].content });
        }

        messages.splice(0, i);

        // Check if the first message in the array is of type user, if not, interject with humanMsgFix or a blank message.
        // Also prevents erroring out if the messages array is empty.
        if (messages.length === 0) {
            messages.unshift({
                role: 'user',
                content: PROMPT_PLACEHOLDER,
            });
        }
    }

    // Now replace all further messages that have the role 'system' with the role 'user'. (or all if we're not using one)
    const parse = (str) => typeof str === 'string' ? JSON.parse(str) : str;
    messages.forEach((message) => {
        if (message.role === 'assistant' && message.tool_calls) {
            message.content = message.tool_calls.map((tc) => ({
                type: 'tool_use',
                id: tc.id,
                name: tc.function.name,
                input: parse(tc.function.arguments),
            }));
        }

        if (message.role === 'tool') {
            message.role = 'user';
            message.content = [{
                type: 'tool_result',
                tool_use_id: message.tool_call_id,
                content: message.content,
            }];
        }

        if (message.role === 'system') {
            if (names.userName && message.name === 'example_user') {
                if (!message.content.startsWith(`${names.userName}: `)) {
                    message.content = `${names.userName}: ${message.content}`;
                }
            }
            if (names.charName && message.name === 'example_assistant') {
                if (!message.content.startsWith(`${names.charName}: `) && !names.startsWithGroupName(message.content)) {
                    message.content = `${names.charName}: ${message.content}`;
                }
            }
            message.role = 'user';

            // Delete name here so it doesn't get added later
            delete message.name;
        }

        // Convert everything to an array of it would be easier to work with
        if (typeof message.content === 'string') {
            // Take care of name properties since claude messages don't support them
            if (message.name) {
                message.content = `${message.name}: ${message.content}`;
            }

            message.content = [{ type: 'text', text: message.content }];
        } else if (Array.isArray(message.content)) {
            message.content = message.content.map((content) => {
                if (content.type === 'image_url') {
                    const imageEntry = content?.image_url;
                    const imageData = imageEntry?.url;
                    const mimeType = imageData?.split(';')?.[0].split(':')?.[1];
                    const base64Data = imageData?.split(',')?.[1];

                    return {
                        type: 'image',
                        source: {
                            type: 'base64',
                            media_type: mimeType,
                            data: base64Data,
                        },
                    };
                }

                if (content.type === 'text') {
                    if (message.name) {
                        content.text = `${message.name}: ${content.text}`;
                    }

                    // If the text is empty, replace it with a zero-width space
                    return { type: 'text', text: content.text || '\u200b' };
                }

                return content;
            });
        }

        // Remove offending properties
        delete message.name;
        delete message.tool_calls;
        delete message.tool_call_id;
    });

    // Images in assistant messages should be moved to the next user message
    for (let i = 0; i < messages.length; i++) {
        if (messages[i].role === 'assistant' && messages[i].content.some(c => c.type === 'image')) {
            // Find the next user message
            let j = i + 1;
            while (j < messages.length && messages[j].role !== 'user') {
                j++;
            }

            // Move the images
            if (j >= messages.length) {
                // If there is no user message after the assistant message, add a new one
                messages.splice(i + 1, 0, { role: 'user', content: [] });
            }

            messages[j].content.push(...messages[i].content.filter(c => c.type === 'image'));
            messages[i].content = messages[i].content.filter(c => c.type !== 'image');
        }
    }

    // Shouldn't be conditional anymore, messages api expects the last role to be user unless we're explicitly prefilling
    if (prefillString) {
        messages.push({
            role: 'assistant',
            // Dangling whitespace are not allowed for prefilling
            content: [{ type: 'text', text: prefillString.trimEnd() }],
        });
    }

    // Since the messaging endpoint only supports user assistant roles in turns, we have to merge messages with the same role if they follow eachother
    // Also handle multi-modality, holy slop.
    let mergedMessages = [];
    messages.forEach((message) => {
        if (mergedMessages.length > 0 && mergedMessages[mergedMessages.length - 1].role === message.role) {
            mergedMessages[mergedMessages.length - 1].content.push(...message.content);
        } else {
            mergedMessages.push(message);
        }
    });

    if (!useTools) {
        mergedMessages.forEach((message) => {
            message.content.forEach((content) => {
                if (content.type === 'tool_use') {
                    content.type = 'text';
                    content.text = JSON.stringify(content.input);
                    delete content.id;
                    delete content.name;
                    delete content.input;
                }
                if (content.type === 'tool_result') {
                    content.type = 'text';
                    content.text = content.content;
                    delete content.tool_use_id;
                    delete content.content;
                }
            });
        });
    }

    return { messages: mergedMessages, systemPrompt: systemPrompt };
}

/**
 * Convert a prompt from the ChatML objects to the format used by Cohere.
 * @param {object[]} messages Array of messages
 * @param {PromptNames} names Prompt names
 * @returns {{chatHistory: object[]}} Prompt for Cohere
 */
export function convertCohereMessages(messages, names) {
    if (messages.length === 0) {
        messages.unshift({
            role: 'user',
            content: PROMPT_PLACEHOLDER,
        });
    }

    messages.forEach((msg, index) => {
        // Tool calls require an assistent primer
        if (Array.isArray(msg.tool_calls)) {
            if (index > 0 && messages[index - 1].role === 'assistant') {
                msg.content = messages[index - 1].content;
                messages.splice(index - 1, 1);
            } else {
                msg.content = `I'm going to call a tool for that: ${msg.tool_calls.map(tc => tc?.function?.name).join(', ')}`;
            }
        }
        // No names support (who would've thought)
        if (msg.name) {
            if (msg.role == 'system' && msg.name == 'example_assistant') {
                if (names.charName && !msg.content.startsWith(`${names.charName}: `) && !names.startsWithGroupName(msg.content)) {
                    msg.content = `${names.charName}: ${msg.content}`;
                }
            }
            if (msg.role == 'system' && msg.name == 'example_user') {
                if (names.userName && !msg.content.startsWith(`${names.userName}: `)) {
                    msg.content = `${names.userName}: ${msg.content}`;
                }
            }
            if (msg.role !== 'system' && !msg.content.startsWith(`${msg.name}: `)) {
                msg.content = `${msg.name}: ${msg.content}`;
            }
            delete msg.name;
        }
    });

    return { chatHistory: messages };
}

/**
 * Convert a prompt from the ChatML objects to the format used by Google MakerSuite models.
 * @param {object[]} messages Array of messages
 * @param {string} _model Model name
 * @param {boolean} useSysPrompt Use system prompt
 * @param {PromptNames} names Prompt names
 * @returns {{contents: *[], system_instruction: {parts: {text: string}[]}}} Prompt for Google MakerSuite models
 */
export function convertGooglePrompt(messages, _model, useSysPrompt, names) {
    const sysPrompt = [];

    if (useSysPrompt) {
        while (messages.length > 1 && messages[0].role === 'system') {
            // Append example names if not already done by the frontend (e.g. for group chats).
            if (names.userName && messages[0].name === 'example_user') {
                if (!messages[0].content.startsWith(`${names.userName}: `)) {
                    messages[0].content = `${names.userName}: ${messages[0].content}`;
                }
            }
            if (names.charName && messages[0].name === 'example_assistant') {
                if (!messages[0].content.startsWith(`${names.charName}: `) && !names.startsWithGroupName(messages[0].content)) {
                    messages[0].content = `${names.charName}: ${messages[0].content}`;
                }
            }
            sysPrompt.push(messages[0].content);
            messages.shift();
        }
    }

    const system_instruction = { parts: sysPrompt.map(text => ({ text })) };
    const toolNameMap = {};

    const contents = [];
    messages.forEach((message, index) => {
        // fix the roles
        if (message.role === 'system' || message.role === 'tool') {
            message.role = 'user';
        } else if (message.role === 'assistant') {
            message.role = 'model';
        }

        // Convert the content to an array of parts
        if (!Array.isArray(message.content)) {
            const content = (() => {
                const hasToolCalls = Array.isArray(message.tool_calls) && message.tool_calls.length > 0;
                const hasToolCallId = typeof message.tool_call_id === 'string' && message.tool_call_id.length > 0;

                if (hasToolCalls) {
                    return { type: 'tool_calls', tool_calls: message.tool_calls };
                }

                if (hasToolCallId) {
                    return { type: 'tool_call_id', tool_call_id: message.tool_call_id, content: String(message.content ?? '') };
                }

                return { type: 'text', text: String(message.content ?? '') };
            })();
            message.content = [content];
        }

        // similar story as claude
        if (message.name) {
            message.content.forEach((part) => {
                if (part.type !== 'text') {
                    return;
                }
                if (message.name === 'example_user') {
                    if (names.userName && !part.text.startsWith(`${names.userName}: `)) {
                        part.text = `${names.userName}: ${part.text}`;
                    }
                } else if (message.name === 'example_assistant') {
                    if (names.charName && !part.text.startsWith(`${names.charName}: `) && !names.startsWithGroupName(part.text)) {
                        part.text = `${names.charName}: ${part.text}`;
                    }
                } else {
                    if (!part.text.startsWith(`${message.name}: `)) {
                        part.text = `${message.name}: ${part.text}`;
                    }
                }
            });

            delete message.name;
        }

        //create the prompt parts
        const parts = [];
        message.content.forEach((part) => {
            if (part.type === 'text') {
                parts.push({ text: part.text });
            } else if (part.type === 'tool_call_id') {
                const name = toolNameMap[part.tool_call_id] ?? 'unknown';
                parts.push({
                    functionResponse: {
                        name: name,
                        response: { name: name, content: part.content },
                    },
                });
            } else if (part.type === 'tool_calls') {
                part.tool_calls.forEach((toolCall) => {
                    parts.push({
                        functionCall: {
                            name: toolCall.function.name,
                            args: tryParse(toolCall.function.arguments) ?? toolCall.function.arguments,
                        },
                    });

                    toolNameMap[toolCall.id] = toolCall.function.name;
                });
            } else if (part.type === 'image_url') {
                const mimeType = part.image_url.url.split(';')[0].split(':')[1];
                const base64Data = part.image_url.url.split(',')[1];
                parts.push({
                    inlineData: {
                        mimeType: mimeType,
                        data: base64Data,
                    },
                });
            } else if (part.type === 'video_url') {
                const videoUrl = part.video_url?.url;
                if (videoUrl && videoUrl.startsWith('data:')) {
                    const [header, data] = videoUrl.split(',');
                    const mimeType = header.match(/data:([^;]+)/)?.[1] || 'video/mp4';

                    parts.push({
                        inlineData: {
                            mimeType: mimeType,
                            data: data,
                        },
                    });
                }
            }
        });

        // merge consecutive messages with the same role
        if (index > 0 && message.role === contents[contents.length - 1].role) {
            parts.forEach((part) => {
                if (part.text) {
                    const textPart = contents[contents.length - 1].parts.find(p => typeof p.text === 'string');
                    if (textPart) {
                        textPart.text += '\n\n' + part.text;
                    } else {
                        contents[contents.length - 1].parts.push(part);
                    }
                }
                if (part.inlineData || part.functionCall || part.functionResponse) {
                    contents[contents.length - 1].parts.push(part);
                }
            });
        } else {
            contents.push({
                role: message.role,
                parts: parts,
            });
        }
    });

    return { contents: contents, system_instruction: system_instruction };
}

/**
 * Convert AI21 prompt. Classic: system message squash, user/assistant message merge.
 * @param {object[]} messages Array of messages
 * @param {PromptNames} names Prompt names
 * @returns {object[]} Prompt for AI21
 */
export function convertAI21Messages(messages, names) {
    if (!Array.isArray(messages)) {
        return [];
    }

    // Collect all the system messages up until the first instance of a non-system message, and then remove them from the messages array.
    let i = 0, systemPrompt = '';

    for (i = 0; i < messages.length; i++) {
        if (messages[i].role !== 'system') {
            break;
        }
        // Append example names if not already done by the frontend (e.g. for group chats).
        if (names.userName && messages[i].name === 'example_user') {
            if (!messages[i].content.startsWith(`${names.userName}: `)) {
                messages[i].content = `${names.userName}: ${messages[i].content}`;
            }
        }
        if (names.charName && messages[i].name === 'example_assistant') {
            if (!messages[i].content.startsWith(`${names.charName}: `) && !names.startsWithGroupName(messages[i].content)) {
                messages[i].content = `${names.charName}: ${messages[i].content}`;
            }
        }
        systemPrompt += `${messages[i].content}\n\n`;
    }

    messages.splice(0, i);

    // Prevent erroring out if the messages array is empty.
    if (messages.length === 0) {
        messages.unshift({
            role: 'user',
            content: PROMPT_PLACEHOLDER,
        });
    }

    if (systemPrompt) {
        messages.unshift({
            role: 'system',
            content: systemPrompt.trim(),
        });
    }

    // Doesn't support completion names, so prepend if not already done by the frontend (e.g. for group chats).
    messages.forEach(msg => {
        if ('name' in msg) {
            if (msg.role !== 'system' && !msg.content.startsWith(`${msg.name}: `)) {
                msg.content = `${msg.name}: ${msg.content}`;
            }
            delete msg.name;
        }
    });

    // Since the messaging endpoint only supports alternating turns, we have to merge messages with the same role if they follow each other
    let mergedMessages = [];
    messages.forEach((message) => {
        if (mergedMessages.length > 0 && mergedMessages[mergedMessages.length - 1].role === message.role) {
            mergedMessages[mergedMessages.length - 1].content += '\n\n' + message.content;
        } else {
            mergedMessages.push(message);
        }
    });

    return mergedMessages;
}

/**
 * Convert a prompt from the ChatML objects to the format used by MistralAI.
 * @param {object[]} messages Array of messages
 * @param {PromptNames} names Prompt names
 * @returns {object[]} Prompt for MistralAI
 */
export function convertMistralMessages(messages, names) {
    if (!Array.isArray(messages)) {
        return [];
    }

    // Make the last assistant message a prefill
    const prefixEnabled = getConfigValue('mistral.enablePrefix', false, 'boolean');
    const lastMsg = messages[messages.length - 1];
    if (prefixEnabled && messages.length > 0 && lastMsg?.role === 'assistant') {
        lastMsg.prefix = true;
    }

    const sanitizeToolId = (id) => crypto.createHash('sha512').update(id).digest('hex').slice(0, 9);

    // Doesn't support completion names, so prepend if not already done by the frontend (e.g. for group chats).
    messages.forEach(msg => {
        if ('tool_calls' in msg && Array.isArray(msg.tool_calls)) {
            msg.tool_calls.forEach(tool => {
                tool.id = sanitizeToolId(tool.id);
            });
        }
        if ('tool_call_id' in msg && msg.role === 'tool') {
            msg.tool_call_id = sanitizeToolId(msg.tool_call_id);
        }
        if (msg.role === 'system' && msg.name === 'example_assistant') {
            if (names.charName && !msg.content.startsWith(`${names.charName}: `) && !names.startsWithGroupName(msg.content)) {
                msg.content = `${names.charName}: ${msg.content}`;
            }
            delete msg.name;
        }

        if (msg.role === 'system' && msg.name === 'example_user') {
            if (names.userName && !msg.content.startsWith(`${names.userName}: `)) {
                msg.content = `${names.userName}: ${msg.content}`;
            }
            delete msg.name;
        }

        if (msg.name && msg.role !== 'system' && !msg.content.startsWith(`${msg.name}: `)) {
            msg.content = `${msg.name}: ${msg.content}`;
            delete msg.name;
        }
    });

    // If user role message immediately follows a tool message, append it to the last user message
    const fixToolMessages = () => {
        let rerun = true;
        while (rerun) {
            rerun = false;
            messages.forEach((message, i) => {
                if (i === messages.length - 1) {
                    return;
                }
                if (message.role === 'tool' && messages[i + 1].role === 'user') {
                    const lastUserMessage = messages.slice(0, i).findLastIndex(m => m.role === 'user' && m.content);
                    if (lastUserMessage !== -1) {
                        messages[lastUserMessage].content += '\n\n' + messages[i + 1].content;
                        messages.splice(i + 1, 1);
                        rerun = true;
                    }
                }
            });
        }
    };
    fixToolMessages();

    // If system role message immediately follows an assistant message, change its role to user
    for (let i = 0; i < messages.length - 1; i++) {
        if (messages[i].role === 'assistant' && messages[i + 1].role === 'system') {
            messages[i + 1].role = 'user';
        }
    }

    return messages;
}

/**
 * Convert a prompt from the messages objects to the format used by xAI.
 * @param {object[]} messages Array of messages
 * @param {PromptNames} names Prompt names
 * @returns {object[]} Prompt for xAI
 */
export function convertXAIMessages(messages, names) {
    if (!Array.isArray(messages)) {
        return [];
    }

    messages.forEach(msg => {
        if (!msg.name || msg.role === 'user') {
            return;
        }

        const needsCharNamePrefix = [
            { role: 'assistant', condition: names.charName && !msg.content.startsWith(`${names.charName}: `) && !names.startsWithGroupName(msg.content) },
            { role: 'system', name: 'example_assistant', condition: names.charName && !msg.content.startsWith(`${names.charName}: `) && !names.startsWithGroupName(msg.content) },
            { role: 'system', name: 'example_user', condition: names.userName && !msg.content.startsWith(`${names.userName}: `) },
        ];

        const matchingRule = needsCharNamePrefix.find(rule =>
            msg.role === rule.role && (!rule.name || msg.name === rule.name) && rule.condition,
        );

        if (matchingRule) {
            const prefix = msg.role === 'system' && msg.name === 'example_user' ? names.userName : names.charName;
            msg.content = `${prefix}: ${msg.content}`;
        }

        delete msg.name;
    });

    return messages;
}

/**
 * Merge messages with the same consecutive role, removing names if they exist.
 * @param {any[]} messages Messages to merge
 * @param {PromptNames} names Prompt names
 * @param {object} options Options for merging
 * @param {boolean} [options.strict] Enable strict mode: only allow one system message at the start, force user first message
 * @param {boolean} [options.placeholders] Add user placeholders to the messages in strict mode
 * @param {boolean} [options.single] Force every role to be user, merging all messages into one
 * @param {boolean} [options.tools] Allow tool calls in the prompt. If false, tool call messages are removed.
 * @returns {any[]} Merged messages
 */
export function mergeMessages(messages, names, { strict = false, placeholders = false, single = false, tools = false } = {}) {
    let mergedMessages = [];

    /** @type {Map<string,object>} */
    const contentTokens = new Map();

    // Remove names from the messages
    messages.forEach((message) => {
        if (!message.content) {
            message.content = '';
        }
        // Flatten contents and replace image URLs with random tokens
        if (Array.isArray(message.content)) {
            const text = message.content.map((content) => {
                if (content.type === 'text') {
                    return content.text;
                }
                // Could be extended with other non-text types
                if (['image_url', 'video_url'].includes(content.type)) {
                    const token = crypto.randomBytes(32).toString('base64');
                    contentTokens.set(token, content);
                    return token;
                }
                return '';
            }).join('\n\n');
            message.content = text;
        }
        if (message.role === 'system' && message.name === 'example_assistant') {
            if (names.charName && !message.content.startsWith(`${names.charName}: `) && !names.startsWithGroupName(message.content)) {
                message.content = `${names.charName}: ${message.content}`;
            }
        }
        if (message.role === 'system' && message.name === 'example_user') {
            if (names.userName && !message.content.startsWith(`${names.userName}: `)) {
                message.content = `${names.userName}: ${message.content}`;
            }
        }
        if (message.name && message.role !== 'system') {
            if (!message.content.startsWith(`${message.name}: `)) {
                message.content = `${message.name}: ${message.content}`;
            }
        }
        if (message.role === 'tool' && !tools) {
            message.role = 'user';
        }
        if (single) {
            if (message.role === 'assistant') {
                if (names.charName && !message.content.startsWith(`${names.charName}: `) && !names.startsWithGroupName(message.content)) {
                    message.content = `${names.charName}: ${message.content}`;
                }
            }
            if (message.role === 'user') {
                if (names.userName && !message.content.startsWith(`${names.userName}: `)) {
                    message.content = `${names.userName}: ${message.content}`;
                }
            }

            message.role = 'user';
        }
        delete message.name;
        if (!tools) {
            delete message.tool_calls;
            delete message.tool_call_id;
        }
    });

    // Squash consecutive messages with the same role
    messages.forEach((message) => {
        if (mergedMessages.length > 0 && mergedMessages[mergedMessages.length - 1].role === message.role && message.content && message.role !== 'tool') {
            mergedMessages[mergedMessages.length - 1].content += '\n\n' + message.content;
        } else {
            mergedMessages.push(message);
        }
    });

    // Prevent erroring out if the mergedMessages array is empty.
    if (mergedMessages.length === 0) {
        mergedMessages.unshift({
            role: 'user',
            content: PROMPT_PLACEHOLDER,
        });
    }

    // Check for content tokens and replace them with the actual content objects
    if (contentTokens.size > 0) {
        mergedMessages.forEach((message) => {
            const hasValidToken = Array.from(contentTokens.keys()).some(token => message.content.includes(token));

            if (hasValidToken) {
                const splitContent = message.content.split('\n\n');
                const mergedContent = [];

                splitContent.forEach((content) => {
                    if (contentTokens.has(content)) {
                        mergedContent.push(contentTokens.get(content));
                    } else {
                        if (mergedContent.length > 0 && mergedContent[mergedContent.length - 1].type === 'text') {
                            mergedContent[mergedContent.length - 1].text += `\n\n${content}`;
                        } else {
                            mergedContent.push({ type: 'text', text: content });
                        }
                    }
                });

                message.content = mergedContent;
            }
        });
    }

    if (strict) {
        for (let i = 0; i < mergedMessages.length; i++) {
            // Force mid-prompt system messages to be user messages
            if (i > 0 && mergedMessages[i].role === 'system') {
                mergedMessages[i].role = 'user';
            }
        }
        if (mergedMessages.length && placeholders) {
            if (mergedMessages[0].role === 'system' && (mergedMessages.length === 1 || mergedMessages[1].role !== 'user')) {
                mergedMessages.splice(1, 0, { role: 'user', content: PROMPT_PLACEHOLDER });
            }
            else if (mergedMessages[0].role !== 'system' && mergedMessages[0].role !== 'user') {
                mergedMessages.unshift({ role: 'user', content: PROMPT_PLACEHOLDER });
            }
        }
        return mergeMessages(mergedMessages, names, { strict: false, placeholders, single: false, tools });
    }

    return mergedMessages;
}

/**
 * Convert a prompt from the ChatML objects to the format used by Text Completion API.
 * @param {object[]} messages Array of messages
 * @returns {string} Prompt for Text Completion API
 */
export function convertTextCompletionPrompt(messages) {
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

/**
 * Append cache_control object to a Claude messages at depth. Directly modifies the messages array.
 * @param {any[]} messages Messages to modify
 * @param {number} cachingAtDepth Depth at which caching is supposed to occur
 * @param {string} ttl TTL value
 */
export function cachingAtDepthForClaude(messages, cachingAtDepth, ttl) {
    let passedThePrefill = false;
    let depth = 0;
    let previousRoleName = '';

    for (let i = messages.length - 1; i >= 0; i--) {
        if (!passedThePrefill && messages[i].role === 'assistant') {
            continue;
        }

        passedThePrefill = true;

        if (messages[i].role !== previousRoleName) {
            if (depth === cachingAtDepth || depth === cachingAtDepth + 2) {
                const content = messages[i].content;
                content[content.length - 1].cache_control = { type: 'ephemeral', ttl: ttl };
            }

            if (depth === cachingAtDepth + 2) {
                break;
            }

            depth += 1;
            previousRoleName = messages[i].role;
        }
    }
}

/**
 * Append cache_control headers to an OpenRouter request at depth. Directly modifies the
 * messages array.
 * @param {object[]} messages Array of messages
 * @param {number} cachingAtDepth Depth at which caching is supposed to occur
 * @param {string} ttl TTL value
 */
export function cachingAtDepthForOpenRouterClaude(messages, cachingAtDepth, ttl) {
    //caching the prefill is a terrible idea in general
    let passedThePrefill = false;
    //depth here is the number of message role switches
    let depth = 0;
    let previousRoleName = '';
    for (let i = messages.length - 1; i >= 0; i--) {
        if (!passedThePrefill && messages[i].role === 'assistant') {
            continue;
        }

        passedThePrefill = true;

        if (messages[i].role !== previousRoleName) {
            if (depth === cachingAtDepth || depth === cachingAtDepth + 2) {
                const content = messages[i].content;
                if (typeof content === 'string') {
                    messages[i].content = [{
                        type: 'text',
                        text: content,
                        cache_control: { type: 'ephemeral', ttl: ttl },
                    }];
                } else {
                    const contentPartCount = content.length;
                    content[contentPartCount - 1].cache_control = {
                        type: 'ephemeral',
                        ttl: ttl,
                    };
                }
            }

            if (depth === cachingAtDepth + 2) {
                break;
            }

            depth += 1;
            previousRoleName = messages[i].role;
        }
    }
}

/**
 * Calculate the Claude budget tokens for a given reasoning effort.
 * @param {number} maxTokens Maximum tokens
 * @param {string} reasoningEffort Reasoning effort
 * @param {boolean} stream If streaming is enabled
 * @returns {number?} Budget tokens
 */
export function calculateClaudeBudgetTokens(maxTokens, reasoningEffort, stream) {
    let budgetTokens = 0;

    switch (reasoningEffort) {
        case REASONING_EFFORT.auto:
            return null;
        case REASONING_EFFORT.min:
            budgetTokens = 1024;
            break;
        case REASONING_EFFORT.low:
            budgetTokens = Math.floor(maxTokens * 0.1);
            break;
        case REASONING_EFFORT.medium:
            budgetTokens = Math.floor(maxTokens * 0.25);
            break;
        case REASONING_EFFORT.high:
            budgetTokens = Math.floor(maxTokens * 0.5);
            break;
        case REASONING_EFFORT.max:
            budgetTokens = Math.floor(maxTokens * 0.95);
            break;
    }

    budgetTokens = Math.max(budgetTokens, 1024);

    if (!stream) {
        budgetTokens = Math.min(budgetTokens, 21333);
    }

    return budgetTokens;
}

/**
 * Calculate the Google budget tokens for a given reasoning effort.
 * @param {number} maxTokens Maximum tokens
 * @param {string} reasoningEffort Reasoning effort
 * @param {string} model Model name
 * @returns {number?} Budget tokens
 */
export function calculateGoogleBudgetTokens(maxTokens, reasoningEffort, model) {
    function getFlashBudget() {
        let budgetTokens = 0;

        switch (reasoningEffort) {
            case REASONING_EFFORT.auto:
                return -1;
            case REASONING_EFFORT.min:
                return 0;
            case REASONING_EFFORT.low:
                budgetTokens = Math.floor(maxTokens * 0.1);
                break;
            case REASONING_EFFORT.medium:
                budgetTokens = Math.floor(maxTokens * 0.25);
                break;
            case REASONING_EFFORT.high:
                budgetTokens = Math.floor(maxTokens * 0.5);
                break;
            case REASONING_EFFORT.max:
                budgetTokens = maxTokens;
                break;
        }

        budgetTokens = Math.min(budgetTokens, 24576);

        return budgetTokens;
    }

    function getFlashLiteBudget() {
        let budgetTokens = 0;

        switch (reasoningEffort) {
            case REASONING_EFFORT.auto:
                return -1;
            case REASONING_EFFORT.min:
                return 0;
            case REASONING_EFFORT.low:
                budgetTokens = Math.floor(maxTokens * 0.1);
                break;
            case REASONING_EFFORT.medium:
                budgetTokens = Math.floor(maxTokens * 0.25);
                break;
            case REASONING_EFFORT.high:
                budgetTokens = Math.floor(maxTokens * 0.5);
                break;
            case REASONING_EFFORT.max:
                budgetTokens = maxTokens;
                break;
        }

        budgetTokens = Math.max(Math.min(budgetTokens, 24576), 512);

        return budgetTokens;
    }

    function getProBudget() {
        let budgetTokens = 0;

        switch (reasoningEffort) {
            case REASONING_EFFORT.auto:
                return -1;
            case REASONING_EFFORT.min:
                budgetTokens = 128;
                break;
            case REASONING_EFFORT.low:
                budgetTokens = Math.floor(maxTokens * 0.1);
                break;
            case REASONING_EFFORT.medium:
                budgetTokens = Math.floor(maxTokens * 0.25);
                break;
            case REASONING_EFFORT.high:
                budgetTokens = Math.floor(maxTokens * 0.5);
                break;
            case REASONING_EFFORT.max:
                budgetTokens = maxTokens;
                break;
        }

        budgetTokens = Math.max(Math.min(budgetTokens, 32768), 128);

        return budgetTokens;
    }

    if (model.includes('flash-lite')) {
        return getFlashLiteBudget();
    }

    if (model.includes('flash')) {
        return getFlashBudget();
    }

    if (model.includes('pro')) {
        return getProBudget();
    }

    return null;
}
