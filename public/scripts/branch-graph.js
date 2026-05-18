/**
 * Branch Graph Module
 * Handles visualization and navigation of chat branch trees
 */

import {
    characters,
    this_chid,
    openCharacterChat,
    getRequestHeaders,
    saveChatConditional,
    getCurrentChatDetails,
} from '../script.js';
import {
    openGroupChat,
    selected_group,
} from './group-chats.js';
import { hideLoader, showLoader } from './loader.js';
import { Popup, POPUP_TYPE, POPUP_RESULT } from './popup.js';
import { renderTemplateAsync } from './templates.js';
import { timestampToMoment } from './utils.js';
import { compressRequest } from './request-compression.js';

/**
 * Fetches chat metadata including parent and branch information.
 * @param {string} chatName Chat filename (without .jsonl)
 * @returns {Promise<{main_chat: string, branches: string[], messages: any[]}|null>}
 */
export async function fetchChatMetadata(chatName) {
    try {
        const request = selected_group
            ? {
                url: '/api/chats/group/get',
                body: { id: chatName },
            }
            : {
                url: '/api/chats/get',
                body: {
                    ch_name: characters[this_chid]?.name,
                    file_name: chatName,
                    avatar_url: characters[this_chid]?.avatar,
                },
            };

        const metaResponse = await fetch(request.url, {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(request.body),
        });

        if (!metaResponse.ok) {
            return null;
        }

        const chatData = await metaResponse.json();

        let chat_metadata_obj = null;
        let messages = [];

        if (Array.isArray(chatData)) {
            if (chatData.length > 0) {
                chat_metadata_obj = chatData[0].chat_metadata;
                messages = chatData.slice(1);
            }
        } else {
            chat_metadata_obj = chatData.chat_metadata;
            messages = chatData.chat || [];
        }

        const branches = [];

        if (Array.isArray(messages)) {
            for (const message of messages) {
                if (message?.extra?.branches && Array.isArray(message.extra.branches)) {
                    branches.push(...message.extra.branches);
                }
            }
        }

        return {
            main_chat: chat_metadata_obj?.main_chat,
            branches: [...new Set(branches)],
            messages: messages,
        };
    } catch (err) {
        console.error('[BranchMetadata] Error fetching metadata for', chatName, ':', err);
        return null;
    }
}

/**
 * Traverses the branch tree starting from a chat to collect all related chats.
 * @param {string} startChatName Starting chat filename
 * @param {Map<string, any>} chatMap Map of all available chats
 * @returns {Promise<{relatedChats: Set<string>, metadataCache: Map<string, any>, rootChatName: string}>}
 */
export async function traverseBranchTree(startChatName, chatMap) {
    const relatedChats = new Set([startChatName]);
    const metadataCache = new Map();

    // Find root by going up the parent chain
    let rootChatName = startChatName;
    let current = startChatName;
    const visited = new Set();

    while (current && !visited.has(current)) {
        visited.add(current);
        relatedChats.add(current);

        const metadata = await fetchChatMetadata(current);
        if (metadata) {
            metadataCache.set(current, metadata);
            const parent = metadata.main_chat;

            if (parent && chatMap.has(parent)) {
                rootChatName = parent;
                current = parent;
            } else {
                break;
            }
        } else {
            break;
        }
    }

    // Traverse down from root to collect all children
    async function collectChildren(chatName, visitedInPath = new Set()) {
        if (visitedInPath.has(chatName)) {
            return;
        }

        visitedInPath.add(chatName);

        if (!metadataCache.has(chatName)) {
            const metadata = await fetchChatMetadata(chatName);
            if (metadata) {
                metadataCache.set(chatName, metadata);
            }
        }

        const metadata = metadataCache.get(chatName);

        if (metadata?.branches) {
            for (const branchName of metadata.branches) {
                if (chatMap.has(branchName) && !relatedChats.has(branchName)) {
                    relatedChats.add(branchName);
                    await collectChildren(branchName, new Set(visitedInPath));
                }
            }
        }
    }

    await collectChildren(rootChatName);

    return { relatedChats, metadataCache, rootChatName };
}

/**
 * Updates branch references in a message's metadata
 * @param {Object} message Message object
 * @param {string} oldFileName Old filename to replace
 * @param {string} newFileName New filename to use
 * @returns {boolean} True if changes were made
 */
