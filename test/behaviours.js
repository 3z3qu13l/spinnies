'use strict';

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertIncludes, assertLacksKeys } from './helpers.js';

/**
 * Shared expectations for every method updating an existing spinner.
 * `getSpinnies` is a getter so each test reads the instance built by the current `beforeEach`.
 */
function describeUpdateBehaviour(getSpinnies, status) {
    const currentStatus = status === 'update' ? 'succeed' : status;

    describe(`#${status}`, () => {
        it(`changes the status to ${currentStatus}`, () => {
            const spinnies = getSpinnies();
            const spinner = spinnies[currentStatus]('spinner');
            const anotherSpinner = spinnies.pick('another-spinner');

            assert.strictEqual(spinner.status, currentStatus);
            assert.strictEqual(anotherSpinner.status, 'spinning');
        });

        describe('when not specifying a spinner name', () => {
            it('throws an error', () => {
                assert.throws(() => getSpinnies()[status]({}), {
                    message: 'A spinner reference name must be specified',
                });
            });
        });

        describe('when specifying a non-existent spinner name', () => {
            it('throws an error', () => {
                assert.throws(() => getSpinnies()[status]('i-dont-exist'), {
                    message: 'No spinner initialized with name i-dont-exist',
                });
            });
        });

        describe('when specifying options', () => {
            describe('when options are correct', () => {
                it('overrides the default options', () => {
                    const options = {
                        text: 'updated text',
                        color: 'black',
                        spinnerColor: 'black',
                    };
                    const spinner = getSpinnies()[status]('spinner', options);

                    assertIncludes(spinner, options);
                });
            });

            describe('when options have no valid values', () => {
                it('mantains the previous options', () => {
                    const options = { text: 42, color: 'foo', spinnerColor: 'bar' };
                    const spinner = getSpinnies()[currentStatus]('spinner', options);

                    assertIncludes(spinner, {
                        text: 'spinner',
                        spinnerColor: 'greenBright',
                    });
                });
            });

            describe('when specifying invalid attributes', () => {
                it('ignores those attributes', () => {
                    const options = {
                        text: 'updated text',
                        color: 'black',
                        spinnerColor: 'black',
                    };
                    const spinner = getSpinnies()[status]('spinner', options);

                    assertIncludes(spinner, options);
                    assertLacksKeys(spinner, 'foo', 'bar');
                });
            });
        });
    });
}

export {
    describeUpdateBehaviour,
};
