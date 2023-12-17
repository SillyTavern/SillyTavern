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
                DOMPurify: 'readonly',
                droll: 'readonly',
                Fuse: 'readonly',
                Handlebars: 'readonly',
                hljs: 'readonly',
                localforage: 'readonly',
                moment: 'readonly',
                pdfjsLib: 'readonly',
                Popper: 'readonly',
                showdown: 'readonly',
                showdownKatex: 'readonly',
                SVGInject: 'readonly',
                toastr: 'readonly',
            },
        },
    ],
    // There are various vendored libraries that shouldn't be linted
    ignorePatterns: ['public/lib/**/*', '*.min.js', 'src/ai_horde/**/*'],
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

        // These rules should eventually be enabled.
        'no-async-promise-executor': 'off',
        'no-inner-declarations': 'off',
    },
};
