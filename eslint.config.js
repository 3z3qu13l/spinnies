import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import globals from 'globals';

export default defineConfig([
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
            'node-modules/*',
            'test/*'
        ],
        rules: {
            'comma-dangle': 'off',
            indent: ['error', 4],
            quotes: ['error', 'single'],
        },
    },
]);
