const fs = require('fs');
const json5 = require('json5');
const ExifReader = require('exifreader');

const extract = require('png-chunks-extract');
const PNGtext = require('png-chunk-text');

const utf8Decode = new TextDecoder('utf-8', { ignoreBOM: true });

const parse = async (cardUrl, format) => {
    let fileFormat;
    if (format === undefined) {
        if (cardUrl.indexOf('.webp') !== -1)
            fileFormat = 'webp';
        else
            fileFormat = 'png';
    }
    else
        fileFormat = format;

    switch (fileFormat) {
        case 'webp':
            try {
                const exif_data = await ExifReader.load(fs.readFileSync(cardUrl));
                let char_data;

                if (exif_data['UserComment']['description']) {
                    let description = exif_data['UserComment']['description'];
                    if (description === 'Undefined' && exif_data['UserComment'].value && exif_data['UserComment'].value.length === 1) {
                        description = exif_data['UserComment'].value[0];
                    }

                    try {
                        json5.parse(description);
                        char_data = description;
                    } catch {
                        const byteArr = description.split(",").map(Number);
                        const uint8Array = new Uint8Array(byteArr);
                        const char_data_string = utf8Decode.decode(uint8Array);
                        char_data = char_data_string;
                    }
                }
                else {
                    console.log('No description found in EXIF data.');
                    return false;
                }

                return char_data;
            }
            catch (err) {
                console.log(err);
                return false;
            }
        case 'png':
            const buffer = fs.readFileSync(cardUrl);
            const chunks = extract(buffer);

            const textChunks = chunks.filter(function (chunk) {
                return chunk.name === 'tEXt';
            }).map(function (chunk) {
                return PNGtext.decode(chunk.data);
            });

            return Buffer.from(textChunks[0].text, 'base64').toString('utf8');
        default:
            break;
    }
};

module.exports = {
    parse: parse
};
