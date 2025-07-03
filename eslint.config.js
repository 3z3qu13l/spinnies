import { defineConfig } from 'eslint/config';
import mochaPlugin from 'eslint-plugin-mocha';
import js from '@eslint/js';
import globals from 'globals';

export default defineConfig([
    mochaPlugin.configs.recommended,
    {
        files: ['**/*.js'],
        plugins: {
            js,
        },
        extends: ['js/recommended'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: globals.node,
        },
        ignores: [
            'node-modules/*'
        ],
        rules: {
            'comma-dangle': 'off',
            'mocha/no-mocha-arrows': 'off',
            indent: ['error', 4],
            quotes: ['error', 'single'],
        },
    },
]);
