'use strict';

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import {
    purgeSpinnersOptions,
    purgeSpinnerOptions,
    colorOptions,
    breakText,
} from '../utils.js';
import spinners from '../spinners.json' with { type: 'json' };
import { assertDeepIncludes, assertIncludes, assertLacksKeys } from './helpers.js';

const { dots } = spinners;

describe('utils', () => {
    let colors;

    beforeEach(() => {
        colors = {
            color: 'blue',
            spinnerColor: 'blue',
            succeedColor: 'blue',
            failColor: 'blue',
        };
    });

    describe('functions', () => {
        describe('#colorOptions', () => {
            describe('when specifying other attributes rather than valid colors', () => {
                it('removes the invalid keys', () => {
                    const result = colorOptions({ ...colors, foo: 'foo', bar: 'bar' });

                    assertIncludes(result, colors);
                    assertLacksKeys(result, 'foo', 'bar');
                });

                it('replace with default if invalid colors', () => {
                    const result = colorOptions({
                        ...colors,
                        spinnerColor: 'foo',
                        succeedColor: 'bar',
                    });

                    assertIncludes(result, {
                        color: 'blue',
                        failColor: 'blue',
                        spinnerColor: 'greenBright',
                        succeedColor: 'green',
                    });
                });
            });
        });

        describe('#purgeSpinnersOptions', () => {
            describe('spinner object', () => {
                describe('when providing invalid interval and frames', () => {
                    it('picks the default spinner', () => {
                        const spinner = { interval: 'foo', frames: 'bar' };
                        const options = purgeSpinnersOptions({ ...colors, spinner });

                        assertDeepIncludes(options, { ...colors, spinner: dots });
                    });
                });

                describe('when providing invalid interval', () => {
                    it('picks the interval from the default spinner', () => {
                        const spinner = { interval: 'foo', frames: ['-', '+'] };
                        const options = purgeSpinnersOptions({ ...colors, spinner });

                        assertDeepIncludes(options, {
                            ...colors,
                            spinner: { interval: dots.interval, frames: ['-', '+'] },
                        });
                    });
                });

                describe('when providing invalid frames', () => {
                    it('picks frames from the default spinner', () => {
                        const spinner = { interval: 100, frames: 'foo' };
                        const options = purgeSpinnersOptions({ ...colors, spinner });

                        assertDeepIncludes(options, {
                            ...colors,
                            spinner: { interval: 100, frames: dots.frames },
                        });
                    });
                });

                describe('when providing valid spinner', () => {
                    it('persists the spinner', () => {
                        const spinner = { interval: 100, frames: ['-', '+'] };
                        const options = purgeSpinnersOptions({ ...colors, spinner });

                        assertDeepIncludes(options, { ...colors, spinner });
                    });
                });
            });
        });

        describe('#purgeSpinnerOptions', () => {
            describe('when providing valid status and name', () => {
                it('persist them', () => {
                    const options = purgeSpinnerOptions({
                        ...colors,
                        text: 'text',
                        status: 'succeed',
                    });

                    assertIncludes(options, { ...colors, text: 'text', status: 'succeed' });
                });
            });

            describe('when providing invalid status and name', () => {
                it('does not persist them', () => {
                    const options = purgeSpinnerOptions({ ...colors, text: 3, status: 'foo' });

                    assertIncludes(options, colors);
                    assertLacksKeys(options, 'text', 'status');
                });
            });

            describe('when providing valid indent value', () => {
                it('persist it', () => {
                    const options = purgeSpinnerOptions({ indent: 2 });

                    assertIncludes(options, { indent: 2 });
                });
            });

            describe('when providing invalid indent value', () => {
                it('does not persist it', () => {
                    const options = purgeSpinnerOptions({ indent: 'bar' });

                    assertLacksKeys(options, 'indent');
                });
            });
        });

        describe('#breakText', () => {
            let columns;

            beforeEach(() => {
                columns = process.stderr.columns;
                process.stderr.columns = 10;
            });

            afterEach(() => {
                process.stderr.columns = columns;
            });

            describe('when number of lines in text is greater than the columns length', () => {
                it('adds line-breaks to the given text', () => {
                    const text = breakText(new Array(51).join('a'), 3);
                    const splitted = text.split('\n');

                    assert.strictEqual(splitted.length, 6);
                    assert.strictEqual(splitted[0].length, 6); // 10 - 3 - 1
                    assert.strictEqual(splitted[1].length, 9); // 10 - 0 - 1
                });
            });

            describe('when number of lines in text is less than the columns length', () => {
                it('does not add line-breaks to the given text', () => {
                    const text = '12345';

                    assert.strictEqual(text.split('\n').length, 1);
                });
            });
        });
    });
});
