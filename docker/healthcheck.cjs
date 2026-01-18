const fs = require('fs');
const path = require('path');

// Default to 30 seconds if not set
const intervalSeconds = parseInt(process.env.SILLYTAVERN_HEARTBEATINTERVAL || '30');
const intervalMs = intervalSeconds * 1000;

// Allow a grace period (2 missed beats)
const threshold = intervalMs * 2;

const dataRoot = process.env.SILLYTAVERN_DATAROOT || path.join(__dirname, 'data');
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
