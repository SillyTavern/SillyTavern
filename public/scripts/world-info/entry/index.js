/**
 * World Info Entry Module
 * Re-exports all entry-related functionality.
 */

export { newWorldInfoEntryDefinition, newWorldInfoEntryTemplate } from './definition.js';
export { createWorldInfoEntry, duplicateWorldInfoEntry, deleteWorldInfoEntry } from './crud.js';
export { originalWIDataKeyMap, setWIOriginalDataValue, deleteWIOriginalDataValue } from './original-data.js';
