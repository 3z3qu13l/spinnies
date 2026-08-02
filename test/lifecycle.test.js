'use strict';

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import Spinnies from '../index.js';
import { assertIncludes } from './helpers.js';

const stderr = process.stderr;
const original = {
    isTTY: stderr.isTTY,
    columns: stderr.columns,
    write: stderr.write,
    CI: process.env.CI,
};

let written;
let instances;

const createSpinnies = (options) => {
    const instance = new Spinnies(options);
    instances.push(instance);

    return instance;
};

beforeEach(() => {
    written = [];
    instances = [];
    stderr.isTTY = true;
    stderr.columns = 80;
    stderr.write = (chunk) => { written.push(chunk); return true; };
    delete process.env.CI;
});

afterEach(() => {
    while (instances.length > 0) instances.pop().destroy();

    stderr.isTTY = original.isTTY;
    stderr.columns = original.columns;
    stderr.write = original.write;
    if (original.CI === undefined) delete process.env.CI;
    else process.env.CI = original.CI;
});

describe('Spinnies lifecycle (TTY)', () => {
    it('spins once stderr is a TTY', () => {
        const spinnies = createSpinnies();
        spinnies.add('a');

        assert.equal(spinnies.spin, true, 'the animated mode must be on');
        assert.notEqual(spinnies.currentInterval, null, 'an interval must be running');
    });

    describe('#destroy', () => {
        it('clears the render interval', () => {
            const spinnies = createSpinnies();
            spinnies.add('a');
            assert.notEqual(spinnies.currentInterval, null);

            spinnies.destroy();

            assert.equal(spinnies.currentInterval, null);
        });

        it('leaves no timer keeping the event loop alive', () => {
            const spinnies = createSpinnies();
            spinnies.add('a');
            assert.ok(process.getActiveResourcesInfo().includes('Timeout'));

            spinnies.destroy();

            assert.ok(
                !process.getActiveResourcesInfo().includes('Timeout'),
                'the process must no longer be held open'
            );
        });

        it('restores the cursor it hid', () => {
            const spinnies = createSpinnies();
            spinnies.add('a');
            assert.equal(spinnies.isCursorHidden, true);

            spinnies.destroy();

            assert.equal(spinnies.isCursorHidden, false);
        });

        it('is idempotent', () => {
            const spinnies = createSpinnies();
            spinnies.add('a');

            spinnies.destroy();
            assert.doesNotThrow(() => spinnies.destroy());
        });
    });

    describe('return values when the run completes', () => {
        it('returns the spinner from #succeed on the last active one', () => {
            const spinnies = createSpinnies();
            spinnies.add('solo');

            const spinner = spinnies.succeed('solo');

            assert.ok(spinner, '#succeed must not return undefined');
            assert.equal(spinner.status, 'succeed');
        });

        it('returns the spinner from #fail on the last active one', () => {
            const spinnies = createSpinnies();
            spinnies.add('solo');

            const spinner = spinnies.fail('solo');

            assert.ok(spinner, '#fail must not return undefined');
            assert.equal(spinner.status, 'fail');
        });

        it('returns the stopped spinners from #stopAll', () => {
            const spinnies = createSpinnies();
            spinnies.add('x');
            spinnies.add('y');

            const stopped = spinnies.stopAll('succeed');

            assert.deepEqual(Object.keys(stopped).sort(), ['x', 'y']);
            assert.equal(stopped.x.status, 'succeed');
        });
    });

    describe('#update', () => {
        it('keeps references handed out by #add and #pick live', () => {
            const spinnies = createSpinnies();
            const reference = spinnies.add('p');
            spinnies.add('keep-alive');

            spinnies.update('p', { text: 'updated' });

            assert.equal(reference.text, 'updated');
            assert.equal(spinnies.pick('p'), reference, 'the very same instance must be kept');
        });

        it('preserves colors the caller did not restate', () => {
            const spinnies = createSpinnies();
            spinnies.add('x', { color: 'blue', succeedColor: 'magenta' });
            spinnies.add('keep-alive');

            const spinner = spinnies.update('x', { text: 'updated text' });

            assertIncludes(spinner, { color: 'blue', succeedColor: 'magenta', text: 'updated text' });
        });

        it('ignores an invalid status instead of storing it', () => {
            const spinnies = createSpinnies();
            spinnies.add('x');
            spinnies.add('keep-alive');

            const spinner = spinnies.update('x', { status: 'utterly-invalid' });

            assert.equal(spinner.status, 'spinning');
        });
    });

    describe('#add', () => {
        it('does not mutate the caller options object', () => {
            const spinnies = createSpinnies();
            const options = { color: 'blue' };

            spinnies.add('my-spinner', options);

            assert.deepEqual(options, { color: 'blue' });
        });

        it('honours a custom spinner', () => {
            const spinner = { interval: 999, frames: ['A', 'B'] };
            const spinnies = createSpinnies({ spinner });

            assert.deepEqual(spinnies.options.spinner, spinner);
        });
    });

    describe('rendering', () => {
        // A frame must be vertically neutral: it draws N lines then rewinds N lines.
        // Under-counting the rewind is what corrupted the display on wrapped text.
        const verticalDelta = (chunks) => {
            const text = chunks.join('');
            const escape = String.fromCharCode(27);
            const moves = new RegExp(`${escape}\\[(\\d+)([AB])`, 'g');

            let delta = (text.match(/\n/g) || []).length;
            for (const [, amount, direction] of text.matchAll(moves)) {
                delta += direction === 'B' ? Number(amount) : -Number(amount);
            }

            return delta;
        };

        it('leaves the cursor on its starting row after a frame with wrapped text', () => {
            stderr.columns = 20;
            const spinnies = createSpinnies();
            spinnies.add('wrapped', { text: 'a'.repeat(60) });
            spinnies.add('short', { text: 'short' });

            written.length = 0;
            spinnies.setStreamOutput('-');

            assert.equal(verticalDelta(written), 0, 'the cursor must return to its starting row');
        });

        it('rewinds the cursor by every physical line of a wrapped spinner', () => {
            stderr.columns = 20;
            const spinnies = createSpinnies();
            spinnies.add('long', { text: 'a'.repeat(60) });

            written.length = 0;
            spinnies.setStreamOutput('-');

            // 60 chars over ~18 usable columns wrap onto several physical lines; lineCount
            // must match what was actually drawn, not the single logical line.
            assert.ok(spinnies.lineCount > 1, `attendu > 1 ligne, obtenu ${spinnies.lineCount}`);
            assert.equal(spinnies.lineCount, written.join('').split('\n').length - 1);
        });
    });

    describe('the render loop', () => {
        const threeFrames = { interval: 50, frames: ['A', 'B', 'C'] };

        it('advances one frame per tick and wraps around', (t) => {
            t.mock.timers.enable({ apis: ['setInterval'] });
            const spinnies = createSpinnies({ spinner: threeFrames });
            spinnies.add('a');

            assert.equal(spinnies.currentFrameIndex, 0);

            t.mock.timers.tick(50);
            assert.equal(spinnies.currentFrameIndex, 1);

            t.mock.timers.tick(50);
            assert.equal(spinnies.currentFrameIndex, 2);

            t.mock.timers.tick(50);
            assert.equal(spinnies.currentFrameIndex, 0, 'the index must wrap back to zero');
        });

        it('draws the current frame on every tick', (t) => {
            t.mock.timers.enable({ apis: ['setInterval'] });
            const spinnies = createSpinnies({ spinner: threeFrames });
            spinnies.add('a');

            written.length = 0;
            t.mock.timers.tick(50);
            assert.match(written.join(''), /A/);

            written.length = 0;
            t.mock.timers.tick(50);
            assert.match(written.join(''), /B/);
        });

        it('stops the loop when a frame fails to render', (t) => {
            t.mock.timers.enable({ apis: ['setInterval'] });
            const spinnies = createSpinnies({ spinner: threeFrames });
            spinnies.add('a');
            assert.notEqual(spinnies.currentInterval, null);

            spinnies.setStreamOutput = () => false;
            t.mock.timers.tick(50);

            assert.equal(spinnies.currentInterval, null, 'a failed render must stop the loop');
        });

        it('reuses the running interval across mutations', () => {
            const spinnies = createSpinnies();
            spinnies.add('a');
            const interval = spinnies.currentInterval;

            spinnies.add('b');
            spinnies.update('a', { text: 'changed' });
            spinnies.succeed('b');

            assert.equal(spinnies.currentInterval, interval, 'the timer must not be recreated');
        });
    });

    describe('statuses that do not spin', () => {
        // A spinning spinner is added first on purpose: with nothing active the registry is
        // reset straight away and there would be nothing left to render.
        it('renders a non-spinnable spinner', () => {
            const spinnies = createSpinnies();
            spinnies.add('busy');
            spinnies.add('quiet', { text: 'I do not spin', status: 'non-spinnable' });

            written.length = 0;
            spinnies.setStreamOutput('-');

            assert.match(written.join(''), /I do not spin/);
        });

        it('renders a stopped spinner', () => {
            const spinnies = createSpinnies();
            spinnies.add('busy');
            spinnies.add('halted', { text: 'I am halted', status: 'stopped' });

            written.length = 0;
            spinnies.setStreamOutput('-');

            assert.match(written.join(''), /I am halted/);
        });
    });

    describe('process listeners', () => {
        it('shares a single exit listener across instances', () => {
            const before = process.listenerCount('exit');
            const created = Array.from({ length: 12 }, () => createSpinnies());

            assert.equal(process.listenerCount('exit'), before + 1);

            created.forEach((instance) => instance.destroy());
            assert.equal(process.listenerCount('exit'), before);
        });

        it('does not hijack SIGINT', () => {
            const before = process.listenerCount('SIGINT');
            createSpinnies();

            assert.equal(process.listenerCount('SIGINT'), before);
        });
    });
});

