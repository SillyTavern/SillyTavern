import { UserDirectoryList, User } from "./src/users";
import { CsrfSyncedToken } from "csrf-sync";

declare global {
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
}
