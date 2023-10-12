import { extension_settings, getContext, loadExtensionSettings } from "../../../extensions.js";
import { characters, getRequestHeaders, openCharacterChat, saveSettingsDebounced, getThumbnailUrl } from "../../../../script.js";
import { power_user } from "../../../power-user.js";


/**
 * Extracts the alpha (opacity) value from a given RGBA color string.
 *
 * @param {string} rgbaString - The RGBA color string in the format "rgba(r, g, b, a)".
 * @returns {number|null} The extracted alpha value as a float or null if no match is found.
 */
function getAlphaFromRGBA(rgbaString) {
    const match = rgbaString.match(/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*(\d*(?:\.\d+)?)\s*\)/);
    return match ? parseFloat(match[1]) : null;
}

/**
 * Highlights the path from a specified bookmark node to the root in a data structure representing a graph.
 * The function iteratively traces and highlights edges and nodes, adjusting visual attributes like color, thickness, and zIndex.
 *
 * @param {Object} rawData - The data structure representing the graph with nodes and edges.
 * @param {string|number} bookmarkNodeId - The ID of the bookmark node to start highlighting from.
 * @param {number} currentHighlightThickness - The starting thickness for highlighting edges (default is 4).
 * @param {number} startingZIndex - The starting zIndex for nodes and edges to be highlighted (default is 1000).
 */
function highlightPathToRoot(rawData, bookmarkNodeId, currentHighlightThickness = 4, startingZIndex = 1000) {
    let bookmarkNode = Object.values(rawData).find(entry =>
        entry.group === 'nodes' && entry.data.id === bookmarkNodeId
    );

    if (!bookmarkNode) {
        console.error("Bookmark node not found!");
        return;
    }

    let currentNode = bookmarkNode;
    let currentZIndex = startingZIndex;
    while (currentNode) {
        // If the current node has the isBookmark attribute and it's not the initial bookmarkNode, stop highlighting
        if (currentNode !== bookmarkNode && currentNode.data.isBookmark) {
            break; // exit from the while loop
        }

        let incomingEdge = Object.values(rawData).find(entry =>
            entry.group === 'edges' && entry.data.target === currentNode.data.id
        );

        if (incomingEdge) {
            incomingEdge.data.isHighlight = true;
            incomingEdge.data.color = bookmarkNode.data.color;
            incomingEdge.data.bookmarkName = bookmarkNode.data.bookmarkName;
            incomingEdge.data.highlightThickness = currentHighlightThickness;

            // Set the zIndex of the incomingEdge
            incomingEdge.data.zIndex = currentZIndex;
            currentNode.data.borderColor = incomingEdge.data.color;
            currentZIndex++; // Increase the zIndex for the next edge in the path

            currentHighlightThickness = Math.min(currentHighlightThickness + 0.1, 6);
            currentNode = Object.values(rawData).find(entry =>
                entry.group === 'nodes' && entry.data.id === incomingEdge.data.source
            );
        } else {
            currentNode = null;
        }
    }
}

/**
 * Sets up visual styles for nodes and edges based on provided node data and context settings. 
 * This function prepares styles that are to be used with Cytoscape to visually represent a graph.
 * Depending on extension settings and context, different colors, shapes, and styles are applied to nodes and edges.
 * Additionally, paths from bookmarked nodes to the root are highlighted.
 *
 * @param {Object} nodeData - Data structure representing the graph with nodes and edges.
 * @returns {Array} An array of style definitions suitable for use with Cytoscape.
 */