function updateBranchReferencesInMessage(message, oldFileName, newFileName) {
    if (!message?.extra?.branches || !Array.isArray(message.extra.branches)) {
        return false;
    }

    const branchIndex = message.extra.branches.indexOf(oldFileName);
    if (branchIndex !== -1) {
        message.extra.branches[branchIndex] = newFileName;
        return true;
    }

    return false;
}

/**
 * Updates branch references in all messages of a chat
 * @param {Array} messages Array of message objects
 * @param {string} oldFileName Old filename to replace
 * @param {string} newFileName New filename to use
 * @returns {boolean} True if any changes were made
 */
function updateBranchReferencesInMessages(messages, oldFileName, newFileName) {
    let hadChanges = false;

    for (const message of messages) {
        if (updateBranchReferencesInMessage(message, oldFileName, newFileName)) {
            hadChanges = true;
        }
    }

    return hadChanges;
}

/**
 * Constructs chat data with header for saving
 * @param {Object} metadata Chat metadata
 * @returns {Array} Chat data array with header
 */
function constructChatData(metadata) {
    const chatHeader = {
        chat_metadata: metadata.main_chat ? { main_chat: metadata.main_chat } : {},
        user_name: 'unused',
        character_name: 'unused',
    };

    return [chatHeader, ...metadata.messages];
}

/**
 * Saves updated chat data for a group chat
 * @param {string} chatName Chat filename
 * @param {Array} chatData Chat data to save
 * @returns {Promise<boolean>} True if successful
 */
async function saveGroupChat(chatName, chatData) {
    try {
        const saveChatRequest = await compressRequest({
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ id: chatName, chat: chatData }),
        });
        const saveChatResponse = await fetch('/api/chats/group/save', saveChatRequest);

        if (!saveChatResponse.ok) {
            console.error(`Failed to update branch metadata in group chat: ${chatName}`);
            return false;
        }

        console.log(`Updated branch metadata in group chat: ${chatName}`);
        return true;
    } catch (error) {
        console.error(`Error saving group chat ${chatName}:`, error);
        return false;
    }
}

/**
 * Saves updated chat data for a character chat
 * @param {string} chatName Chat filename
 * @param {Array} chatData Chat data to save
 * @returns {Promise<boolean>} True if successful
 */
async function saveCharacterChat(chatName, chatData) {
    try {
        const saveChatRequest = await compressRequest({
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                ch_name: characters[this_chid]?.name,
                file_name: chatName,
                chat: chatData,
                avatar_url: characters[this_chid]?.avatar,
            }),
        });
        const saveChatResponse = await fetch('/api/chats/save', saveChatRequest);

        if (!saveChatResponse.ok) {
            console.error(`Failed to update branch metadata in chat: ${chatName}`);
            return false;
        }

        console.log(`Updated branch metadata in chat: ${chatName}`);
        return true;
    } catch (error) {
        console.error(`Error saving character chat ${chatName}:`, error);
        return false;
    }
}

/**
 * Saves chat data (group or character)
 * @param {string} chatName Chat filename
 * @param {Array} chatData Chat data to save
 * @returns {Promise<boolean>} True if successful
 */
async function saveChat(chatName, chatData) {
    if (selected_group) {
        return await saveGroupChat(chatName, chatData);
    } else {
        return await saveCharacterChat(chatName, chatData);
    }
}

/**
 * Updates branch metadata across the branch tree after a chat is renamed.
 * @param {string} oldFileName Old chat filename (without .jsonl)
 * @param {string} newFileName New chat filename (without .jsonl)
 */
export async function updateBranchMetadataAfterRename(oldFileName, newFileName) {
    try {
        const chatMap = await fetchAllChats();

        if (!chatMap.has(newFileName)) {
            console.warn(`Renamed chat ${newFileName} not found in chat list`);
            return;
        }

        const { relatedChats, metadataCache } = await traverseBranchTree(newFileName, chatMap);

        for (const chatName of relatedChats) {
            const metadata = metadataCache.get(chatName);
            if (!metadata?.messages) {
                continue;
            }

            let hadChanges = updateBranchReferencesInMessages(metadata.messages, oldFileName, newFileName);

            if (metadata.main_chat === oldFileName) {
                metadata.main_chat = newFileName;
                hadChanges = true;
            }

            if (hadChanges) {
                const chatData = constructChatData(metadata);
                await saveChat(chatName, chatData);
            }
        }
    } catch (error) {
        console.error('Error updating branch metadata after rename:', error);
    }
}

