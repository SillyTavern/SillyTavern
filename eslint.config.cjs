// @ts-check

// Import necessary modules for the new flat config format.
const js = require('@eslint/js');
const jsdoc = require('eslint-plugin-jsdoc');
const globals = require('globals');

// Flat config files are root by default, replacing the legacy `root: true`.
module.exports = [
    // Global ignore patterns, replaces the legacy `ignorePatterns` property.
    {
        ignores: [
            '**/node_modules/**',
            '**/dist/**',
            '**/.git/**',
            'public/lib/**',
            'backups/**',
            'data/**',
            'cache/**',
            'src/tokenizers/**',
            'docker/**',
            'plugins/**',
            '**/*.min.js',
            'public/scripts/extensions/quick-reply/lib/**',
            'public/scripts/extensions/tts/lib/**',
        ],
    },

    // Base recommended rules from ESLint.
    // This corresponds to the legacy `extends: ['eslint:recommended']`.
    js.configs.recommended,

    // A global configuration object that applies to all linted files.
    // This contains settings from the top level of your old configuration.
    {
        // Configures plugins, replacing the legacy `plugins: ['jsdoc']`.
        plugins: {
            jsdoc: jsdoc,
        },
        // Global language options, replaces `parserOptions` and parts of `env`.
        languageOptions: {
            ecmaVersion: 'latest',
        },
        // Global rules that apply to all linted files unless overridden.
        rules: {
            'jsdoc/no-undefined-types': ['warn', { disableReporting: true, markVariablesAsUsed: true }],
            'no-unused-vars': ['error', { args: 'none' }],
            'no-control-regex': 'off',
            'no-constant-condition': ['error', { checkLoops: false }],
            'require-yield': 'off',
            'quotes': ['error', 'single'],
            'semi': ['error', 'always'],
            'indent': ['error', 4, { SwitchCase: 1, FunctionDeclaration: { parameters: 'first' } }],
            'comma-dangle': ['error', 'always-multiline'],
            'eol-last': ['error', 'always'],
            'no-trailing-spaces': 'error',
            'object-curly-spacing': ['error', 'always'],
            'space-infix-ops': 'error',
            'no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
            'no-cond-assign': 'error',
            'no-unneeded-ternary': 'error',
            'no-irregular-whitespace': ['error', { skipStrings: true, skipTemplates: true }],
            'no-async-promise-executor': 'off',
            'no-inner-declarations': 'off',
        },
    },

    // Specific configurations for different file patterns, replacing the legacy `overrides` array.

    // Configuration for server-side files (Node.js environment).
    {
        files: ['src/**/*.js', './*.js', 'plugins/**/*.js'],
        languageOptions: {
            sourceType: 'module',
            globals: {
                ...globals.node,
                globalThis: 'readonly',
                Deno: 'readonly',
            },
        },
    },

    // Configuration for CommonJS module files (`.cjs`).
    {
        files: ['*.cjs'],
        languageOptions: {
            sourceType: 'commonjs',
            globals: {
                ...globals.node,
            },
        },
    },

    // Configuration for ES module files (`.mjs`).
    {
        files: ['src/**/*.mjs'],
        languageOptions: {
            sourceType: 'module',
            globals: {
                ...globals.node,
            },
        },
    },

    // Configuration for browser-side files.
    {
        files: ['public/**/*.js'],
        languageOptions: {
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.jquery,
                globalThis: 'readonly',
                ePub: 'readonly',
                pdfjsLib: 'readonly',
                toastr: 'readonly',
                SillyTavern: 'readonly',
            },
        },
    },
];
