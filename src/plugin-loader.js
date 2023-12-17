const fs = require('fs');
const path = require('path');
const express = require('express');
const { getConfigValue } = require('./util');
const enableServerPlugins = getConfigValue('enableServerPlugins', false);

/**
 * Determine if a file is a CommonJS module.
 * @param {string} file Path to file
 * @returns {boolean} True if file is a CommonJS module
 */
const isCommonJS = (file) => path.extname(file) === '.js';

/**
 * Determine if a file is an ECMAScript module.
 * @param {string} file Path to file
 * @returns {boolean} True if file is an ECMAScript module
 */
const isESModule = (file) => path.extname(file) === '.mjs';

/**
 * Load and initialize server plugins from a directory if they are enabled.
 * @param {import('express').Express} app Express app
 * @param {string} pluginsPath Path to plugins directory
 * @returns {Promise<any>} Promise that resolves when all plugins are loaded
 */
async function loadPlugins(app, pluginsPath) {
    // Server plugins are disabled.
    if (!enableServerPlugins) {
        return;
    }

    // Plugins directory does not exist.
    if (!fs.existsSync(pluginsPath)) {
        return;
    }

    const files = fs.readdirSync(pluginsPath);

    // No plugins to load.
    if (files.length === 0) {
        return;
    }

    for (const file of files) {
        const pluginFilePath = path.join(pluginsPath, file);

        if (fs.statSync(pluginFilePath).isDirectory()) {
            await loadFromDirectory(app, pluginFilePath);
            continue;
        }

        // Not a JavaScript file.
        if (!isCommonJS(file) && !isESModule(file)) {
            continue;
        }

        await loadFromFile(app, pluginFilePath);
    }
}

async function loadFromDirectory(app, pluginDirectoryPath) {
    const files = fs.readdirSync(pluginDirectoryPath);

    // No plugins to load.
    if (files.length === 0) {
        return;
    }

    // Plugin is an npm package.
    const packageJsonFilePath = path.join(pluginDirectoryPath, 'package.json');
    if (fs.existsSync(packageJsonFilePath)) {
        if (await loadFromPackage(app, packageJsonFilePath)) {
            return;
        }
    }

    // Plugin is a CommonJS module.
    const cjsFilePath = path.join(pluginDirectoryPath, 'index.js');
    if (fs.existsSync(cjsFilePath)) {
        if (await loadFromFile(app, cjsFilePath)) {
            return;
        }
    }

    // Plugin is an ECMAScript module.
    const esmFilePath = path.join(pluginDirectoryPath, 'index.mjs');
    if (fs.existsSync(esmFilePath)) {
        if (await loadFromFile(app, esmFilePath)) {
            return;
        }
    }
}

/**
 * Loads and initializes a plugin from an npm package.
 * @param {import('express').Express} app Express app
 * @param {string} packageJsonPath Path to package.json file
 * @returns {Promise<boolean>} Promise that resolves to true if plugin was loaded successfully
 */
async function loadFromPackage(app, packageJsonPath) {
    try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        if (packageJson.main) {
            const pluginFilePath = path.join(path.dirname(packageJsonPath), packageJson.main);
            return await loadFromFile(app, pluginFilePath);
        }
    } catch (error) {
        console.error(`Failed to load plugin from ${packageJsonPath}: ${error}`);
    }
    return false;
}

/**
 * Loads and initializes a plugin from a file.
 * @param {import('express').Express} app Express app
 * @param {string} pluginFilePath Path to plugin directory
 * @returns {Promise<boolean>} Promise that resolves to true if plugin was loaded successfully
 */
async function loadFromFile(app, pluginFilePath) {
    try {
        const plugin = await getPluginModule(pluginFilePath);
        console.log(`Initializing plugin from ${pluginFilePath}`);
        return await initPlugin(app, plugin);
    } catch (error) {
        console.error(`Failed to load plugin from ${pluginFilePath}: ${error}`);
        return false;
    }
}

/**
 * Check whether a plugin ID is valid (only lowercase alphanumeric, hyphens, and underscores).
 * @param {string} id The plugin ID to check
 * @returns {boolean} True if the plugin ID is valid.
 */
function isValidPluginID(id) {
    return /^[a-z0-9_-]$/.test(id);
}

/**
 * Initializes a plugin module.
 * @param {import('express').Express} app Express app
 * @param {any} plugin Plugin module
 * @returns {Promise<boolean>} Promise that resolves to true if plugin was initialized successfully
 */
async function initPlugin(app, plugin) {
    if (typeof plugin.info !== 'object') {
        console.error('Failed to load plugin module; plugin info not found');
        return false;
    }

    // We don't currently use "name" or "description" but it would be nice to have a UI for listing server plugins, so
    // require them now just to be safe
    for (const field of ['id', 'name', 'description']) {
        if (typeof plugin.info[field] !== 'string') {
            console.error(`Failed to load plugin module; plugin info missing field '${field}'`);
            return false;
        }
    }

    if (typeof plugin.init !== 'function') {
        console.error('Failed to load plugin module; no init function');
        return false;
    }

    const { id } = plugin.info;

    if (!isValidPluginID(id)) {
        console.error(`Failed to load plugin module; invalid plugin ID '${id}'`);
    }

    // Allow the plugin to register API routes under /plugins/[plugin ID] via a router
    const router = express.Router();

    await plugin.init(router);

    // Add API routes to the app if the plugin registered any
    if (router.stack.length > 0) {
        app.use(`/plugins/${id}`, router);
    }

    return true;
}

/**
 * Loads a module from a file depending on the module type.
 * @param {string} pluginFilePath Path to plugin file
 * @returns {Promise<any>} Promise that resolves to plugin module
 */
async function getPluginModule(pluginFilePath) {
    if (isCommonJS(pluginFilePath)) {
        return require(pluginFilePath);
    }
    if (isESModule(pluginFilePath)) {
        return await import(pluginFilePath);
    }
    throw new Error(`Unsupported module type in ${pluginFilePath}`);
}

module.exports = {
    loadPlugins,
};
