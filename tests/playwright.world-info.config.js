/**
 * Playwright config for World Info E2E tests
 *
 * Uses an isolated test server on port 8001 with fresh test data.
 *
 * To run all World Info tests:
 *   npx playwright test --config=playwright.world-info.config.js
 *
 * To run specific test file:
 *   npx playwright test frontend/WorldInfoCRUD.e2e.js --config=playwright.world-info.config.js
 */
import { defineConfig } from '@playwright/test';

export default defineConfig({
    testMatch: [
        'frontend/WorldInfoCRUD.e2e.js',              // UI CRUD with behavior verification
        'frontend/WorldInfoFunctions.e2e.js',         // Direct function testing
        'frontend/WorldInfoMatching.e2e.js',          // Matching logic testing
        'frontend/WorldInfoBenchmark.e2e.js',         // Performance benchmarks
        'frontend/WorldInfoEntryRendering.e2e.js',    // Entry rendering verification
        'frontend/WorldInfoACComparison.e2e.js',      // AC vs Legacy comparison tests
        'frontend/WorldInfoCacheInvalidation.e2e.js', // Cache invalidation tests
        'frontend/WorldInfoCharacterFilters.e2e.js',  // Character filter tests
        'frontend/WorldInfoFilterEdgeCases.e2e.js',   // Filter edge case tests
        'frontend/WorldInfoRecursionComplex.e2e.js',  // Complex recursion tests
        'frontend/WorldInfoBudgetTests.e2e.js',       // Budget and scan depth tests
        'frontend/WorldInfoStressTests.e2e.js',       // Stress and performance tests
        'frontend/WorldInfoGroupsAndProbability.e2e.js', // Groups, probability, position tests
    ],
    globalSetup: './e2e-global-setup.js',
    globalTeardown: './e2e-global-teardown.js',
    use: {
        baseURL: 'http://127.0.0.1:8001',
        video: 'only-on-failure',
        screenshot: 'only-on-failure',
        trace: 'on-first-retry',
    },
    timeout: 60000,
    expect: {
        timeout: 10000,
    },
    workers: 1, // Serial execution for UI tests
    fullyParallel: false,
    retries: 1,
    reporter: [
        ['list'],
        ['html', { open: 'never' }],
    ],
});
