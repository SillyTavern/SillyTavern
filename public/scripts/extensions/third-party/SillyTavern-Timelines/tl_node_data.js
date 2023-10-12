import { characters, getRequestHeaders, } from "../../../../script.js";
import { extension_settings, getContext, } from "../../../extensions.js";


/**
 * Preprocesses chat sessions to aggregate messages from different files into a unified structure.
 * For each message position/index across all chat files, it creates an array of messages at that position
 * from every chat file, effectively transposing the structure.
 *
 * @param {Object} channelHistory - An object where keys are file names and values are arrays of chat messages.
 * @returns {Array} allChats - A 2D array where each sub-array corresponds to a message index and contains 
 *                             objects detailing the file name, index, and actual message for each chat file.
 */
function preprocessChatSessions(channelHistory) {
    let allChats = [];

    for (const [file_name, messages] of Object.entries(channelHistory)) {
        messages.forEach((message, index) => {
            if (!allChats[index]) {
                allChats[index] = [];
            }
            allChats[index].push({
                file_name,
                index,
                message
            });
        });
    }

    return allChats;
}

/**
 * Constructs nodes and associated edges for each message index based on processed chat sessions.
 * Nodes are created for each unique message content across chat files at each message position,
 * and edges represent the message order and source file. The function also handles special
 * nodes, such as swipes, and ensures they are properly connected in the graph.
 * 
 * @param {Array} allChats - A 2D array resulting from `preprocessChatSessions`, where each sub-array 
 *                           corresponds to a message index and contains objects detailing the file name, 
 *                           index, and actual message for each chat file.
 * @returns {Array} cyElements - A list of node and edge objects suitable for the Cytoscape graph library.
 * 
 * Behavior:
 * 1. Initializes a root node and sets up tracking for previous nodes.
 * 2. Iterates over each message index, grouping messages by content.
 * 3. For each group of messages, constructs a node and an associated edge.
 * 4. Handles special nodes, such as swipes, and ensures they are properly added.
 * 5. Returns the full list of constructed nodes and edges.
 */

function buildNodes(allChats) {
    let cyElements = [];
    let keyCounter = 1;
    let previousNodes = {};
    let parentSwipeData = {};

    // Initialize root node
    cyElements.push({
        group: 'nodes',
        data: {
            id: "root",
            label: "root",
            x: 0,
            y: 0,
        }
    });

    // Initialize previousNodes
    allChats[0].forEach(({ file_name }) => {
        previousNodes[file_name] = "root";
    });

    for (let messagesAtIndex = 0; messagesAtIndex < allChats.length; messagesAtIndex++) {
        let groups = groupMessagesByContent(allChats[messagesAtIndex]);

        for (const [text, group] of Object.entries(groups)) {
            let nodeId = `message${keyCounter}`;
            let parentNodeId = previousNodes[group[0].file_name];

            let node = createNode(nodeId, parentNodeId, text, group);

            // If it's not the first node, extract swipes and store node and edge data for the parent node
            if (messagesAtIndex !== 0) {
                let allSwipes = [];
                group.forEach(messageObj => {
                    const swipes = messageObj.message.swipes || [];
                    allSwipes.push(...swipes);
                });

                // Deduplicating swipes and filtering out swipes with same content as the message
                let uniqueSwipes = [...new Set(allSwipes)].filter(swipeText => swipeText !== text);

                if (!parentSwipeData[parentNodeId]) {
                    parentSwipeData[parentNodeId] = {
                        storedSwipes: [],
                        totalSwipes: 0,
                        currentSwipeIndex: uniqueSwipes.indexOf(text)
                    };
                }

                parentSwipeData[parentNodeId].totalSwipes += uniqueSwipes.length;

                // Store node and edge data for each swipe in parentSwipeData
                uniqueSwipes.forEach(swipeText => {
                    let swipeNodeId = `swipe${keyCounter}-${parentSwipeData[parentNodeId].totalSwipes}`;
                    let swipeIndex = allSwipes.indexOf(swipeText);  // Fetching the index of the swipe from the original swipes list
                    let swipeNode = {
                        ...node,
                        id: swipeNodeId,
                        msg: swipeText,
                        isSwipe: true,
                        swipeId: swipeIndex  // Storing the index as swipeId in the node data
                    };
                    delete swipeNode.swipes;

                    let swipeEdge = {
                        id: `edgeSwipe${keyCounter}`,
                        source: parentNodeId,
                        target: swipeNodeId,
                        isSwipe: true,
                        swipeId: swipeIndex  // Storing the index as swipeId in the edge data
                    };

                    parentSwipeData[parentNodeId].storedSwipes.push({ node: swipeNode, edge: swipeEdge });
                    keyCounter += 1;
                });
            }

            cyElements.push({
                group: 'nodes',
                data: node
            });

            // Create edge for this node
            cyElements.push({
                group: 'edges',
                data: {
                    id: `edge${keyCounter}`,
                    source: parentNodeId,
                    target: nodeId
                }
            });

            keyCounter += 1;

            updatePreviousNodes(previousNodes, nodeId, group);
        }
    }

    // Update cyElements with data from parentSwipeData
    cyElements.forEach(element => {
        if (element.group === 'nodes' && parentSwipeData[element.data.id]) {
            Object.assign(element.data, parentSwipeData[element.data.id]);
        }
    });

    return cyElements;
}


