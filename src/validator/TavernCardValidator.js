const characterBook = require("lodash/object");

/**
 * Validates the data structure of character cards.
 * Supported specs: V1, V2
 * Up to: 8083fb3
 *
 * @link https://github.com/malfoyslastname/character-card-spec-v2
 */
class TavernCardValidator {
    #validationError = null;

    constructor(card) {
        this.card = card;
    }

    /**
     * Field that caused the validation to fail
     *
     * @returns {null|string}
     */
    get validationError() {
        return this.#validationError;
    }

    /**
     * Validate against V1 and V2 spec.
     *
     * @returns {number|boolean} - false when neither V1 nor V2 spec were matched. Specification version number otherwise.
     */
    validate() {
        this.#validationError = null;

        if (this.validateV1()) {
            return 2;
        }

        if (this.validateV2()) {
            return 1;
        }

        return false;
    }

    /**
     * Validate against V1 specification
     *
     * @returns {this is string[]}
     */
    validateV1() {
        const requiredFields = ['name', 'description', 'personality', 'scenario', 'first_mes', 'mes_example'];
        return requiredFields.every(field => {
            if (!this.card.hasOwnProperty(field)) {
                this.#validationError = field;
                return false;
            }
            return true;
        });
    }

    /**
     * Validate against V2 specification
     *
     * @returns {false|boolean|*}
     */
    validateV2() {
        return this.#validateSpec()
            && this.#validateSpecVersion()
            && this.#validateData()
            && this.#validateCharacterBook();
    }

    #validateSpec() {
        if (this.card.spec !== 'chara_card_v2') {
            this.#validationError = 'spec';
            return false;
        }
        return true;
    }

    #validateSpecVersion() {
        if (this.card.spec_version !== '2.0') {
            this.#validationError = 'spec_version';
            return false;
        }
        return true;
    }

    #validateData() {
        const data = this.card.data;

        if (!data) {
            this.#validationError = 'data';
            return false;
        }

        const requiredFields = ['name', 'description', 'personality', 'scenario', 'first_mes', 'mes_example', 'creator_notes', 'system_prompt', 'post_history_instructions', 'alternate_greetings', 'tags', 'creator', 'character_version', 'extensions'];
        const isAllRequiredFieldsPresent = requiredFields.every(field => {
            if (!data.hasOwnProperty(field)) {
                this.#validationError = `data.${field}`;
                return false;
            }
            return true;
        });

        return isAllRequiredFieldsPresent && Array.isArray(data.alternate_greetings) && Array.isArray(data.tags) && typeof data.extensions === 'object';
    }

    #validateCharacterBook() {
        const characterBook = this.card.data.character_book;

        if (!characterBook) {
            return true;
        }

        const requiredFields = ['extensions', 'entries'];
        const isAllRequiredFieldsPresent = requiredFields.every(field => {
            if (!characterBook.hasOwnProperty(field)) {
                this.#validationError = `data.character_book.${field}`;
                return false;
            }
            return true;
        });

        return isAllRequiredFieldsPresent && Array.isArray(characterBook.entries) && typeof characterBook.extensions === 'object';
    }
}

module.exports = {TavernCardValidator}
