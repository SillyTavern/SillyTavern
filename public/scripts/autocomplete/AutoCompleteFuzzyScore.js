


export class AutoCompleteFuzzyScore {
    /**@type {number}*/ start;
    /**@type {number}*/ longestConsecutive;

    /**
     * @param {number} start
     * @param {number} longestConsecutive
     */
    constructor(start, longestConsecutive) {
        this.start = start;
        this.longestConsecutive = longestConsecutive;
    }
}
