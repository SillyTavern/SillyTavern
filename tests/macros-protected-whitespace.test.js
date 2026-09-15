import { PROTECTED, protect, stripProtected } from '../public/scripts/macros/protected-whitespace.js';

describe('protected-whitespace sentinels', () => {
    describe('protect', () => {
        test('wraps values with edge whitespace', () => {
            expect(protect(' \n')).toBe(PROTECTED + ' \n' + PROTECTED);
            expect(protect(' bar')).toBe(PROTECTED + ' bar');
            expect(protect('\nx')).toBe(PROTECTED + '\nx');
        });

        test('wraps only whitespace edges', () => {
            expect(protect('x\n')).toBe('x\n' + PROTECTED);
            expect(protect('\nx')).toBe(PROTECTED + '\nx');
            expect(protect(' \n ')).toBe(PROTECTED + ' \n ' + PROTECTED);
        });

        test('leaves values without edge whitespace unchanged', () => {
            expect(protect('x')).toBe('x');
            expect(protect('foo bar')).toBe('foo bar');
            expect(protect('')).toBe('');
        });

        test('does not double-wrap already protected values', () => {
            const once = protect(' \n');
            expect(protect(once)).toBe(once);
        });

        test('handles null/undefined as empty string', () => {
            expect(protect(null)).toBe('');
            expect(protect(undefined)).toBe('');
        });

        test('core invariant: String.trim stops at the sentinel', () => {
            const protectedValue = protect(' \n');
            expect(protectedValue.trim()).toBe(protectedValue);
            // Control: without protection, the same value is destroyed
            expect(' \n'.trim()).toBe('');
        });
    });

    describe('stripProtected', () => {
        test('removes all sentinels', () => {
            expect(stripProtected('a' + PROTECTED + 'b' + PROTECTED)).toBe('ab');
            expect(stripProtected(PROTECTED + ' \n' + PROTECTED)).toBe(' \n');
        });

        test('is idempotent', () => {
            const once = stripProtected('a' + PROTECTED + 'b');
            expect(stripProtected(once)).toBe(once);
        });

        test('leaves plain text unchanged', () => {
            expect(stripProtected('hello world')).toBe('hello world');
            expect(stripProtected('')).toBe('');
        });
    });
});