/**
 * Constructs a Cytoscape node object based on provided message details.
 * The function identifies special messages, such as bookmarks, and adjusts the node
 * properties accordingly. The returned node contains properties that help render and
 * differentiate it within the Cytoscape graph, such as color for bookmarks.
 * 
 * @param {string} nodeId - The unique ID to assign to the node.
 * @param {string} parentNodeId - The ID of the node from which this node originates (previous message).
 * @param {string} text - The message content.
 * @param {Array} group - A list of message objects that share the same content across chat files.
 * @returns {Object} - A Cytoscape node object with properties set based on the message details.
 * 
 * Behavior:
 * 1. Checks if any message in the group is a bookmark and extracts relevant details.
 * 2. Determines node properties, such as color for bookmarks, based on the message details.
 * 3. Constructs and returns the node object.
 */
function createNode(nodeId, parentNodeId, text, group) {
    let bookmark = group.find(({ message }) => {
        // Check if the message is from the system and if it indicates a bookmark
        if (message.is_system && message.mes.includes("Bookmark created! Click here to open the bookmark chat")) return true;

        // Original bookmark case
        return !!message.extra && !!message.extra.bookmark_link;
    });

    let isBookmark = Boolean(bookmark);

    // Extract bookmarkName and fileNameForNode depending on bookmark type
    let bookmarkName, fileNameForNode;
    if (isBookmark) {
        if (bookmark.message.extra && bookmark.message.extra.bookmark_link) {
            bookmarkName = bookmark.message.extra.bookmark_link;
            fileNameForNode = bookmark.file_name;
        } else {
            // Extract file_name from the anchor tag in 'mes'
            let match = bookmark.message.mes.match(/file_name=\"(.*?)\"/);
            bookmarkName = match ? match[1] : null;
            fileNameForNode = bookmarkName;
        }
    } else {
        fileNameForNode = group[0].file_name;
    }


    let { is_name, is_user, name, send_date, is_system } = group[0].message;  // Added is_system here

    return {
        id: nodeId,
        msg: text,
        isBookmark: isBookmark,
        bookmarkName: bookmarkName,
        file_name: fileNameForNode,
        is_name: is_name,
        is_user: is_user,
        is_system: is_system,  // Added is_system to node properties
        name: name,
        send_date: send_date,
        messageIndex: group[0].index,
        color: isBookmark ? generateUniqueColor() : null,
        chat_sessions: group.map(({ file_name }) => file_name),
        chat_sessions_str: ';' + group.map(({ file_name }) => file_name).join(';') + ';',
    };
}

/**
 * Groups messages by their content to create a collection of unique messages.
 * This function helps in creating a representative node for each unique message across chat sessions.
 *
 * @param {Array} messages - A list of message objects, each containing file_name and message details.
 * @returns {Object} groups - An object where the key is the unique message content and the value is 
 *                            an array of message objects that share that content.
 */
function groupMessagesByContent(messages) {
    let groups = {};
    messages.forEach((messageObj, index) => {
        let { file_name, message } = messageObj;
        //System agnostic check for newlines
        try {
            message.mes = message.mes.replace(/\r\n/g, '\n');
            if (!groups[message.mes]) {
                groups[message.mes] = [];
            }
            groups[message.mes].push({ file_name, index, message });
        } catch (e) {
            console.log(`Message Grouping Error: ${e}: ${JSON.stringify(message, null, 4)}`);
        }
    });
    return groups;
}

/**
 * Updates the record of the last node associated with each chat in a given group.
 * This function is used during node creation to keep track of the originating node for each message.
 *
 * @param {Object} previousNodes - An object where keys are file names and values are the most recent node keys.
 * @param {string} nodeKey - The unique key of the node being processed.
 * @param {Array} group - A list of message objects that share the same content across chat files.
 */
function updatePreviousNodes(previousNodes, nodeKey, group) {
    group.forEach(({ file_name }) => {
        previousNodes[file_name] = nodeKey;
    });
}

/**
 * Postprocesses the constructed nodes, allowing for potential modifications or additions.
 * Currently a placeholder; it can be expanded with additional steps if required in the future.
 *
 * @param {Array} nodeData - A list of node objects constructed by the buildNodes function.
 * @returns {Array} nodeData - The potentially modified list of node objects.
 */
function postprocessNodes(nodeData) {
    // Placeholder for now; add additional steps if needed
    return nodeData;
}

/**
 * Converts a given chat history into elements suitable for visualization in Cytoscape.
 * This function orchestrates the entire process, from preprocessing chat sessions to postprocessing nodes.
 *
 * @param {Object} chatHistory - An object containing chat files as keys and their message sequences as values.
 * @returns {Array} nodeData - A list of node (and potentially edge) objects suitable for Cytoscape graph library.
 */
function convertToCytoscapeElements(chatHistory) {
    let allChats = preprocessChatSessions(chatHistory);
    let nodeData = buildNodes(allChats);
    nodeData = postprocessNodes(nodeData);
    return nodeData;
}

/**
 * Generate a unique random RGB color string.
 *
 * @returns {string} Random RGB color in the format "rgb(r, g, b)".
 */
export function generateUniqueColor() {
    const randomRGBValue = () => Math.floor(Math.random() * 256);
    return `rgb(${randomRGBValue()}, ${randomRGBValue()}, ${randomRGBValue()})`;
}

/**
 * Fetches all chats associated with a specific character based on their avatar URL.
 * 
 * @async
 * @param {string} characterAvatar - The URL of the character's avatar, used as an identifier to fetch chats.
 * @returns {Promise<Object|undefined>} A promise that resolves with the JSON representation of the chat data 
 *                                      or undefined if the fetch request is not successful.
 * @throws Will throw an error if there's an issue with the fetch request itself.
 */
export async function fetchData(characterAvatar) {
    const response = await fetch("/getallchatsofcharacter", {
        method: 'POST',
        body: JSON.stringify({ avatar_url: characterAvatar }),
        headers: getRequestHeaders(),
    });
    if (!response.ok) {
        return;
    }
    return response.json();
}

/**
 * Prepares chat data by fetching detailed chat content, sorting by file names, and converting
 * the consolidated data into a format suitable for Cytoscape visualization. This function
 * fetches individual or group chat data based on the `isGroupChat` flag.
 *
 * @async
 * @param {Object} data - A dictionary containing summary or metadata of chats.
 * @param {boolean} isGroupChat - A flag indicating whether the chat data is for group chats (true) 
 *                                or individual chats (false).
 * @returns {Promise<Array>} A promise that resolves with a list of nodes (and potentially edges) 
 *                           suitable for the Cytoscape graph library.
 * @throws Will throw an error if the fetch request or data processing encounters issues.
 */
export async function prepareData(data, isGroupChat) {
    const context = getContext();
    let chat_dict = {};
    let chat_list = Object.values(data).sort((a, b) => a["file_name"].localeCompare(b["file_name"])).reverse();

    for (const { file_name } of chat_list) {
        try {
            const endpoint = isGroupChat ? '/getgroupchat' : '/getchat';
            const requestBody = isGroupChat
                ? JSON.stringify({ id: file_name })
                : JSON.stringify({
                    ch_name: characters[context.characterId].name,
                    file_name: file_name.replace('.jsonl', ''),
                    avatar_url: characters[context.characterId].avatar
                });

            const chatResponse = await fetch(endpoint, {
                method: 'POST',
                headers: getRequestHeaders(),
                body: requestBody,
                cache: 'no-cache',
            });

            if (!chatResponse.ok) {
                continue;
            }

            const currentChat = await chatResponse.json();
            if (!isGroupChat) {
                // remove the first message, which is metadata, only for individual chats
                currentChat.shift();
            }
            chat_dict[file_name] = currentChat;

        } catch (error) {
            console.error(error);
        }
    }
    return convertToCytoscapeElements(chat_dict);
}