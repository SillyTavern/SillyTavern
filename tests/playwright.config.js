import { defineConfig } from '@playwright/test';

const browserChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL || 'chromium';

export default defineConfig({
    testMatch: '*.e2e.js',
    use: {
        baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8000',
        channel: browserChannel,
        video: 'only-on-failure',
        screenshot: 'only-on-failure',
    },
    workers: 4,
    fullyParallel: true,
});
