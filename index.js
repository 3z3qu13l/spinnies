'use strict';

import readline from 'readline';
import colors from 'yoctocolors';
import cliCursor from 'cli-cursor';
import spinners from './spinners.json' with { type: 'json' };
import {
    purgeSpinnerOptions,
    purgeSpinnersOptions,
    colorOptions,
    breakText,
    getLinesLength,
    DEFAULT_COLOR,
    TERMINAL_SUPPORTS_UNICODE,
    writeStream,
    cleanStream
} from './utils.js';

const { dashes, dots } = spinners;

class Spinnies {
    constructor(options = {}) {
        options = purgeSpinnersOptions(options);
        this.options = {
            spinnerColor: DEFAULT_COLOR.SPINNER,
            succeedColor: DEFAULT_COLOR.SUCCEED,
            failColor: DEFAULT_COLOR.FAILED,
            spinner: options.spinner ?? TERMINAL_SUPPORTS_UNICODE ? dots : dashes,
            disableSpins: false,
            ...options,
        };

        this.spinners = {};
        this.isCursorHidden = false;
        this.currentInterval = null;
        this.stream = process.stderr;
        this.lineCount = 0;
        this.currentFrameIndex = 0;

        this.spin = !this.options.disableSpins && !process.env.CI && process.stderr?.isTTY;
        if (!this.spin) {
            console.warn('[spinnies] Falling back to raw output (TTY not detected or spins disabled)');
        }

        this.exitHandler = this.handleExit.bind(this);
        this.sigintHandler = this.handleSigint.bind(this);
        
        this.bindSigint();
    }

    cleanup() {
        if (this.currentInterval) {
            clearInterval(this.currentInterval);
            this.currentInterval = null;
        }
        if (this.isCursorHidden) {
            cliCursor.show();
            this.isCursorHidden = false;
        }
    }

    handleExit() {
        this.cleanup();
    }

    handleSigint() {
        this.cleanup();
        process.exit(0);
    }

    pick(name) {
        return this.spinners[name];
    }

    add(name, options = {}) {
        if (typeof name !== 'string') throw new Error('A spinner reference name must be specified');
        if (this.spinners[name]) throw new Error(`Spinner with name "${name}" already exists.`);

        if (!options.text) options.text = name;

        const spinnerProperties = {
            ...colorOptions(this.options),
            succeedPrefix: this.options.succeedPrefix,
            failPrefix: this.options.failPrefix,
            status: 'spinning',
            ...purgeSpinnerOptions(options),
        };

        this.spinners[name] = spinnerProperties;
        this.updateSpinnerState();

        return spinnerProperties;
    }

    update(name, options = {}) {
        this.setSpinnerProperties(name, options, options.status);
        this.updateSpinnerState();

        return this.spinners[name];
    }

    succeed(name, options = {}) {
        this.setSpinnerProperties(name, options, 'succeed');
        this.updateSpinnerState();

        return this.spinners[name];
    }

    fail(name, options = {}) {
        this.setSpinnerProperties(name, options, 'fail');
        this.updateSpinnerState();

        return this.spinners[name];
    }

    remove(name) {
        if (typeof name !== 'string') throw new Error('A spinner reference name must be specified');
        if (!this.spinners[name]) throw new Error(`No spinner initialized with name ${name}`);

        delete this.spinners[name];
        this.updateSpinnerState();
    }

    stopAll(newStatus = 'stopped') {
        for (const name of Object.keys(this.spinners)) {
            const spinner = this.spinners[name];
            if (!['fail', 'succeed', 'non-spinnable'].includes(spinner.status)) {
                if (['fail', 'succeed'].includes(newStatus)) {
                    spinner.status = newStatus;
                    spinner.color = this.options[`${newStatus}Color`];
                } else {
                    spinner.status = 'stopped';
                    spinner.color = DEFAULT_COLOR.STOPPED;
                }
            }
        }

        this.checkIfActiveSpinners();
        return this.spinners;
    }

