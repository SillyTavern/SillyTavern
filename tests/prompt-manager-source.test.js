import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, '..', 'public', 'scripts', 'PromptManager.js');

describe('PromptManager source code hygiene', () => {
    test('should not contain stray debug console.log statements', () => {
        const source = readFileSync(filePath, 'utf8');
        // Regression guard for the stray `console.log('FOO')` debug statement
        // accidentally introduced in PR #5249 (commit 7418d272) and removed
        // by this PR. Other console.log calls gated by `power_user.console_log_prompts`
        // are legitimate and intentionally preserved.
        expect(source).not.toMatch(/console\.log\(['"]FOO['"]\)/);
    });
});
