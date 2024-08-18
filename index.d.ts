import { UserDirectoryList, User } from "./src/users";

declare global {
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

declare module 'express-session' {
    export interface SessionData {
      handle: string;
      touch: number;
      // other properties...
    }
  }
