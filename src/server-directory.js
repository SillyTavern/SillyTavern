import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const serverDirectory = path.dirname(import.meta.dirname ?? path.dirname(fileURLToPath(import.meta.url)));
