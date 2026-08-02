'use strict';

import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, describe, it, mock } from 'node:test';
import Spinnies from '../index.js';
import { DEFAULT_COLOR } from '../utils.js';
import { describeUpdateBehaviour } from './behaviours.js';
import { assertHasExactKeys, assertIncludes } from './helpers.js';

// Spinnies renders on stderr: swallow every write so the reporter output stays readable.
mock.method(process.stderr, 'write', () => true);
after(() => mock.restoreAll());

describe('Spinnies', () => {
    let spinnies;
    let spinnersOptions;

    beforeEach(() => {
        spinnies = new Spinnies();
        spinnersOptions = {
            succeedColor: DEFAULT_COLOR.SUCCEED,
            failColor: DEFAULT_COLOR.FAILED,
            spinnerColor: DEFAULT_COLOR.SPINNER,
            status: 'spinning',
        };
    });

    // Clears the render interval and the process listeners bound by the constructor.
    afterEach(() => spinnies.destroy());

    describe('methods', () => {
        describe('#add', () => {
            describe('validations', () => {
                describe('when no spinner name specified', () => {
                    it('throws an error', () => {
                        assert.throws(() => spinnies.add(), {
                            message: 'A spinner reference name must be specified',
                        });
                    });
                });
            });

            describe('adding new spinners', () => {
                it('has initial variables defined', () => {
                    const spinner = spinnies.add('spinner');

                    assertIncludes(spinner, spinnersOptions);
                });

                describe('when no initial text is specified', () => {
                    it('takes the spinner name as text', () => {
                        const spinner = spinnies.add('spinner-name');

                        assert.strictEqual(spinner.text, 'spinner-name');
                    });
                });

                describe('when initial text is specified', () => {
                    it('uses the specified spinner text', () => {
                        const spinner = spinnies.add('spinner-name', {
                            text: 'Hello spinner-name',
                        });

                        assert.strictEqual(spinner.text, 'Hello spinner-name');
                    });
                });

                describe('when specifying options', () => {
                    describe('when options are correct', () => {
                        it('overrides the default options', () => {
                            const options = {
                                color: 'black',
                                spinnerColor: 'black',
                                succeedColor: 'black',
                                failColor: 'black',
                                status: 'non-spinnable',
                                indent: 2,
                            };
                            const spinner = spinnies.add('spinner-name', options);

                            assertIncludes(spinner, { ...spinnersOptions, ...options });
                        });
                    });

                    describe('when options are not valid', () => {
                        it('mantains the default options', () => {
                            const options = {
                                color: 'foo',
                                spinnerColor: 'bar',
                                status: 'buz',
                                indent: 'baz',
                            };
                            const spinner = spinnies.add('spinner-name', options);

                            assertIncludes(spinner, spinnersOptions);
                        });
                    });
                });
            });
        });

        describe('#remove', () => {
            describe('validations', () => {
                describe('when no spinner name specified', () => {
                    it('throws an error', () => {
                        assert.throws(() => spinnies.remove(), {
                            message: 'A spinner reference name must be specified',
                        });
                    });
                });
            });

            it('removes the spinner from the spinners object', () => {
                spinnies.add('spinner-name');
                assertHasExactKeys(spinnies.spinners, 'spinner-name');

                spinnies.remove('spinner-name');
                assertHasExactKeys(spinnies.spinners);
            });
        });

        describe('methods that modify the status of a spinner', () => {
            beforeEach(() => {
                spinnies.add('spinner');
                spinnies.add('another-spinner');
                spinnies.add('third-spinner');
                spinnies.add('non-spinnable', { status: 'non-spinnable' });
            });

            describeUpdateBehaviour(() => spinnies, 'succeed');
            describeUpdateBehaviour(() => spinnies, 'fail');
            describeUpdateBehaviour(() => spinnies, 'update');

            describe('#stopAll', () => {
                let spinner;
                let anotherSpinner;
                let nonSpinnable;
                let thirdSpinner;

                beforeEach(() => {
                    spinner = spinnies.succeed('spinner');
                    anotherSpinner = spinnies.fail('another-spinner');
                    nonSpinnable = spinnies.pick('non-spinnable');
                    thirdSpinner = spinnies.pick('third-spinner');
                });

                const assertFinishedSpinnersAreKept = () => {
                    assert.strictEqual(spinner.status, 'succeed');
                    assert.strictEqual(anotherSpinner.status, 'fail');
                    assert.strictEqual(nonSpinnable.status, 'non-spinnable');
                };

                describe('when providing a new status', () => {
                    it('sets non-finished spinners as succeed', () => {
                        spinnies.stopAll('succeed');

                        assertFinishedSpinnersAreKept();
                        assert.strictEqual(thirdSpinner.status, 'succeed');
                        assert.strictEqual(thirdSpinner.color, DEFAULT_COLOR.SUCCEED);
                    });

                    it('sets non-finished spinners as fail', () => {
                        spinnies.stopAll('fail');

                        assertFinishedSpinnersAreKept();
                        assert.strictEqual(thirdSpinner.status, 'fail');
                        assert.strictEqual(thirdSpinner.color, DEFAULT_COLOR.FAILED);
                    });

                    it('sets non-finished spinners as stopped', () => {
                        spinnies.stopAll('foobar');

                        assertFinishedSpinnersAreKept();
                        assert.strictEqual(thirdSpinner.status, 'stopped');
                        assert.strictEqual(thirdSpinner.color, DEFAULT_COLOR.STOPPED);
                    });
                });

                describe('when not providing a new status', () => {
                    it('sets non-finished spinners as stopped', () => {
                        spinnies.stopAll();

                        assertFinishedSpinnersAreKept();
                        assert.strictEqual(thirdSpinner.status, 'stopped');
                        assert.strictEqual(thirdSpinner.color, DEFAULT_COLOR.STOPPED);
                    });
                });
            });
        });
    });
});
