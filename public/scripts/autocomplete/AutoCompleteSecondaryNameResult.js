import { AutoCompleteNameResult } from './AutoCompleteNameResult.js';

export class AutoCompleteSecondaryNameResult extends AutoCompleteNameResult {
    /**@type {boolean}*/ isRequired = false;
    /**@type {boolean}*/ forceMatch = true;
}
