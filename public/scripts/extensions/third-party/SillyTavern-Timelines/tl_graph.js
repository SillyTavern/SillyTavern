import { highlightElements, restoreElements } from './tl_style.js';
let currentOrientation = 'TB'; // starting orientation


/**
 * Toggles the orientation of the graph between Left-to-Right (LR) and Top-to-Bottom (TB).
 *
 * @param {Object} cy - The Cytoscape instance representing the graph.
 * @param {Object} layout - The Cytoscape layout configuration object.
 */
export function toggleGraphOrientation(cy, layout) {
    currentOrientation = (currentOrientation === 'LR') ? 'TB' : 'LR';
    setOrientation(cy, currentOrientation, layout);
}

/**
 * Sets the graph orientation based on the current viewport size. 
 * Chooses Left-to-Right (LR) orientation if the viewport width is greater than its height, 
 * otherwise selects Top-to-Bottom (TB).
 *
 * @param {Object} cy - The Cytoscape instance representing the graph.
 * @param {Object} layout - The Cytoscape layout configuration object.
 */
export function setGraphOrientationBasedOnViewport(cy, layout) {
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;

    const orientation = (viewportWidth > viewportHeight) ? 'LR' : 'TB';
    setOrientation(cy, orientation, layout);
}

/**
 * Sets the orientation of the graph to the specified direction (either 'LR' for Left-to-Right 
 * or 'TB' for Top-to-Bottom).
 *
 * @param {Object} cy - The Cytoscape instance representing the graph.
 * @param {string} orientation - The desired orientation for the graph ('LR' or 'TB').
 * @param {Object} layout - The Cytoscape layout configuration object.
 * @private
 */
function setOrientation(cy, orientation, layout) {
    // Update layout
    layout.rankDir = orientation;
    cy.layout(layout).run();
    // Update taxi-direction in style
    const taxiDirection = orientation === 'TB' ? 'downward' : 'rightward';
    cy.style().selector('edge').style({
        'taxi-direction': taxiDirection
    }).update();
    currentOrientation = orientation;
}

/**
 * Highlights nodes in the graph based on a provided query. 
 * Nodes where the 'msg' property contains the query will be highlighted, while others will be dimmed.
 * If no nodes match the query or if the query is empty, all nodes will be restored to their original state.
 *
 * @param {Object} cy - The Cytoscape instance representing the graph.
 * @param {string} query - The query used to match and highlight nodes.
 */
export function highlightNodesByQuery(cy, query) {
    // If there's no query, restore elements to their original state.
    if (!query || query === "") {
        restoreElements(cy);
        return;
    }

    // Create a selector for nodes where the 'msg' property contains the query
    let selector = `node[msg @*= "${query}"]`;

    // If no nodes match the selector, restore elements. Otherwise, highlight.
    if (cy.elements(selector).length === 0) {
        restoreElements(cy);
    } else {
        restoreElements(cy);
        highlightElements(cy, selector);
    }
}

/**
 * Retrieves the depth of a given node in a graph. The depth is determined based on the number of 
 * ancestral nodes a node has, with the assumption that each node has at most one parent.
 *
 * @param {Object} node - The Cytoscape node object whose depth is to be determined.
 * @returns {number} The depth of the given node.
 */
export function getNodeDepth(node) {
    let depth = 0;
    while (node.incomers().nodes().length > 0) {
        node = node.incomers().nodes()[0];  // Assuming the node only has a single parent
        depth++;
    }
    return depth;
}