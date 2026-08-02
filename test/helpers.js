'use strict';

import assert from 'node:assert/strict';

function describeValue(value) {
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

/**
 * Asserts that every key of `expected` exists on `actual` with a strictly equal value.
 */
function assertIncludes(actual, expected) {
    for (const [key, value] of Object.entries(expected)) {
        assert.strictEqual(
            actual?.[key],
            value,
            `expected "${key}" to be ${describeValue(value)}, got ${describeValue(actual?.[key])}`
        );
    }
}

/**
 * Same as `assertIncludes`, but compares each value deeply.
 */
function assertDeepIncludes(actual, expected) {
    for (const [key, value] of Object.entries(expected)) {
        assert.deepStrictEqual(
            actual?.[key],
            value,
            `expected "${key}" to deeply equal ${describeValue(value)}`
        );
    }
}

/**
 * Asserts that none of the given keys is an own property of `actual`.
 */
function assertLacksKeys(actual, ...keys) {
    for (const key of keys) {
        assert.ok(
            !Object.hasOwn(actual ?? {}, key),
            `expected no "${key}" property, got ${describeValue(actual?.[key])}`
        );
    }
}

/**
 * Asserts that `actual` owns exactly the given keys, in any order.
 */
function assertHasExactKeys(actual, ...keys) {
    assert.deepStrictEqual(Object.keys(actual ?? {}).sort(), [...keys].sort());
}

export {
    assertIncludes,
    assertDeepIncludes,
    assertLacksKeys,
    assertHasExactKeys,
};
