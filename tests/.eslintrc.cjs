module.exports = {
    root: true,
    plugins: [
        'jest',
    ],
    extends: [
        'eslint:recommended',
    ],
    env: {
        es6: true,
        node: true,
        "jest/globals": true,
    },
    parserOptions: {
        ecmaVersion: 'latest',
    },
    overrides: [
    ],
    ignorePatterns: [
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
    },
};
