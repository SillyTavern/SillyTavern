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
        'no-useless-escape': 'off',
        'no-control-regex': 'off',
        'no-redeclare': 'off',
        'no-async-promise-executor': 'off',
        'no-inner-declarations': 'off',
        'no-extra-semi': 'off',
        'no-undef': 'off',
        'no-prototype-builtins': 'off',
        'no-unused-labels': 'off',
        'no-extra-boolean-cast': 'off',
        'require-yield': 'off',
        'no-case-declarations': 'off',
        'use-isnan': 'off',
        'no-self-assign': 'off',
        'no-constant-condition': ['error', {checkLoops: false}]
    }
};
