'use strict';

import readline from 'readline';
import stripAnsi from 'strip-ansi';
import stringWidth from 'string-width';
import spinners from './spinners.json' with { type: 'json' };

const { dashes, dots } = spinners;

const VALID_STATUSES = new Set([
    'succeed', 'fail', 'spinning', 'non-spinnable', 'stopped',
]);

const VALID_COLORS = new Set([
    'black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white',
    'gray', 'redBright', 'greenBright', 'yellowBright', 'blueBright',
    'magentaBright', 'cyanBright', 'whiteBright',
]);

const MAX_INDENT = 100;
const MAX_RECURSIVE = 50;

const TERMINAL_SUPPORTS_UNICODE = (
    process.platform !== 'win32' ||
    process.env.TERM_PROGRAM === 'vscode' ||
    Boolean(process.env.WT_SESSION)
);

function purgeSpinnerOptions(options) {
    const { text, status, indent } = options;

    const opts = {};
    if (typeof status === 'string' && VALID_STATUSES.has(status)) opts.status = status;
    if (typeof text === 'string') opts.text = text;
    if (typeof indent === 'number' && indent >= 0 && indent <= MAX_INDENT) opts.indent = indent;

    return {
        ...colorOptions(options),
        ...opts
    };
}

function purgeSpinnersOptions({ spinner, disableSpins, ...others }) {
    const colors = colorOptions(others);
    const prefixes = prefixOptions(others);
    const disableSpinsOption = typeof disableSpins === 'boolean' ? { disableSpins } : {};
    const validatedSpinner = validateSpinner(spinner);

    return {
        ...colors,
        ...prefixes,
        ...disableSpinsOption,
        spinner: validatedSpinner
    };
}

function validateSpinner(spinner = {}) {
    const fallback = TERMINAL_SUPPORTS_UNICODE ? dots : dashes;
    if (typeof spinner !== 'object' || spinner == null) return fallback;

    const frames = Array.isArray(spinner.frames) && spinner.frames.length > 0
        ? spinner.frames
        : fallback.frames;

    const interval = typeof spinner.interval === 'number'
        ? spinner.interval
        : fallback.interval;

    return { interval, frames };
}

function colorOptions({ color, succeedColor, failColor, spinnerColor }) {
    return {
        color: VALID_COLORS.has(color) ? color : 'white',
        succeedColor: VALID_COLORS.has(succeedColor) ? succeedColor : 'green',
        failColor: VALID_COLORS.has(failColor) ? failColor : 'red',
        spinnerColor: VALID_COLORS.has(spinnerColor) ? spinnerColor : 'greenBright',
    };
}

function prefixOptions({ succeedPrefix, failPrefix }) {
    return {
        succeedPrefix: succeedPrefix ?? (TERMINAL_SUPPORTS_UNICODE ? '✓' : '√'),
        failPrefix: failPrefix ?? (TERMINAL_SUPPORTS_UNICODE ? '✖' : '×'),
    };
}

function breakText(text, prefixLength) {
    if (typeof text !== 'string') return '';

    return text
        .split('\n')
        .map((line, index) => breakLine(line, index === 0 ? prefixLength : 0))
        .join('\n');
}

function breakLine(line, prefixLength, depth = 0) {
    const columns = process.stderr?.columns || 95;
    const limit = Math.max(2, columns - Math.max(0, prefixLength) - 1);

    // Prevents infinite recursion with depth as a counter
    if (stringWidth(line) <= limit || depth > MAX_RECURSIVE) return line;

    // Find a safe breaking point without splitting wide characters
    let width = 0;
    let i = 0;
    while (i < line.length && width + stringWidth(line[i]) <= limit) {
        width += stringWidth(line[i]);
        i++;
    }

    const part = line.slice(0, i);
    const rest = line.slice(i);
    return `${part}\n${breakLine(rest, 0, depth + 1)}`;
}

function getLinesLength(text, prefixLength) {
    return stripAnsi(text)
        .split('\n')
        .map((line, index) =>
            index === 0 ? stringWidth(line) + prefixLength : stringWidth(line)
        );
}

function writeStream(stream, output, rawLines) {
    if (!stream || stream.destroyed) {
        return false;
    }

    try {
        stream.write(output);
        readline.moveCursor(stream, 0, -rawLines.length);
        return true;
    } catch (error) {// eslint-disable-line no-unused-vars
        return false;
    }
}

function cleanStream(stream, rawLines) {
    rawLines.forEach((lineLength, index) => {
        readline.moveCursor(stream, lineLength, index);
        readline.clearLine(stream, 1);
        readline.moveCursor(stream, -lineLength, -index);
    });
    readline.moveCursor(stream, 0, rawLines.length);
    readline.clearScreenDown(stream);
    readline.moveCursor(stream, 0, -rawLines.length);
}

export {
    purgeSpinnersOptions,
    purgeSpinnerOptions,
    colorOptions,
    breakText,
    getLinesLength,
    writeStream,
    cleanStream,
    TERMINAL_SUPPORTS_UNICODE,
};
