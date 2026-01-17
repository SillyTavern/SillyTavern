const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Check environment variable first, then try to parse config.yaml, default to 8000
let port = process.env.SILLYTAVERN_PORT || 8000;

if (!process.env.SILLYTAVERN_PORT) {
    try {
        const configPath = path.join(process.cwd(), 'config', 'config.yaml');
        if (fs.existsSync(configPath)) {
            const content = fs.readFileSync(configPath, 'utf8');
            // Look for "port: 1234" pattern
            const portMatch = content.match(/^port:\s*(\d+)/m);
            if (portMatch) {
                port = parseInt(portMatch[1], 10);
            }
        }
    } catch (e) {
        // Silently fail and use default/env port
    }
}

// Healthcheck Logic
function tryConnect(host, isSsl) {
    const protocol = isSsl ? https : http;
    const options = {
        hostname: host,
        port: port,
        path: '/',
        method: 'GET',
        rejectUnauthorized: false, // Allow self-signed certs
        timeout: 2000,
        family: host === '::1' ? 6 : 4, // Explicitly state IP family
        headers: {
            'User-Agent': 'Server Healthcheck' // Custom User-Agent for logs
        }
    };

    const req = protocol.request(options, (res) => {
        // Any response means the server is alive
        process.exit(0);
    });

    req.on('error', (err) => {
        // Case 1: IPv4 failed (Connection Refused) -> Try IPv6
        if (host === '127.0.0.1' && err.code === 'ECONNREFUSED') {
            tryConnect('::1', isSsl);
            return;
        }

        // Case 2: Protocol mismatch (HTTP -> HTTPS)
        // ECONNRESET/HPE_INVALID_CONSTANT usually means we sent HTTP to an HTTPS port
        if (!isSsl && (err.code === 'ECONNRESET' || err.code === 'HPE_INVALID_CONSTANT')) {
            tryConnect(host, true);
            return;
        }

        // Case 3: Genuine Failure
        // If we are already on IPv6 or SSL and still failing, print error and exit
        console.error(`Healthcheck failed: ${err.message} (${host}:${port})`);
        process.exit(1);
    });

    req.end();
}

// Start by trying IPv4 + HTTP.
// It will automatically fallback to IPv6 or HTTPS if needed.
tryConnect('127.0.0.1', false);