export function setupStylesAndData(nodeData) {
    const context = getContext();
    let selected_group = context.groupId;
    let group = context.groups.find(group => group.id === selected_group);
    let this_chid = context.characterId;
    const avatarImg = selected_group ? group?.avatar_url : getThumbnailUrl('avatar', characters[this_chid]['avatar']);

    let theme = {};
    if (extension_settings.timeline.useChatColors) {
        theme.charNodeColor = power_user.main_text_color;
        theme.edgeColor = power_user.italics_text_color;
        theme.userNodeColor = power_user.quote_text_color;
        theme.bookmarkColor = 'rgba(255, 215, 0, 1)' // gold
        // power_user.blur_tint_color;
        // power_user.user_mes_blur_tint_color;
        // power_user.bot_mes_blur_tint_color;
        // power_user.shadow_color;
    }
    else {
        theme.charNodeColor = extension_settings.timeline.charNodeColor;
        theme.edgeColor = extension_settings.timeline.edgeColor;
        theme.userNodeColor = extension_settings.timeline.userNodeColor;
        theme.bookmarkColor = extension_settings.timeline.bookmarkColor;
    }

    Object.values(nodeData).forEach(entry => {
        if (entry.group === 'nodes' && entry.data.isBookmark) {
            highlightPathToRoot(nodeData, entry.data.id);
        }
    });

    const cytoscapeStyles = [
        {
            selector: 'edge',
            style: {
                'curve-style': extension_settings.timeline.curveStyle,
                'taxi-direction': 'rightward',
                'segment-distances': [5, 5], // corner radius
                'line-color': function (ele) {
                    return ele.data('isHighlight') ? ele.data('color') : theme.edgeColor;
                },
                'line-opacity': function (ele) {
                    return ele.data('isHighlight') ? 1 : getAlphaFromRGBA(theme.edgeColor);
                },
                'width': function (ele) {
                    return ele.data('highlightThickness') ? ele.data('highlightThickness') : 3;
                },
                'z-index': function (ele) {
                    return ele.data('zIndex') ? ele.data('zIndex') : 1;
                }
            }
        },
        {
            selector: 'node',
            style: {
                'width': function (ele) {
                    let totalSwipes = Number(ele.data('totalSwipes'));
                    if (isNaN(totalSwipes)) {
                        totalSwipes = 0;
                    }
                    return extension_settings.timeline.swipeScale ? Math.abs(Math.log(totalSwipes + 1))*4 + Number(extension_settings.timeline.nodeWidth) : extension_settings.timeline.nodeWidth;
                },
                'height': function (ele) {
                    let totalSwipes = Number(ele.data('totalSwipes'));
                    if (isNaN(totalSwipes)) {
                        totalSwipes = 0;
                    }
                    return extension_settings.timeline.swipeScale ? Math.abs(Math.log(totalSwipes + 1))*4 + Number(extension_settings.timeline.nodeHeight) : extension_settings.timeline.nodeHeight;
                },

                'shape': extension_settings.timeline.nodeShape, // or 'circle'
                'background-color': function (ele) {
                    return ele.data('is_user') ? theme.userNodeColor : theme.charNodeColor
                },
                'background-opacity': function (ele) {
                    return ele.data('is_user') ? getAlphaFromRGBA(theme.userNodeColor) : getAlphaFromRGBA(theme.charNodeColor);
                },
                'border-color': function (ele) {
                    return ele.data('isBookmark') ? theme.bookmarkColor : ele.data('borderColor') ? ele.data('borderColor') : ele.data('totalSwipes') ? (ele.data('is_user') ? theme.userNodeColor : theme.charNodeColor) : "black";
                },
                'border-width': function (ele) {
                    return ele.data('isBookmark')|| ele.data('totalSwipes') ? 5 : ele.data('borderColor') ? 3 : 0;
                },
                'border-opacity': function (ele) {
                    return ele.data('isBookmark') ? getAlphaFromRGBA(theme.bookmarkColor) : ele.data('borderColor') ? 1 : ele.data('totalSwipes') > 0 ? 1 : 0;
                },
                'border-style': function (ele) {
                    return ele.data('totalSwipes') > 0 ? 'double' : 'solid';
                }
            }
        },
        {
            selector: 'node[label="root"]',
            style: {
                'background-image': extension_settings.timeline.avatarAsRoot ? avatarImg : 'none',
                'background-fit': extension_settings.timeline.avatarAsRoot ? 'cover' : 'none',
                'width': extension_settings.timeline.avatarAsRoot ? '40px' : extension_settings.timeline.nodeWidth,
                'height': extension_settings.timeline.avatarAsRoot ? '50px' : extension_settings.timeline.nodeHeight,
                'shape': extension_settings.timeline.avatarAsRoot ? 'rectangle' : extension_settings.timeline.nodeShape,
            }
        },

        {
            selector: 'node[?is_system]',  // Select nodes with is_system property set to true
            style: {
                'background-color': 'grey',
                'border-style': 'dashed',
                'border-width': 3,
                'border-color': function (ele) {
                    return ele.data('isBookmark') ? extension_settings.timeline.bookmarkColor : ele.data('borderColor') ? ele.data('borderColor') : "black";
                },
            }
        },
        {
            selector: 'node[?isSwipe]',  // Select nodes with is_system property set to true
            style: {
                'background-opacity': .5,
                'border-width': 3,
                'border-color': function (ele) {
                    return ele.data('isBookmark') ? extension_settings.timeline.bookmarkColor : ele.data('borderColor') ? ele.data('borderColor') : "grey";
                },
                'border-style': 'dashed',
                'border-opacity': 1,
            }
        },
        {
            selector: 'edge[?isSwipe]', 

            style: {
                'line-style': 'dashed',
                'line-opacity': .5,
            }
        },

    ];

    return cytoscapeStyles;
}

/**
 * Highlights specific elements (nodes or edges) in a Cytoscape graph based on a given selector string.
 * Initially, all elements in the graph are dimmed. Based on the provided selector, matching nodes or edges are then
 * highlighted with a white underlay. If the selector pertains to an edge with a specific color, nodes with the same
 * border color are also highlighted.
 *
 * @param {Object} cy - The Cytoscape instance containing the graph elements.
 * @param {string} selector - A Cytoscape-compatible selector string used to determine which elements to highlight.
 */
export function highlightElements(cy, selector) {
    cy.elements().style({ 'opacity': 0.2 }); // Dim all nodes and edges

    // If it's an edge selector
    if (selector.startsWith('edge')) {
        let colorValue = selector.match(/color="([^"]+)"/)[1]; // Extract the color from the selector
        let nodeSelector = `node[borderColor="${colorValue}"]`; // Construct the node selector

        // Style the associated nodes
        cy.elements(nodeSelector).style({
            'opacity': 1,
            'underlay-color': 'white',
            'underlay-padding': '2px',
            'underlay-opacity': 0.5,
            'underlay-shape': 'ellipse'
        });
    }

    // For the initial selector (whether it's node or edge)
    cy.elements(selector).style({
        'opacity': 1,
        'underlay-color': 'white',
        'underlay-padding': selector.startsWith('edge') ? '2px' : '5px',
        'underlay-opacity': 0.5,
        'underlay-shape': selector.startsWith('edge') ? '' : 'ellipse',

    });
}

/**
 * Restores all elements in a Cytoscape graph to their default visual state. 
 * The opacity of all elements is set back to 1, and any applied underlays are removed.
 *
 * @param {Object} cy - The Cytoscape instance containing the graph elements.
 */
export function restoreElements(cy) {
    cy.elements().style({
        'opacity': 1,
        'underlay-color': '',
        'underlay-padding': '',
        'underlay-opacity': '',
        'underlay-shape': ''
    });
}