describe('Spinnies raw output (non-TTY)', () => {
    let spinnies;

    beforeEach(() => {
        stderr.isTTY = false;
        spinnies = createSpinnies({ disableSpins: true });
        written.length = 0;
    });

    const lines = () => written.join('').split('\n').filter(Boolean);

    it('emits one line per spinner instead of redrawing the whole list', () => {
        for (const name of ['un', 'deux', 'trois', 'quatre', 'cinq']) spinnies.add(name);

        assert.deepEqual(lines(), ['- un', '- deux', '- trois', '- quatre', '- cinq']);
    });

    it('emits a line when a spinner changes, and stays silent otherwise', () => {
        spinnies.add('a');
        spinnies.add('keep-alive');
        written.length = 0;

        spinnies.update('a', { text: 'a' });
        assert.deepEqual(lines(), []);

        spinnies.update('a', { text: 'changed' });
        assert.deepEqual(lines(), ['- changed']);
    });

    it('logs the final statuses set by #stopAll', () => {
        spinnies.add('a');
        spinnies.add('b');
        written.length = 0;

        spinnies.stopAll('fail');

        assert.deepEqual(lines(), ['✖ a', '✖ b']);
    });

    it('resets the registry once every spinner is done, like the TTY path', () => {
        spinnies.add('a');
        spinnies.succeed('a');

        assert.deepEqual(spinnies.spinners, {});
        assert.equal(spinnies.pick('a'), undefined);
    });
});