/**
 * Fetches all chats for the current character or group
 * @returns {Promise<Map<string, any>>} Map of chat filename to chat data
 */
async function fetchAllChats() {
    const response = await fetch('/api/chats/search', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            query: '',
            avatar_url: selected_group ? null : characters[this_chid]?.avatar,
            group_id: selected_group || null,
        }),
    });

    if (!response.ok) {
        throw new Error('Failed to fetch chat list');
    }

    const allChats = await response.json();
    return new Map(allChats.map(chat => [chat.file_name, chat]));
}

/**
 * Builds a tree structure from the branch data
 * @param {string} chatName Root chat name
 * @param {Map<string, any>} chatMap Map of all chats
 * @param {Map<string, any>} metadataCache Cached metadata
 * @param {number} depth Current depth in tree
 * @returns {Object|null} Tree node or null
 */
function buildTree(chatName, chatMap, metadataCache, depth = 0) {
    const chat = chatMap.get(chatName);
    if (!chat) {
        return null;
    }

    const metadata = metadataCache.get(chatName);
    const children = (metadata?.branches || [])
        .filter(childName => chatMap.has(childName))
        .map(childName => buildTree(childName, chatMap, metadataCache, depth + 1))
        .filter(Boolean);

    return {
        name: chatName,
        chat: chat,
        children: children,
        depth: depth,
    };
}

/**
 * Removes duplicate nodes from the tree (keeps first occurrence only)
 * @param {Object} node Tree node
 * @param {Set<string>} seen Set of seen node names
 * @returns {Object|null} Cleaned node or null
 */
function removeDuplicates(node, seen = new Set()) {
    if (seen.has(node.name)) {
        return null;
    }
    seen.add(node.name);

    node.children = node.children
        .map(child => removeDuplicates(child, seen))
        .filter(Boolean);

    return node;
}

/**
 * Calculates the width needed for a subtree
 * @param {Object} node Tree node
 * @returns {number} Width in node units
 */
function getSubtreeWidth(node) {
    if (node.children.length === 0) return 1;
    return node.children.reduce((sum, child) => sum + getSubtreeWidth(child), 0);
}

/**
 * Calculates layout positions for each node in the tree
 * @param {Object} node Tree node
 * @param {number} depth Current depth
 * @param {number} leftOffset Left offset position
 * @returns {Object} Node with layout information
 */
function calculateLayout(node, depth = 0, leftOffset = 0) {
    const subtreeWidth = getSubtreeWidth(node);

    node.layout = {
        depth: depth,
        leftOffset: leftOffset,
        width: subtreeWidth,
        x: leftOffset + (subtreeWidth - 1) / 2,
    };

    let childOffset = leftOffset;
    for (const child of node.children) {
        calculateLayout(child, depth + 1, childOffset);
        childOffset += getSubtreeWidth(child);
    }

    return node;
}

/**
 * Organizes nodes by depth level
 * @param {Object} node Tree node
 * @param {Array<Array>} levels Array of levels
 * @returns {Array<Array>} Organized levels
 */
function organizeByLevels(node, levels = []) {
    if (!levels[node.layout.depth]) {
        levels[node.layout.depth] = [];
    }
    levels[node.layout.depth].push(node);

    for (const child of node.children) {
        organizeByLevels(child, levels);
    }

    return levels;
}

/**
 * Prepares graph data for rendering
 * @param {Array<Array>} levels Organized node levels
 * @param {string} currentChatName Current chat filename
 * @returns {Object} Graph data with lines and nodes
 */
