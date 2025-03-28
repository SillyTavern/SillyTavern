import { EventEmitter } from 'node:events';
import { CsrfSyncedToken } from 'csrf-sync';
import { UserDirectoryList, User } from './src/users.js';
import { CommandLineArguments } from './src/command-line.js';
import { EVENT_NAMES } from './src/server-events.js';

/**
 * Event payload for SERVER_STARTED event.
 */
export interface ServerStartedEvent {
    /**
     * The URL the server is listening on.
     */
    url: URL;
}

/**
 * Map of all server events to their payload types.
 */
export interface ServerEventMap {
    [EVENT_NAMES.SERVER_STARTED]: [ServerStartedEvent];
}

declare global {
    declare namespace NodeJS {
        export interface Process {
            /**
             * A global instance of the server events emitter.
             */
            serverEvents: EventEmitter<ServerEventMap>;
        }
    }

    declare namespace CookieSessionInterfaces {
        export interface CookieSessionObject {
            /**
             * The CSRF token for the session.
             */
            csrfToken: CsrfSyncedToken;
            /**
             * Authenticated user handle.
             */
            handle: string;
            /**
             * Last time the session was extended.
             */
            touch: number;
        }
    }

    namespace Express {
        export interface Request {
            user: {
                profile: User;
                directories: UserDirectoryList;
            };
        }
    }

    /**
     * The root directory for user data.
     */
    var DATA_ROOT: string;

    /**
     * Parsed command line arguments.
     */
    var COMMAND_LINE_ARGS: CommandLineArguments;
}
