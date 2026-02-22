import js from '@eslint/js';
import jest from 'eslint-plugin-jest';
import playwright from 'eslint-plugin-playwright';
import stylistic from '@stylistic/eslint-plugin';
import globals from 'globals';

export default [
    // Global ignores
    {
        ignores: [
            '*.min.js',
            'node_modules/**/*',
        ],
    },
    // Base recommended config
    js.configs.recommended,
    // Jest recommended config
    jest.configs['flat/recommended'],
    // Playwright recommended config
    playwright.configs['flat/recommended'],
    // Common settings
    {
        plugins: {
            '@stylistic': stylistic,
        },
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.node,
                ...jest.environments.globals.globals,
                SillyTavern: 'readonly',
            },
        },
        settings: {
            jest: {
                version: 29,
            },
        },
        rules: {
            'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
            'no-control-regex': 'off',
            'no-constant-condition': ['error', { checkLoops: false }],
            'require-yield': 'off',
            'no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
            'no-cond-assign': 'error',
            // These rules should eventually be enabled.
            'no-async-promise-executor': 'off',
            'no-constant-binary-expression': 'off',
            'no-unused-private-class-members': 'off',
            'no-unassigned-vars': 'off',
            'no-useless-assignment': 'off',
            'preserve-caught-error': 'off',
            // Stylistic rules
            '@stylistic/quotes': ['error', 'single'],
            '@stylistic/semi': ['error', 'always'],
            '@stylistic/indent': ['error', 4, { SwitchCase: 1, FunctionDeclaration: { parameters: 'first' } }],
            '@stylistic/comma-dangle': ['error', 'always-multiline'],
            '@stylistic/eol-last': ['error', 'always'],
            '@stylistic/no-trailing-spaces': 'error',
            '@stylistic/object-curly-spacing': ['error', 'always'],
            '@stylistic/space-infix-ops': 'error',
        },
    },
];
