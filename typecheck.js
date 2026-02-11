#!/usr/bin/env node

/**
 * Type-checking helper script.
 *
 * Usage:
 *   node typecheck.js <jsconfig> - check the whole project described by <jsconfig>
 *   node typecheck.js <jsconfig> [files...] - check only the listed files, inheriting compiler options from <jsconfig>
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { resolve, dirname, basename, join } from 'node:path';

const [,, configPath, ...files] = process.argv;

if (!configPath) {
    console.error('Usage: node typecheck.js <jsconfig> [files...]');
    process.exit(1);
}

const resolvedConfig = resolve(configPath);

/**
 * Run tsc with the given arguments. Returns the exit code.
 * @param {string[]} args
 * @returns {number}
 */
function runTsc(args) {
    try {
        execFileSync('npx', ['tsc', ...args], { stdio: 'inherit' });
        return 0;
    } catch (error) {
        return error.status ?? 1;
    }
}

let exitCode;

if (files.length === 0) {
    // No files specified – check the full project
    exitCode = runTsc(['-p', resolvedConfig, '--noEmit']);
} else {
    // Files specified – create a temporary tsconfig that extends the base config
    const configDir = dirname(resolvedConfig);
    const tmpConfigPath = join(configDir, '_tmp_typecheck.json');

    const tmpConfig = {
        extends: `./${basename(resolvedConfig)}`,
        files: files.map(f => resolve(f)),
        compilerOptions: {
            skipLibCheck: true,
        },
    };

    try {
        writeFileSync(tmpConfigPath, JSON.stringify(tmpConfig, null, 4));
        exitCode = runTsc(['-p', tmpConfigPath, '--noEmit']);
    } finally {
        try { unlinkSync(tmpConfigPath); } catch { /* ignore */ }
    }
}

process.exit(exitCode);
