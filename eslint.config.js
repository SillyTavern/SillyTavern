import js from '@eslint/js';
import jsdoc from 'eslint-plugin-jsdoc';
import stylistic from '@stylistic/eslint-plugin';
import globals from 'globals';

export default [
    // Global ignores
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
            'tests/**',
        ],
    },
    // Base recommended config for all files
    js.configs.recommended,
    // Common settings for all files
    {
        plugins: {
            jsdoc,
            '@stylistic': stylistic,
        },
        languageOptions: {
            ecmaVersion: 'latest',
        },
        rules: {
            'jsdoc/no-undefined-types': ['warn', { disableReporting: true, markVariablesAsUsed: true }],
            'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
            'no-control-regex': 'off',
            'no-constant-condition': ['error', { checkLoops: false }],
            'require-yield': 'off',
            'no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
            'no-cond-assign': 'error',
            'no-unneeded-ternary': 'error',
            'no-irregular-whitespace': ['error', { skipStrings: true, skipTemplates: true }],
            'dot-notation': ['error', { 'allowPattern': '[A-Z]\\w*$' }],
            // These rules should eventually be enabled.
            'no-async-promise-executor': 'off',
            'no-constant-binary-expression': 'off',
            'no-unused-private-class-members': 'off',
            // Stylistic rules (moved from core ESLint to @stylistic)
            '@stylistic/quotes': ['error', 'single'],
            '@stylistic/semi': ['error', 'always'],
            '@stylistic/indent': ['error', 4, { SwitchCase: 1, FunctionDeclaration: { parameters: 'first' } }],
            '@stylistic/comma-dangle': ['error', 'always-multiline'],
            '@stylistic/eol-last': ['error', 'always'],
            '@stylistic/no-trailing-spaces': 'error',
            '@stylistic/object-curly-spacing': ['error', 'always'],
            '@stylistic/space-infix-ops': 'error',
            '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: true }],
            '@stylistic/array-bracket-spacing': ['error', 'never'],
            '@stylistic/computed-property-spacing': ['error', 'never'],
            '@stylistic/block-spacing': ['error', 'always'],
            '@stylistic/keyword-spacing': ['error', { before: true, after: true }],
            '@stylistic/space-before-blocks': ['error', 'always'],
            '@stylistic/space-before-function-paren': ['error', { anonymous: 'always', named: 'never', asyncArrow: 'always' }],
            '@stylistic/space-in-parens': ['error', 'never'],
            '@stylistic/comma-spacing': ['error', { before: false, after: true }],
            '@stylistic/key-spacing': ['error', { beforeColon: false, afterColon: true }],
            '@stylistic/function-call-spacing': ['error', 'never'],
            '@stylistic/no-multiple-empty-lines': ['error', { max: 2, maxEOF: 1, maxBOF: 0 }],
            '@stylistic/padded-blocks': ['error', 'never'],
            '@stylistic/no-whitespace-before-property': 'error',
            '@stylistic/space-unary-ops': ['error', { words: true, nonwords: false }],
            '@stylistic/arrow-spacing': ['error', { before: true, after: true }],
            '@stylistic/template-curly-spacing': ['error', 'never'],
            '@stylistic/rest-spread-spacing': ['error', 'never'],
            '@stylistic/generator-star-spacing': ['error', { before: false, after: true }],
            '@stylistic/yield-star-spacing': ['error', { before: false, after: true }],
            '@stylistic/template-tag-spacing': ['error', 'never'],
            '@stylistic/switch-colon-spacing': ['error', { after: true, before: false }],
        },
    },
    // Server-side files
    {
        files: ['src/**/*.js', '*.js', 'plugins/**/*.js'],
        languageOptions: {
            sourceType: 'module',
            globals: {
                ...globals.node,
                globalThis: 'readonly',
                Deno: 'readonly',
            },
        },
    },
    // CommonJS files
    {
        files: ['**/*.cjs'],
        languageOptions: {
            sourceType: 'commonjs',
            globals: {
                ...globals.node,
            },
        },
    },
    // ES module files (.mjs)
    {
        files: ['src/**/*.mjs'],
        languageOptions: {
            sourceType: 'module',
            globals: {
                ...globals.node,
            },
        },
    },
    // Browser-side files
    {
        files: ['public/**/*.js'],
        languageOptions: {
            sourceType: 'module',
            globals: {
                ...globals.browser,
                globalThis: 'readonly',
                ePub: 'readonly',
                pdfjsLib: 'readonly',
                toastr: 'readonly',
                SillyTavern: 'readonly',
                jQuery: 'readonly',
                $: 'readonly',
            },
        },
    },
];
