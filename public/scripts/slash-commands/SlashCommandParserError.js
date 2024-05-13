export class SlashCommandParserError extends Error {
    /**@type {String}*/ text;
    /**@type {Number}*/ index;

    get line() {
        return this.text.slice(0, this.index).replace(/[^\n]/g, '').length;
    }
    get column() {
        return this.text.slice(0, this.index).split('\n').pop().length;
    }
    get hint() {
        let lineOffset = this.line.toString().length;
        let lineStart = this.index;
        let start = this.index;
        let end = this.index;
        let offset = 0;
        let lineCount = 0;
        while (offset < 10000 && lineCount < 3 && start >= 0) {
            if (this.text[start] == '\n') lineCount++;
            if (lineCount == 0) lineStart--;
            offset++;
            start--;
        }
        if (this.text[start + 1] == '\n') start++;
        offset = 0;
        while (offset < 10000 && this.text[end] != '\n') {
            offset++;
            end++;
        }
        let hint  = [];
        let lines = this.text.slice(start + 1, end - 1).split('\n');
        let lineNum = this.line - lines.length + 1;
        let tabOffset = 0;
        for (const line of lines) {
            const num = `${' '.repeat(lineOffset - lineNum.toString().length)}${lineNum}`;
            lineNum++;
            const untabbedLine = line.replace(/\t/g, ' '.repeat(4));
            tabOffset = untabbedLine.length - line.length;
            hint.push(`${num}:  ${untabbedLine}`);
        }
        hint.push(`${' '.repeat(this.index - lineStart + lineOffset + 1 + tabOffset)}^^^^^`);
        return hint.join('\n');
    }

    constructor(message, text, index) {
        super(message);
        this.text = text;
        this.index = index;
    }
}
