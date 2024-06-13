/**
 * Validates the data structure of character cards.
 * Supported specs: V1, V2
 * Up to: 8083fb3
 *
 * @link https://github.com/malfoyslastname/character-card-spec-v2
 */
class TavernCardValidator {
    /**
     * @type {string|null}
     */
    #lastValidationError = null;

    constructor(card) {
        this.card = card;
    }

    /**
     * Field that caused the validation to fail
     *
     * @returns {null|string}
     */
    get lastValidationError() {
        return this.#lastValidationError;
    }

    /**
     * Validate against V1 or V2 spec.
     *
     * @returns {number|boolean} - false when neither V1 nor V2 spec were matched. Specification version number otherwise.
     */
    validate() {
        this.#lastValidationError = null;

        if (this.validateV1()) {
            return 1;
        }

        if (this.validateV2()) {
            return 2;
        }

        if (this.validateV3()) {
            return 3;
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
            if (!Object.hasOwn(this.card, field)) {
                this.#lastValidationError = field;
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
        return this.#validateSpecV2()
            && this.#validateSpecVersionV2()
            && this.#validateDataV2()
            && this.#validateCharacterBookV2();
    }

    /**
     * Validate against V3 specification
     * @returns {boolean}
     */
    validateV3() {
        return this.#validateSpecV3()
            && this.#validateSpecVersionV3()
            && this.#validateDataV3();
    }

    #validateSpecV2() {
        if (this.card.spec !== 'chara_card_v2') {
            this.#lastValidationError = 'spec';
            return false;
        }
        return true;
    }

    #validateSpecVersionV2() {
        if (this.card.spec_version !== '2.0') {
            this.#lastValidationError = 'spec_version';
            return false;
        }
        return true;
    }

    #validateDataV2() {
        const data = this.card.data;

        if (!data) {
            this.#lastValidationError = 'No tavern card data found';
            return false;
        }

        const requiredFields = ['name', 'description', 'personality', 'scenario', 'first_mes', 'mes_example', 'creator_notes', 'system_prompt', 'post_history_instructions', 'alternate_greetings', 'tags', 'creator', 'character_version', 'extensions'];
        const isAllRequiredFieldsPresent = requiredFields.every(field => {
            if (!Object.hasOwn(data, field)) {
                this.#lastValidationError = `data.${field}`;
                return false;
            }
            return true;
        });

        return isAllRequiredFieldsPresent && Array.isArray(data.alternate_greetings) && Array.isArray(data.tags) && typeof data.extensions === 'object';
    }

    #validateCharacterBookV2() {
        const characterBook = this.card.data.character_book;

        if (!characterBook) {
            return true;
        }

        const requiredFields = ['extensions', 'entries'];
        const isAllRequiredFieldsPresent = requiredFields.every(field => {
            if (!Object.hasOwn(characterBook, field)) {
                this.#lastValidationError = `data.character_book.${field}`;
                return false;
            }
            return true;
        });

        return isAllRequiredFieldsPresent && Array.isArray(characterBook.entries) && typeof characterBook.extensions === 'object';
    }

    #validateSpecV3() {
        if (this.card.spec !== 'chara_card_v3') {
            this.#lastValidationError = 'spec';
            return false;
        }
        return true;
    }

    #validateSpecVersionV3() {
        if (Number(this.card.spec_version) < 3.0 || Number(this.card.spec_version) >= 4.0) {
            this.#lastValidationError = 'spec_version';
            return false;
        }
        return true;
    }

    #validateDataV3() {
        const data = this.card.data;

        if (!data || typeof data !== 'object') {
            this.#lastValidationError = 'No tavern card data found';
            return false;
        }

        return true;
    }
}

module.exports = { TavernCardValidator };
