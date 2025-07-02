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
  terminalSupportsUnicode,
  writeStream,
  cleanStream
} from './utils.js';

const { dashes, dots } = spinners;

class Spinnies {
  constructor(options = {}) {
    options = purgeSpinnersOptions(options);
    this.options = {
      spinnerColor: 'greenBright',
      succeedColor: 'green',
      failColor: 'red',
      spinner: terminalSupportsUnicode() ? dots : dashes,
      disableSpins: false,
      ...options,
    };
    this.spinners = {};
    this.isCursorHidden = false;
    this.currentInterval = null;
    this.stream = process.stderr;
    this.lineCount = 0;
    this.currentFrameIndex = 0;
    this.spin =
      !this.options.disableSpins &&
      !process.env.CI &&
      process.stderr &&
      process.stderr.isTTY;
    this.bindSigint();
  }

  pick(name) {
    return this.spinners[name];
  }

  add(name, options = {}) {
    if (typeof name !== 'string')
      throw Error('A spinner reference name must be specified');

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
    const { status } = options;
    this.setSpinnerProperties(name, options, status);
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
    if (typeof name !== 'string')
      throw Error('A spinner reference name must be specified');

    if (!this.spinners[name])
      throw new Error(`No spinner initialized with name ${name}`);

    const spinner = this.spinners[name];
    delete this.spinners[name];

    return spinner;
  }

  stopAll(newStatus = 'stopped') {
    Object.keys(this.spinners).forEach((name) => {
      const { status: currentStatus } = this.spinners[name];
      if (
        currentStatus !== 'fail' &&
        currentStatus !== 'succeed' &&
        currentStatus !== 'non-spinnable'
      ) {
        if (newStatus === 'succeed' || newStatus === 'fail') {
          this.spinners[name].status = newStatus;
          this.spinners[name].color = this.options[`${newStatus}Color`];
        } else {
          this.spinners[name].status = 'stopped';
          this.spinners[name].color = 'grey';
        }
      }
    });
    this.checkIfActiveSpinners();

    return this.spinners;
  }

  hasActiveSpinners() {
    return !!Object.values(this.spinners).find(
      ({ status }) => status === 'spinning'
    );
  }

  setSpinnerProperties(name, options, status) {
    if (typeof name !== 'string')
      throw Error('A spinner reference name must be specified');

    if (!this.spinners[name])
      throw Error(`No spinner initialized with name ${name}`);

    options = purgeSpinnerOptions(options);
    status = status || this.spinners[name].status || 'spinning';

    this.spinners[name] = { ...this.spinners[name], ...options, status };
  }

  updateSpinnerState() {
    if (!this.spin) {
      this.setRawStreamOutput();
      return;
    }
    
    clearInterval(this.currentInterval);
    this.currentInterval = this.loopStream();
    if (!this.isCursorHidden) cliCursor.hide();
    this.isCursorHidden = true;
    this.checkIfActiveSpinners();
  }

  loopStream() {
    const { frames, interval } = this.options.spinner;

    return setInterval(() => {
      this.setStreamOutput(frames[this.currentFrameIndex]);
      this.currentFrameIndex =
        this.currentFrameIndex === frames.length - 1
          ? 0
          : ++this.currentFrameIndex;
    }, interval);
  }

  setStreamOutput(frame = '') {
    let output = '';
    const linesLength = [];
    const hasActiveSpinners = this.hasActiveSpinners();
    Object.values(this.spinners).map(
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
            text = breakText(text, prefixLength);
            line = `${colors[spinnerColor](frame)} ${
              color ? colors[color](text) : text
            }`;
            break;
          }
          case 'succeed': {
            prefixLength += succeedPrefix.length + 1;
            if (hasActiveSpinners) text = breakText(text, prefixLength);
            line = `${colors.green(succeedPrefix)} ${colors[succeedColor](text)}`;
            break;
          }
          case 'fail': {
            prefixLength += failPrefix.length + 1;
            if (hasActiveSpinners) text = breakText(text, prefixLength);
            line = `${colors.red(failPrefix)} ${colors[failColor](text)}`;
            break;
          }
          default: {
            if (hasActiveSpinners) text = breakText(text, prefixLength);
            line = color ? colors[color](text) : text;
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
    Object.values(this.spinners).forEach((i) => {
      process.stderr.write(`- ${i.text}\n`);
    });
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
    process.removeAllListeners('SIGINT');
    process.on('SIGINT', () => {
      cliCursor.show();
      readline.moveCursor(process.stderr, 0, this.lineCount);
      process.exit(0);
    });
  }
}

export default Spinnies;
export { dots, dashes };
