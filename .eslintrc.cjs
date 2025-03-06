module.exports = {
    root: true,
    extends: [
        'eslint:recommended',
    ],
    env: {
        es6: true,
    },
    parserOptions: {
        ecmaVersion: 'latest',
    },
    overrides: [
        {
            // Server-side files (plus this configuration file)
            files: ['src/**/*.js', './*.js', 'plugins/**/*.js'],
            env: {
                node: true,
            },
            parserOptions: {
                sourceType: 'module',
            },
            globals: {
                globalThis: 'readonly',
                Deno: 'readonly',
            },
        },
        {
            files: ['*.cjs'],
            parserOptions: {
                sourceType: 'commonjs',
            },
            env: {
                node: true,
            },
        },
        {
            files: ['src/**/*.mjs'],
            parserOptions: {
                sourceType: 'module',
            },
            env: {
                node: true,
            },
        },
        {
            // Browser-side files
            files: ['public/**/*.js'],
            env: {
                browser: true,
                jquery: true,
            },
            parserOptions: {
                sourceType: 'module',
            },
            // These scripts are loaded in HTML; tell ESLint not to complain about them being undefined
            globals: {
                globalThis: 'readonly',
                ePub: 'readonly',
                pdfjsLib: 'readonly',
                toastr: 'readonly',
                SillyTavern: 'readonly',
            },
        },
    ],
    ignorePatterns: [
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
    ],
    rules: {
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

        // These rules should eventually be enabled.
        'no-async-promise-executor': 'off',
        'no-inner-declarations': 'off',
    },
};
