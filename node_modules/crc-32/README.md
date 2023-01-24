# crc32

Standard CRC-32 algorithm implementation in JS (for the browser and nodejs).
Emphasis on correctness and performance.

## Installation

With [npm](https://www.npmjs.org/package/crc-32):

    $ npm install crc-32

In the browser:

    <script src="crc32.js"></script>

The script will manipulate `module.exports` if available (e.g. in a CommonJS
`require` context).  This is not always desirable.  To prevent the behavior,
define `DO_NOT_EXPORT_CRC`

## Usage

In all cases, the relevant function takes a single argument representing data.

The return value is a signed 32-bit integer.

- `CRC32.buf(byte array or buffer)` assumes the argument is a set of 8-bit
  unsigned integers (e.g. nodejs `Buffer` or simple array of ints).

- `CRC32.bstr(binary string)` interprets the argument as a binary string where
  the `i`-th byte is the low byte of the UCS-2 char: `str.charCodeAt(i) & 0xFF`

- `CRC32.str(string)` interprets the argument as a standard JS string

For example:

```js
> // var CRC32 = require('crc-32'); // uncomment this line if in node
> CRC32.str("SheetJS")                          // -1647298270
> CRC32.bstr("SheetJS")                         // -1647298270
> CRC32.buf([ 83, 104, 101, 101, 116, 74, 83 ]) // -1647298270

> [CRC32.str("\u2603"),  CRC32.str("\u0003")]   // [ -1743909036,  1259060791 ]
> [CRC32.bstr("\u2603"), CRC32.bstr("\u0003")]  // [  1259060791,  1259060791 ]
> [CRC32.buf([0x2603]),  CRC32.buf([0x0003])]   // [  1259060791,  1259060791 ]
```

## Testing

`make test` will run the node-based tests.

To run the in-browser tests, run a local server and go to the `ctest` directory.
To update the browser artifacts, run `make ctest`.

## License

Please consult the attached LICENSE file for details.  All rights not explicitly
granted by the Apache 2.0 license are reserved by the Original Author.

## Badges

[![Build Status](https://travis-ci.org/SheetJS/js-crc32.svg?branch=master)](https://travis-ci.org/SheetJS/js-crc32)

[![Coverage Status](http://img.shields.io/coveralls/SheetJS/js-crc32/master.svg)](https://coveralls.io/r/SheetJS/js-crc32?branch=master)

[![Analytics](https://ga-beacon.appspot.com/UA-36810333-1/SheetJS/js-crc32?pixel)](https://github.com/SheetJS/js-crc32)
