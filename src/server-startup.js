import https from 'node:https';
import http from 'node:http';
import fs from 'node:fs';
import { color, urlHostnameToIPv6, getHasIP } from './util.js';

// Express routers
import { router as userDataRouter } from './users.js';
import { router as usersPrivateRouter } from './endpoints/users-private.js';
import { router as usersAdminRouter } from './endpoints/users-admin.js';
import { router as movingUIRouter } from './endpoints/moving-ui.js';
import { router as imagesRouter } from './endpoints/images.js';
import { router as quickRepliesRouter } from './endpoints/quick-replies.js';
import { router as avatarsRouter } from './endpoints/avatars.js';
import { router as themesRouter } from './endpoints/themes.js';
import { router as openAiRouter } from './endpoints/openai.js';
import { router as googleRouter } from './endpoints/google.js';
import { router as anthropicRouter } from './endpoints/anthropic.js';
import { router as tokenizersRouter } from './endpoints/tokenizers.js';
import { router as presetsRouter } from './endpoints/presets.js';
import { router as secretsRouter } from './endpoints/secrets.js';
import { router as thumbnailRouter } from './endpoints/thumbnails.js';
import { router as novelAiRouter } from './endpoints/novelai.js';
import { router as extensionsRouter } from './endpoints/extensions.js';
import { router as assetsRouter } from './endpoints/assets.js';
import { router as filesRouter } from './endpoints/files.js';
import { router as charactersRouter } from './endpoints/characters.js';
import { router as chatsRouter } from './endpoints/chats.js';
import { router as groupsRouter } from './endpoints/groups.js';
import { router as worldInfoRouter } from './endpoints/worldinfo.js';
import { router as statsRouter } from './endpoints/stats.js';
import { router as contentManagerRouter } from './endpoints/content-manager.js';
import { router as settingsRouter } from './endpoints/settings.js';
import { router as backgroundsRouter } from './endpoints/backgrounds.js';
import { router as spritesRouter } from './endpoints/sprites.js';
import { router as stableDiffusionRouter } from './endpoints/stable-diffusion.js';
import { router as hordeRouter } from './endpoints/horde.js';
import { router as vectorsRouter } from './endpoints/vectors.js';
import { router as translateRouter } from './endpoints/translate.js';
import { router as classifyRouter } from './endpoints/classify.js';
import { router as captionRouter } from './endpoints/caption.js';
import { router as searchRouter } from './endpoints/search.js';
import { router as openRouterRouter } from './endpoints/openrouter.js';
import { router as chatCompletionsRouter } from './endpoints/backends/chat-completions.js';
import { router as koboldRouter } from './endpoints/backends/kobold.js';
import { router as textCompletionsRouter } from './endpoints/backends/text-completions.js';
import { router as scaleAltRouter } from './endpoints/backends/scale-alt.js';
import { router as speechRouter } from './endpoints/speech.js';
import { router as azureRouter } from './endpoints/azure.js';
import { router as dataMaidRouter } from './endpoints/data-maid.js';

/**
 * @typedef {object} ServerStartupResult
 * @property {boolean} v6Failed If the server failed to start on IPv6
 * @property {boolean} v4Failed If the server failed to start on IPv4
 * @property {boolean} useIPv6 If use IPv6
 * @property {boolean} useIPv4 If use IPv4
 */

/**
 * Redirect deprecated API endpoints to their replacements.
 * @param {import('express').Express} app The Express app to use
 */
