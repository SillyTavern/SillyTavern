const fs = require('fs');

const encode = require('png-chunks-encode');
const extract = require('png-chunks-extract');
const PNGtext = require('png-chunk-text');

/**
 * Writes Character metadata to a PNG image buffer.
 * @param {Buffer} image PNG image buffer
 * @param {string} data Character data to write
 * @returns {Buffer} PNG image buffer with metadata
 */
const write = (image, data) => {
    const chunks = extract(image);
    const tEXtChunks = chunks.filter(chunk => chunk.name === 'tEXt');

    // Remove all existing tEXt chunks
    for (let tEXtChunk of tEXtChunks) {
        chunks.splice(chunks.indexOf(tEXtChunk), 1);
    }
    // Add new chunks before the IEND chunk
    const base64EncodedData = Buffer.from(data, 'utf8').toString('base64');
    chunks.splice(-1, 0, PNGtext.encode('chara', base64EncodedData));
    const newBuffer = Buffer.from(encode(chunks));
    return newBuffer;
};

/**
 * Reads Character metadata from a PNG image buffer.
 * @param {Buffer} image PNG image buffer
 * @returns {string} Character data
 */
const read = (image) => {
    const chunks = extract(image);

    const textChunks = chunks.filter(function (chunk) {
        return chunk.name === 'tEXt';
    }).map(function (chunk) {
        return PNGtext.decode(chunk.data);
    });

    if (textChunks.length === 0) {
        console.error('PNG metadata does not contain any text chunks.');
        throw new Error('No PNG metadata.');
    }

    let index = textChunks.findIndex((chunk) => chunk.keyword.toLowerCase() == 'chara');

    if (index === -1) {
        console.error('PNG metadata does not contain any character data.');
        throw new Error('No PNG metadata.');
    }

    return Buffer.from(textChunks[index].text, 'base64').toString('utf8');
};

/**
 * Parses a card image and returns the character metadata.
 * @param {string} cardUrl Path to the card image
 * @param {string} format File format
 * @returns {string} Character data
 */
const parse = (cardUrl, format) => {
    let fileFormat = format === undefined ? 'png' : format;

    switch (fileFormat) {
        case 'png': {
            const buffer = fs.readFileSync(cardUrl);
            return read(buffer);
        }
    }

    throw new Error('Unsupported format');
};

module.exports = {
    parse,
    write,
    read,
};
