// Borrowed from the Droll library by thebinarypenguin
// https://github.com/thebinarypenguin/droll
// Licensed under MIT license
var droll = {};

// Define a "class" to represent a formula
function DrollFormula() {
    this.numDice = 0;
    this.numSides = 0;
    this.modifier = 0;

    this.minResult = 0;
    this.maxResult = 0;
    this.avgResult = 0;
}

// Define a "class" to represent the results of the roll
function DrollResult() {
    this.rolls = [];
    this.modifier = 0;
    this.total = 0;
}

/**
 * Returns a string representation of the roll result
 */
DrollResult.prototype.toString = function () {
    if (this.rolls.length === 1 && this.modifier === 0) {
        return this.rolls[0] + '';
    }

    if (this.rolls.length > 1 && this.modifier === 0) {
        return this.rolls.join(' + ') + ' = ' + this.total;
    }

    if (this.rolls.length === 1 && this.modifier > 0) {
        return this.rolls[0] + ' + ' + this.modifier + ' = ' + this.total;
    }

    if (this.rolls.length > 1 && this.modifier > 0) {
        return this.rolls.join(' + ') + ' + ' + this.modifier + ' = ' + this.total;
    }

    if (this.rolls.length === 1 && this.modifier < 0) {
        return this.rolls[0] + ' - ' + Math.abs(this.modifier) + ' = ' + this.total;
    }

    if (this.rolls.length > 1 && this.modifier < 0) {
        return this.rolls.join(' + ') + ' - ' + Math.abs(this.modifier) + ' = ' + this.total;
    }
};

/**
 * Parse the formula into its component pieces.
 * Returns a DrollFormula object on success or false on failure.
 */
droll.parse = function (formula) {
    var pieces = null;
    var result = new DrollFormula();

    pieces = formula.match(/^([1-9]\d*)?d([1-9]\d*)([+-]\d+)?$/i);
    if (!pieces) { return false; }

    result.numDice = (pieces[1] - 0) || 1;
    result.numSides = (pieces[2] - 0);
    result.modifier = (pieces[3] - 0) || 0;

    result.minResult = (result.numDice * 1) + result.modifier;
    result.maxResult = (result.numDice * result.numSides) + result.modifier;
    result.avgResult = (result.maxResult + result.minResult) / 2;

    return result;
};

/**
 * Test the validity of the formula.
 * Returns true on success or false on failure.
 */
droll.validate = function (formula) {
    return (droll.parse(formula)) ? true : false;
};

/**
 * Roll the dice defined by the formula.
 * Returns a DrollResult object on success or false on failure.
 */
droll.roll = function (formula) {
    var pieces = null;
    var result = new DrollResult();

    pieces = droll.parse(formula);
    if (!pieces) { return false; }

    for (var a = 0; a < pieces.numDice; a++) {
        result.rolls[a] = (1 + Math.floor(Math.random() * pieces.numSides));
    }

    result.modifier = pieces.modifier;

    for (var b = 0; b < result.rolls.length; b++) {
        result.total += result.rolls[b];
    }
    result.total += result.modifier;

    return result;
};

// END OF DROLL CODE