function prepareGraphData(levels, currentChatName) {
    const nodeWidth = 280;
    const nodeHeight = 120;
    const horizontalGap = 20;
    const verticalGap = 60;

    const maxWidth = Math.max(...levels.map(level =>
        Math.max(...level.map(node => node.layout.x)),
    )) + 1;

    const totalWidth = maxWidth * (nodeWidth + horizontalGap);
    const totalHeight = levels.length * (nodeHeight + verticalGap);

    const lines = [];
    const nodes = [];

    // Collect connection lines
    for (const level of levels) {
        for (const node of level) {
            const parentX = node.layout.x * (nodeWidth + horizontalGap) + nodeWidth / 2;
            const parentY = node.layout.depth * (nodeHeight + verticalGap) + nodeHeight;

            for (const child of node.children) {
                const childX = child.layout.x * (nodeWidth + horizontalGap) + nodeWidth / 2;
                const childY = child.layout.depth * (nodeHeight + verticalGap);

                lines.push({ x1: parentX, y1: parentY, x2: childX, y2: childY });
            }
        }
    }

    // Collect nodes
    for (const level of levels) {
        for (const node of level) {
            const isCurrentChat = node.name === currentChatName;
            const momentDate = timestampToMoment(node.chat.last_mes);
            const formattedDate = momentDate.isValid() ? momentDate.format('lll') : 'Unknown date';
            const messageCount = node.chat.message_count || 0;
            const preview = node.chat.preview_message || '(No messages)';

            const x = node.layout.x * (nodeWidth + horizontalGap);
            const y = node.layout.depth * (nodeHeight + verticalGap);

            nodes.push({
                name: node.name,
                isCurrentChat,
                formattedDate,
                messageCount,
                preview,
                x,
                y,
                width: nodeWidth,
            });
        }
    }

    return { totalWidth, totalHeight, lines, nodes };
}

/**
 * Shows the branch graph popup and handles user interaction
 * @param {Object} graphData Graph data with lines and nodes
 * @returns {Promise<string|null>} Selected chat filename or null
 */
async function showGraphPopup(graphData) {
    const { totalWidth, totalHeight, lines, nodes } = graphData;
    const graphHTML = await renderTemplateAsync('branchGraph', { totalWidth, totalHeight, lines, nodes });

    let selectedName = null;

    const popup = new Popup(graphHTML, POPUP_TYPE.TEXT, '', {
        okButton: false,
        cancelButton: 'Close',
        wide: true,
        large: true,
        onOpen: () => {
            popup.dlg.classList.add('branch-graph-popup');
            $('.branch-graph-node').each(function () {
                const nodeIndex = parseInt($(this).attr('data-node-index'));
                const node = nodes[nodeIndex];
                $(this).attr('data-file-name', node.name);
                $(this).find('.branch-node-name-text').text(node.name);
                $(this).find('.branch-node-preview-text').text(node.preview);

                if (!node.isCurrentChat) {
                    $(this).on('click', () => {
                        selectedName = node.name;
                        popup.completeAffirmative();
                    });
                }
            });
        },
    });

    const result = await popup.show();

    if (result !== POPUP_RESULT.AFFIRMATIVE || !selectedName) {
        return null;
    }

    return selectedName;
}

/**
 * Switches to the selected chat
 * @param {string} chatFileName Chat filename to switch to
 */
async function switchToChat(chatFileName) {
    try {
        showLoader();
        await saveChatConditional();

        if (selected_group) {
            await openGroupChat(selected_group, chatFileName);
        } else {
            await openCharacterChat(chatFileName);
        }
    } finally {
        await hideLoader();
    }
}

/**
 * Main function to show the branch graph
 * Displays a visual tree of all related chats and allows navigation
 */
export async function showBranchGraph() {
    try {
        showLoader();

        const currentChatName = (getCurrentChatDetails()).sessionName;

        if (!currentChatName) {
            toastr.info('Please open a chat first.', 'No chat loaded');
            return;
        }

        const chatMap = await fetchAllChats();
        const { relatedChats, metadataCache, rootChatName } = await traverseBranchTree(currentChatName, chatMap);

        const tree = buildTree(rootChatName, chatMap, metadataCache);

        if (!tree) {
            toastr.error('Failed to build branch graph.', 'Error');
            return;
        }

        const cleanTree = removeDuplicates(tree);
        calculateLayout(cleanTree);
        const levels = organizeByLevels(cleanTree);
        const graphData = prepareGraphData(levels, currentChatName);

        const selectedChatName = await showGraphPopup(graphData);

        if (selectedChatName && selectedChatName !== currentChatName) {
            await switchToChat(selectedChatName);
        }
    } catch (error) {
        console.error('[BranchGraph] Error showing branch graph:', error);
        toastr.error('Failed to load branch graph. Please try again.', 'Error');
    } finally {
        await hideLoader();
    }
}