export function redirectDeprecatedEndpoints(app) {
    /**
     * Redirect a deprecated API endpoint URL to its replacement. Because fetch, form submissions, and $.ajax follow
     * redirects, this is transparent to client-side code.
     * @param {string} src The URL to redirect from.
     * @param {string} destination The URL to redirect to.
     */
    function redirect(src, destination) {
        app.use(src, (req, res) => {
            console.warn(`API endpoint ${src} is deprecated; use ${destination} instead`);
            // HTTP 301 causes the request to become a GET. 308 preserves the request method.
            res.redirect(308, destination);
        });
    }

    redirect('/createcharacter', '/api/characters/create');
    redirect('/renamecharacter', '/api/characters/rename');
    redirect('/editcharacter', '/api/characters/edit');
    redirect('/editcharacterattribute', '/api/characters/edit-attribute');
    redirect('/v2/editcharacterattribute', '/api/characters/merge-attributes');
    redirect('/deletecharacter', '/api/characters/delete');
    redirect('/getcharacters', '/api/characters/all');
    redirect('/getonecharacter', '/api/characters/get');
    redirect('/getallchatsofcharacter', '/api/characters/chats');
    redirect('/importcharacter', '/api/characters/import');
    redirect('/dupecharacter', '/api/characters/duplicate');
    redirect('/exportcharacter', '/api/characters/export');
    redirect('/savechat', '/api/chats/save');
    redirect('/getchat', '/api/chats/get');
    redirect('/renamechat', '/api/chats/rename');
    redirect('/delchat', '/api/chats/delete');
    redirect('/exportchat', '/api/chats/export');
    redirect('/importgroupchat', '/api/chats/group/import');
    redirect('/importchat', '/api/chats/import');
    redirect('/getgroupchat', '/api/chats/group/get');
    redirect('/deletegroupchat', '/api/chats/group/delete');
    redirect('/savegroupchat', '/api/chats/group/save');
    redirect('/getgroups', '/api/groups/all');
    redirect('/creategroup', '/api/groups/create');
    redirect('/editgroup', '/api/groups/edit');
    redirect('/deletegroup', '/api/groups/delete');
    redirect('/getworldinfo', '/api/worldinfo/get');
    redirect('/deleteworldinfo', '/api/worldinfo/delete');
    redirect('/importworldinfo', '/api/worldinfo/import');
    redirect('/editworldinfo', '/api/worldinfo/edit');
    redirect('/getstats', '/api/stats/get');
    redirect('/recreatestats', '/api/stats/recreate');
    redirect('/updatestats', '/api/stats/update');
    redirect('/getbackgrounds', '/api/backgrounds/all');
    redirect('/delbackground', '/api/backgrounds/delete');
    redirect('/renamebackground', '/api/backgrounds/rename');
    redirect('/downloadbackground', '/api/backgrounds/upload'); // yes, the downloadbackground endpoint actually uploads one
    redirect('/savetheme', '/api/themes/save');
    redirect('/getuseravatars', '/api/avatars/get');
    redirect('/deleteuseravatar', '/api/avatars/delete');
    redirect('/uploaduseravatar', '/api/avatars/upload');
    redirect('/deletequickreply', '/api/quick-replies/delete');
    redirect('/savequickreply', '/api/quick-replies/save');
    redirect('/uploadimage', '/api/images/upload');
    redirect('/listimgfiles/:folder', '/api/images/list/:folder');
    redirect('/api/content/import', '/api/content/importURL');
    redirect('/savemovingui', '/api/moving-ui/save');
    redirect('/api/serpapi/search', '/api/search/serpapi');
    redirect('/api/serpapi/visit', '/api/search/visit');
    redirect('/api/serpapi/transcript', '/api/search/transcript');
}

/**
 * Setup the routers for the endpoints.
 * @param {import('express').Express} app The Express app to use
 */
