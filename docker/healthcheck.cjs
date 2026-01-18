const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Determine paths relative to where the app is running
const appDir = process.cwd();
const configPath = path.join(appDir, 'config.yaml');

let config = {
    port: 8000,
    ssl: { enabled: false }
};

// 1. Load from Config File using 'yaml' lib if available, or regex fallback
try {
    if (fs.existsSync(configPath)) {
        const fileContent = fs.readFileSync(configPath, 'utf8');
        try {
            const yaml = require('yaml');
            const parsed = yaml.parse(fileContent);
            if (parsed) {
                if (parsed.port) config.port = parsed.port;
                if (parsed.ssl) config.ssl = { ...config.ssl, ...parsed.ssl };
            }
        } catch (e) {
            // Fallback to Regex if yaml lib fails or isn't found
            const portMatch = fileContent.match(/^port:\s*(\d+)/m);
            if (portMatch) config.port = parseInt(portMatch[1]);
            const sslMatch = fileContent.match(/ssl:\s*[\s\S]*?enabled:\s*(true|false)/);
            if (sslMatch) config.ssl.enabled = (sslMatch[1] === 'true');
        }
    }
} catch (err) {
    // Ignore config errors, stick to defaults/env
}

// 2. Override with Environment Variables (Docker specific)
if (process.env.SILLYTAVERN_PORT) config.port = parseInt(process.env.SILLYTAVERN_PORT);
if (process.env.SILLYTAVERN_SSL_ENABLED) config.ssl.enabled = (process.env.SILLYTAVERN_SSL_ENABLED === 'true');

const protocol = config.ssl.enabled ? https : http;

const requestOptions = {
    host: '127.0.0.1',
    port: config.port,
    path: '/api/health',
    timeout: 2000,
    rejectUnauthorized: false,
    headers: { 'User-Agent': 'Docker-Healthcheck' }
};

const performCheck = (options) => {
    const req = protocol.get(options, (res) => {
        if (res.statusCode === 200) {
            process.exit(0);
        } else {
            console.error(`Health Check Failed: HTTP ${res.statusCode}`);
            process.exit(1);
        }
    });

    req.on('error', (err) => {
        console.error(`Health Check Failed: ${err.message}`);
        // IPv6 Fallback
        if (options.host === '127.0.0.1') {
            console.log('Retrying with IPv6 [::1]...');
            performCheck({ ...options, host: '::1' });
        } else {
            process.exit(1);
        }
    });

    req.end();
};

performCheck(requestOptions);
