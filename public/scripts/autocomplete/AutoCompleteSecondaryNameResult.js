import { AutoCompleteNameResultBase } from './AutoCompleteNameResultBase.js';

export class AutoCompleteSecondaryNameResult extends AutoCompleteNameResultBase {
    /**@type {boolean}*/ isRequired = false;
    /**@type {boolean}*/ forceMatch = true;
}