export function setupPrivateEndpoints(app) {
    app.use('/', userDataRouter);
    app.use('/api/users', usersPrivateRouter);
    app.use('/api/users', usersAdminRouter);
    app.use('/api/moving-ui', movingUIRouter);
    app.use('/api/images', imagesRouter);
    app.use('/api/quick-replies', quickRepliesRouter);
    app.use('/api/avatars', avatarsRouter);
    app.use('/api/themes', themesRouter);
    app.use('/api/openai', openAiRouter);
    app.use('/api/google', googleRouter);
    app.use('/api/anthropic', anthropicRouter);
    app.use('/api/tokenizers', tokenizersRouter);
    app.use('/api/presets', presetsRouter);
    app.use('/api/secrets', secretsRouter);
    app.use('/thumbnail', thumbnailRouter);
    app.use('/api/novelai', novelAiRouter);
    app.use('/api/extensions', extensionsRouter);
    app.use('/api/assets', assetsRouter);
    app.use('/api/files', filesRouter);
    app.use('/api/characters', charactersRouter);
    app.use('/api/chats', chatsRouter);
    app.use('/api/groups', groupsRouter);
    app.use('/api/worldinfo', worldInfoRouter);
    app.use('/api/stats', statsRouter);
    app.use('/api/backgrounds', backgroundsRouter);
    app.use('/api/sprites', spritesRouter);
    app.use('/api/content', contentManagerRouter);
    app.use('/api/settings', settingsRouter);
    app.use('/api/sd', stableDiffusionRouter);
    app.use('/api/horde', hordeRouter);
    app.use('/api/vector', vectorsRouter);
    app.use('/api/translate', translateRouter);
    app.use('/api/extra/classify', classifyRouter);
    app.use('/api/extra/caption', captionRouter);
    app.use('/api/search', searchRouter);
    app.use('/api/backends/text-completions', textCompletionsRouter);
    app.use('/api/openrouter', openRouterRouter);
    app.use('/api/backends/kobold', koboldRouter);
    app.use('/api/backends/chat-completions', chatCompletionsRouter);
    app.use('/api/backends/scale-alt', scaleAltRouter);
    app.use('/api/speech', speechRouter);
    app.use('/api/azure', azureRouter);
    app.use('/api/data-maid', dataMaidRouter);
}

/**
 * Utilities for starting the express server.
 */
export class ServerStartup {
    /**
     * Creates a new ServerStartup instance.
     * @param {import('express').Express} app The Express app to use
     * @param {import('./command-line.js').CommandLineArguments} cliArgs The command-line arguments
     */
    constructor(app, cliArgs) {
        this.app = app;
        this.cliArgs = cliArgs;
    }

