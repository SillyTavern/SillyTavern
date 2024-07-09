import { test, expect } from '@jest/globals';
import { debounce_timeout } from '../constants.js';

test('sample module import', () => {
    expect(debounce_timeout.standard).toBe(300);
});
