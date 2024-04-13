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
}

declare module 'express-session' {
    export interface SessionData {
      handle: string;
      touch: number;
      // other properties...
    }
  }