    /**
     * Prints a fatal error message and exits the process.
     * @param {string} message
     */
    #fatal(message) {
        console.error(color.red(message));
        process.exit(1);
    }

    /**
     * Checks if SSL options are valid. If not, it will print an error message and exit the process.
     * @returns {void}
     */
    #verifySslOptions() {
        if (!this.cliArgs.ssl) return;

        if (!this.cliArgs.certPath) {
            this.#fatal('Error: SSL certificate path is required when using HTTPS. Check your config');
        }

        if (!this.cliArgs.keyPath) {
            this.#fatal('Error: SSL key path is required when using HTTPS. Check your config');
        }

        if (!fs.existsSync(this.cliArgs.certPath)) {
            this.#fatal('Error: SSL certificate path does not exist');
        }

        if (!fs.existsSync(this.cliArgs.keyPath)) {
            this.#fatal('Error: SSL key path does not exist');
        }
    }

    /**
     * Creates an HTTPS server.
     * @param {URL} url The URL to listen on
     * @param {number} ipVersion the ip version to use
     * @returns {Promise<void>} A promise that resolves when the server is listening
     */
    #createHttpsServer(url, ipVersion) {
        this.#verifySslOptions();
        return new Promise((resolve, reject) => {
            const sslOptions = {
                cert: fs.readFileSync(this.cliArgs.certPath),
                key: fs.readFileSync(this.cliArgs.keyPath),
            };
            const server = https.createServer(sslOptions, this.app);
            server.on('error', reject);
            server.on('listening', resolve);

            let host = url.hostname;
            if (ipVersion === 6) host = urlHostnameToIPv6(url.hostname);
            server.listen({
                host: host,
                port: Number(url.port || 443),
                // see https://nodejs.org/api/net.html#serverlisten for why ipv6Only is used
                ipv6Only: true,
            });
        });
    }

    /**
     * Creates an HTTP server.
     * @param {URL} url The URL to listen on
     * @param {number} ipVersion the ip version to use
     * @returns {Promise<void>} A promise that resolves when the server is listening
     */
    #createHttpServer(url, ipVersion) {
        return new Promise((resolve, reject) => {
            const server = http.createServer(this.app);
            server.on('error', reject);
            server.on('listening', resolve);

            let host = url.hostname;
            if (ipVersion === 6) host = urlHostnameToIPv6(url.hostname);
            server.listen({
                host: host,
                port: Number(url.port || 80),
                // see https://nodejs.org/api/net.html#serverlisten for why ipv6Only is used
                ipv6Only: true,
            });
        });
    }

    /**
     * Starts the server using http or https depending on config
     * @param {boolean} useIPv6 If use IPv6
     * @param {boolean} useIPv4 If use IPv4
     * @returns {Promise<[boolean, boolean]>} A promise that resolves with an array of booleans indicating if the server failed to start on IPv6 and IPv4, respectively
     */
    async #startHTTPorHTTPS(useIPv6, useIPv4) {
        let v6Failed = false;
        let v4Failed = false;

        const createFunc = this.cliArgs.ssl ? this.#createHttpsServer.bind(this) : this.#createHttpServer.bind(this);

        if (useIPv6) {
            try {
                await createFunc(this.cliArgs.getIPv6ListenUrl(), 6);
            } catch (error) {
                console.error('Warning: failed to start server on IPv6');
                console.error(error);

                v6Failed = true;
            }
        }

        if (useIPv4) {
            try {
                await createFunc(this.cliArgs.getIPv4ListenUrl(), 4);
            } catch (error) {
                console.error('Warning: failed to start server on IPv4');
                console.error(error);

                v4Failed = true;
            }
        }

        return [v6Failed, v4Failed];
    }

    /**
     * Handles the case where the server failed to start on one or both protocols.
     * @param {ServerStartupResult} result The results of the server startup
     * @returns {void}
     */
    #handleServerListenFail({ v6Failed, v4Failed, useIPv6, useIPv4 }) {
        if (v6Failed && !useIPv4) {
            this.#fatal('Error: Failed to start server on IPv6 and IPv4 disabled');
        }

        if (v4Failed && !useIPv6) {
            this.#fatal('Error: Failed to start server on IPv4 and IPv6 disabled');
        }

        if (v6Failed && v4Failed) {
            this.#fatal('Error: Failed to start server on both IPv6 and IPv4');
        }
    }

    /**
     * Performs the server startup.
     * @returns {Promise<ServerStartupResult>} A promise that resolves with an object containing the results of the server startup
     */
    async start() {
        let useIPv6 = (this.cliArgs.enableIPv6 === true);
        let useIPv4 = (this.cliArgs.enableIPv4 === true);

        if (this.cliArgs.enableIPv6 === 'auto' || this.cliArgs.enableIPv4 === 'auto') {
            const ipQuery = await getHasIP();
            let hasIPv6 = false, hasIPv4 = false;

            hasIPv6 = this.cliArgs.listen ? ipQuery.hasIPv6Any : ipQuery.hasIPv6Local;
            if (this.cliArgs.enableIPv6 === 'auto') {
                useIPv6 = hasIPv6;
            }
            if (hasIPv6) {
                if (useIPv6) {
                    console.log(color.green('IPv6 support detected'));
                } else {
                    console.log('IPv6 support detected (but disabled)');
                }
            }

            hasIPv4 = this.cliArgs.listen ? ipQuery.hasIPv4Any : ipQuery.hasIPv4Local;
            if (this.cliArgs.enableIPv4 === 'auto') {
                useIPv4 = hasIPv4;
            }
            if (hasIPv4) {
                if (useIPv4) {
                    console.log(color.green('IPv4 support detected'));
                } else {
                    console.log('IPv4 support detected (but disabled)');
                }
            }

            if (this.cliArgs.enableIPv6 === 'auto' && this.cliArgs.enableIPv4 === 'auto') {
                if (!hasIPv6 && !hasIPv4) {
                    console.error('Both IPv6 and IPv4 are not detected');
                    process.exit(1);
                }
            }
        }

        if (!useIPv6 && !useIPv4) {
            console.error('Both IPv6 and IPv4 are disabled or not detected');
            process.exit(1);
        }

        const [v6Failed, v4Failed] = await this.#startHTTPorHTTPS(useIPv6, useIPv4);
        const result = { v6Failed, v4Failed, useIPv6, useIPv4 };
        this.#handleServerListenFail(result);
        return result;
    }
}
