import fs from 'fs';
import path from 'path';
import { serverDirectory } from './server-directory.js';

// Default to 0 seconds (disabled) if not set
const intervalSeconds = parseInt(process.env.SILLYTAVERN_HEARTBEATINTERVAL || '0');
const intervalMs = intervalSeconds * 1000;

// Heartbeat disabled
if (Number.isNaN(intervalSeconds) || intervalSeconds <= 0) {
    process.exit(0);
}

// Allow a grace period (2 missed beats)
const threshold = intervalMs * 2;

const dataRoot = process.env.SILLYTAVERN_DATAROOT || path.join(serverDirectory, 'data');
const heartbeatFile = path.join(dataRoot, 'heartbeat.json');

try {
    if (!fs.existsSync(heartbeatFile)) {
        console.error(`Heartbeat file not found at: ${heartbeatFile}`);
        process.exit(1);
    }

    const stats = fs.statSync(heartbeatFile);
    const lastModified = stats.mtimeMs;
    const now = Date.now();
    const diff = now - lastModified;

    if (diff > threshold) {
        console.error(`Server is unresponsive. Last heartbeat was ${Math.round(diff / 1000)} seconds ago.`);
        process.exit(1);
    }

    process.exit(0);
} catch (err) {
    console.error('Healthcheck error:', err.message);
    process.exit(1);
}
