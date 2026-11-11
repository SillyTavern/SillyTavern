import { describe, test, expect } from '@jest/globals';
import { getCapabilityModel } from '../src/model-capabilities.js';

describe('getCapabilityModel', () => {
    test('uses the model when no base is given', () => {
        expect(getCapabilityModel({ model: 'gpt-4o' })).toBe('gpt-4o');
    });

    test('uses the base model when given', () => {
        expect(getCapabilityModel({ model: 'my-finetune', model_base: 'gpt-4o' })).toBe('gpt-4o');
    });

    test('ignores an empty base', () => {
        expect(getCapabilityModel({ model: 'my-finetune', model_base: '' })).toBe('my-finetune');
    });

    test('returns an empty string for a missing body', () => {
        expect(getCapabilityModel(undefined)).toBe('');
        expect(getCapabilityModel({})).toBe('');
    });
});
