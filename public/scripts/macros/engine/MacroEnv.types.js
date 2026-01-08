/**
 * Shared typedefs for the structured macro environment object (MacroEnv)
 * used by the macro engine, registry, env builder, and macro definition
 * modules. This file intentionally only contains JSDoc typedefs so that
 * it can be imported purely for type information from multiple modules
 * without creating runtime dependencies.
 */

/** @typedef {import('./MacroRegistry.js').MacroHandler} MacroHandler */
/** @typedef {import('./MacroRegistry.js').MacroDefinitionOptions} MacroDefinitionOptions */

/**
 * A dynamic macro value can be:
 * - A string (direct value)
 * - A MacroHandler function (resolved at runtime)
 * - A MacroDefinitionOptions object (full macro definition with handler, args, etc.)
 * @typedef {string | MacroHandler | MacroDefinitionOptions} DynamicMacroValue
 */

/**
 * @typedef {Object} MacroEnvNames
 * @property {string} user
 * @property {string} char
 * @property {string} group
 * @property {string} groupNotMuted
 * @property {string} notChar
 */

/**
 * @typedef {Object} MacroEnvCharacter
 * @property {string} [description]
 * @property {string} [personality]
 * @property {string} [scenario]
 * @property {string} [persona]
 * @property {string} [charPrompt]
 * @property {string} [charInstruction]
 * @property {string} [mesExamplesRaw]
 * @property {string} [charDepthPrompt]
 * @property {string} [creatorNotes]
 * @property {string} [version]
 */

/**
 * @typedef {Object} MacroEnvSystem
 * @property {string} model
 */

/**
 * @typedef {Object} MacroEnvFunctions
 * @property {() => string} [original]
 * @property {(text: string) => string} postProcess
 */

/**
 * @typedef {Object} MacroEnv
 * @property {string} content - The full original input string that is being processed by the macro engine. This is the same value as substituteParams "content" and is provided so macros can build deterministic behavior based on the whole prompt when needed.
 * @property {number} contentHash - A hash of the content string, used for caching and comparison.
 * @property {MacroEnvNames} names
 * @property {MacroEnvCharacter} character
 * @property {MacroEnvSystem} system
 * @property {MacroEnvFunctions} functions
 * @property {Object<string, DynamicMacroValue>} dynamicMacros
 * @property {Record<string, unknown>} extra
 */

export {};
