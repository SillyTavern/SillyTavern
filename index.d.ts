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
