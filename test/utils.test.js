'use strict';

import { expect } from 'chai';
import {
    purgeSpinnersOptions,
    purgeSpinnerOptions,
    colorOptions,
    breakText,
} from '../utils.js';
import spinners from '../spinners.json' with { type: 'json' };

const { dots } = spinners;

describe('utils', function ()  {
    beforeEach('set options', function ()  {
        this.colors = {
            color: 'blue',
            spinnerColor: 'blue',
            succeedColor: 'blue',
            failColor: 'blue',
        };
    });

    describe('functions', function ()  {
        describe('#colorOptions', function ()  {
            context(
                'when specifying other attributes rather than valid colors',
                function ()  {
                    it('removes the invalid keys', function ()  {
                        const colors = colorOptions({
                            ...this.colors,
                            foo: 'foo',
                            bar: 'bar',
                        });
                        expect(colors).to.include(this.colors);
                        expect(colors).to.not.include({ foo: 'foo', bar: 'bar' });
                        expect(colors).to.not.have.any.keys('foo', 'bar');
                    });

                    it('replace with default if invalid colors', function ()  {
                        const colors = colorOptions({
                            ...this.colors,
                            spinnerColor: 'foo',
                            succeedColor: 'bar',
                        });
                        expect(colors).to.include({ color: 'blue', failColor: 'blue', spinnerColor: 'greenBright', succeedColor: 'green' });
                    });
                }
            );
        });

        describe('#purgeSpinnersOptions', function ()  {
            describe('spinner object', function ()  {
                context('when providing invalid interval and frames', function ()  {
                    it('picks the default spinner', function ()  {
                        const spinner = { interval: 'foo', frames: 'bar' };
                        const options = purgeSpinnersOptions({ ...this.colors, spinner });
                        expect(options).to.deep.include({ ...this.colors, spinner: dots });
                    });
                });

                context('when providing invalid interval', function ()  {
                    it('picks the interval from the default spinner', function ()  {
                        const spinner = { interval: 'foo', frames: ['-', '+'] };
                        const options = purgeSpinnersOptions({ ...this.colors, spinner });
                        expect(options).to.deep.include({
                            ...this.colors,
                            spinner: { interval: dots.interval, frames: ['-', '+'] },
                        });
                    });
                });

                context('when providing invalid frames', function ()  {
                    it('picks frames from the default spinner', function ()  {
                        const spinner = { interval: 100, frames: 'foo' };
                        const options = purgeSpinnersOptions({ ...this.colors, spinner });
                        expect(options).to.deep.include({
                            ...this.colors,
                            spinner: { interval: 100, frames: dots.frames },
                        });
                    });
                });

                context('when providing valid spinner', function ()  {
                    it('persists the spinner', function ()  {
                        const spinner = { interval: 100, frames: ['-', '+'] };
                        const options = purgeSpinnersOptions({ ...this.colors, spinner });
                        expect(options).to.deep.include({ ...this.colors, spinner });
                    });
                });
            });
        });

        describe('#purgeSpinnerOptions', function ()  {
            context('when providing valid status and name', function ()  {
                it('persist them', function ()  {
                    const options = purgeSpinnerOptions({
                        ...this.colors,
                        text: 'text',
                        status: 'succeed',
                    });
                    expect(options).to.include({
                        ...this.colors,
                        text: 'text',
                        status: 'succeed',
                    });
                });
            });

            context('when providing invalid status and name', function ()  {
                it('does not persist them', function ()  {
                    const options = purgeSpinnerOptions({
                        ...this.colors,
                        text: 3,
                        status: 'foo',
                    });
                    expect(options).to.include(this.colors);
                    expect(options).to.not.have.any.keys('text', 'status');
                });
            });

            context('when providing valid indent value', function ()  {
                it('persist it', function ()  {
                    const options = purgeSpinnerOptions({ indent: 2 });
                    expect(options).to.include({ indent: 2 });
                });
            });

            context('when providing invalid indent value', function ()  {
                it('does not persist it', function ()  {
                    const options = purgeSpinnerOptions({ indent: 'bar' });
                    expect(options).to.not.have.key('indent');
                });
            });
        });

        describe('#breakText', function ()  {
            beforeEach(function ()  {
                this.columns = process.stderr.columns;
                process.stderr.columns = 10;
            });

            afterEach(function ()  {
                process.stderr.columns = this.columns;
            });

            context(
                'when number of lines in text is greater than the columns length',
                function ()  {
                    it('adds line-breaks to the given text', function ()  {
                        const text = breakText(new Array(51).join('a'), 3);
                        const splitted = text.split('\n');
                        expect(splitted).to.have.lengthOf(6);
                        expect(splitted[0]).to.have.lengthOf(6); // 10 - 3 - 1
                        expect(splitted[1]).to.have.lengthOf(9); // 10 - 0 - 1
                    });
                }
            );

            context(
                'when number of lines in text is less than the columns length',
                function ()  {
                    it('does not add line-breaks to the given text', function ()  {
                        const text = '12345';
                        expect(text.split('\n')).to.have.lengthOf(1);
                    });
                }
            );
        });
    });
});
