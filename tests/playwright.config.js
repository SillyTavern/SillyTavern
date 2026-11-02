import { defineConfig } from '@playwright/test';

const baseURL = process.env.ST_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8000';
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;

export default defineConfig({
    testMatch: '*.e2e.js',
    use: {
        baseURL,
        video: 'only-on-failure',
        screenshot: 'only-on-failure',
        launchOptions: executablePath ? { executablePath } : undefined,
    },
    workers: 4,
    fullyParallel: true,
});
