module.exports = {
    root: true,
    extends: [
        'eslint:recommended'
    ],
    env: {
        es6: true
    },
    parserOptions: {
        ecmaVersion: 'latest'
    },
    overrides: [
        {
            // Server-side files (plus this configuration file)
            files: ["src/**/*.js", "server.js", ".eslintrc.js"],
            env: {
                node: true
            }
        },
        {
            // Browser-side files
            files: ["public/**/*.js"],
            env: {
                browser: true,
                jquery: true
            },
            parserOptions: {
                sourceType: 'module'
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
                toastr: 'readonly'
            }
        }
    ],
    // There are various vendored libraries that shouldn't be linted
    ignorePatterns: ['public/lib/**/*', '*.min.js', 'src/ai_horde/**/*'],
    // Most, if not all, of these rules should eventually be enabled and the code changed. They're disabled so that
    // linting passes.
    rules: {
        'no-unused-vars': 'off',
        'no-control-regex': 'off',
        'no-async-promise-executor': 'off',
        'no-inner-declarations': 'off',
        'no-undef': 'off',
        'require-yield': 'off',
        'no-constant-condition': ['error', {checkLoops: false}]
    }
};
