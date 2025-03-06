import EventEmitter from 'node:events';
import process from 'node:process';

/**
 * @typedef {import('../index').ServerEventMap} ServerEventMap
 * @type {EventEmitter<ServerEventMap>} The default event source.
 */
export const serverEvents = new EventEmitter();
process.serverEvents = serverEvents;
export default serverEvents;

/**
 * @enum {string}
 * @readonly
 */
export const EVENT_NAMES = Object.freeze({
    /**
     * Emitted when the server has started.
     */
    SERVER_STARTED: 'server-started',
});
