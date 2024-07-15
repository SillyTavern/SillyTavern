import { CstParser } from '../../lib/chevrotain.min.mjs';

/** @type {any} */
const AnyParser = CstParser;

/**
 * @typedef {import('./chevrotain').CstParser} CstParserType
 * @typedef {new (...args: any[]) => CstParserType} CstParserConstructor
 * @type {CstParserConstructor}
 */
const Parser = AnyParser;

export { Parser as CstParser };