    hasActiveSpinners() {
        return Object.values(this.spinners).some(({ status }) => status === 'spinning');
    }

    setSpinnerProperties(name, options, status) {
        if (typeof name !== 'string') throw new Error('A spinner reference name must be specified');
        if (!this.spinners[name]) throw new Error(`No spinner initialized with name ${name}`);

        options = purgeSpinnerOptions(options);
        const updatedStatus = status || this.spinners[name].status || 'spinning';

        this.spinners[name] = {
            ...this.spinners[name],
            ...options,
            status: updatedStatus
        };
    }

    updateSpinnerState() {
        if (!this.spin) {
            this.setRawStreamOutput();
            return;
        }

        if (this.currentInterval) {
            clearInterval(this.currentInterval);
            this.currentInterval = null;
        }
    
        this.currentInterval = this.loopStream();

        if (!this.isCursorHidden) {
            this.isCursorHidden = true;
            cliCursor.hide();
        }

        this.checkIfActiveSpinners();
    }

    loopStream() {
        const { frames, interval } = this.options.spinner;

        return setInterval(() => {
            this.setStreamOutput(frames[this.currentFrameIndex]);
            this.currentFrameIndex = (this.currentFrameIndex + 1) % frames.length;
        }, interval);
    }

    setStreamOutput(frame = '') {
        let output = '';
        const linesLength = [];
        const hasActiveSpinners = this.hasActiveSpinners();

        Object.values(this.spinners).forEach(
            ({
                text,
                status,
                color,
                spinnerColor,
                succeedColor,
                failColor,
                succeedPrefix,
                failPrefix,
                indent,
            }) => {
                let line;
                let prefixLength = indent || 0;

                switch (status) {
                case 'spinning': {
                    prefixLength += frame.length + 1;
                    const formattedText = breakText(text, prefixLength);
                    line = `${colors[spinnerColor](frame)} ${
                        color ? colors[color](formattedText) : formattedText
                    }`;
                    break;
                }
                case 'succeed': {
                    prefixLength += succeedPrefix.length + 1;
                    const formattedText = hasActiveSpinners ? breakText(text, prefixLength) : text;
                    line = `${colors[succeedColor](succeedPrefix)} ${colors[succeedColor](formattedText)}`;
                    break;
                }
                case 'fail': {
                    prefixLength += failPrefix.length + 1;
                    const formattedText = hasActiveSpinners ? breakText(text, prefixLength) : text;
                    line = `${colors[failColor](failPrefix)} ${colors[failColor](formattedText)}`;
                    break;
                }
                default: {
                    const formattedText = hasActiveSpinners ? breakText(text, prefixLength) : text;
                    line = color && colors[color] ? colors[color](formattedText) : formattedText;
                    break;
                }
                }

                linesLength.push(...getLinesLength(text, prefixLength));
                output += indent ? `${' '.repeat(indent)}${line}\n` : `${line}\n`;
            }
        );

        if (!hasActiveSpinners) readline.clearScreenDown(this.stream);

        writeStream(this.stream, output, linesLength);

        if (hasActiveSpinners) cleanStream(this.stream, linesLength);

        this.lineCount = linesLength.length;
    }

    setRawStreamOutput() {
        for (const { text } of Object.values(this.spinners)) {
            this.stream.write(`- ${text}\n`);
        }
    }

    checkIfActiveSpinners() {
        if (this.hasActiveSpinners()) return;

        if (this.spin) {
            this.setStreamOutput();
            readline.moveCursor(this.stream, 0, this.lineCount);
            clearInterval(this.currentInterval);
            this.isCursorHidden = false;
            cliCursor.show();
        }

        this.spinners = {};
    }

    bindSigint() {
        process.on('exit', this.exitHandler);
        process.on('SIGINT', this.sigintHandler);
    }

    destroy() {
        process.removeListener('exit', this.exitHandler);
        process.removeListener('SIGINT', this.sigintHandler);
        this.cleanup();
    }
}

export default Spinnies;
export { dots, dashes };
