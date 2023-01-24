# png-chunk-text

[![stable](http://badges.github.io/stability-badges/dist/stable.svg)](http://github.com/badges/stability-badges)

Create or parse a PNG tEXt chunk for storing uncompressed text data in PNG images.

Can be used in combination with [png-chunks-extract](https://github.com/hughsk/png-chunks-extract) and [png-chunks-encode](https://github.com/hughsk/png-chunks-encode) for adding and reading custom metadata in PNG images.

Works in Node, or in the browser using [browserify](http://browserify.org/).

## Usage

[![NPM](https://nodei.co/npm/png-chunk-text.png)](https://www.npmjs.com/package/png-chunk-text)

### `chunk = text.encode(key, value)`

Returns a chunk object containing the metadata for a given `key` and `value`:

``` javascript
{
  name: 'tEXt',
  data: Uint8Array([...])
}
```

``` javascript
const extract = require('png-chunks-extract')
const encode = require('png-chunks-encode')
const text = require('png-chunk-text')
const path = require('path')
const fs = require('fs')

const buffer = fs.readFileSync(path.join(__dirname, 'test.png'))
const chunks = extract(buffer)

// Add new chunks before the IEND chunk
chunks.splice(-1, 0, text.encode('hello', 'world'))
chunks.splice(-1, 0, text.encode('lorem', 'ipsum'))

fs.writeFileSync(
  path.join(__dirname, 'test-out.png'),
  new Buffer(encode(chunks))
)
```

### `data = text.decode(chunk)`

Reads a `Uint8Array` or Node.js `Buffer` instance containing a `tEXt` PNG chunk's data and returns its keyword/text:

``` javascript
{
  keyword: 'hello',
  text: 'world'
}
```

``` javascript
const extract = require('png-chunks-extract')
const text = require('png-chunk-text')
const path = require('path')
const fs = require('fs')

const buffer = fs.readFileSync(path.join(__dirname, 'test-out.png'))
const chunks = extract(buffer)

const textChunks = chunks.filter(function (chunk) {
  return chunk.name === 'tEXt'
}).map(function (chunk) {
  return text.decode(chunk.data)
})

console.log(textChunks[0].keyword) // 'hello'
console.log(textChunks[0].text)    // 'world'
console.log(textChunks[1].keyword) // 'lorem'
console.log(textChunks[1].text)    // 'ipsum'
```

## See Also

* [png-chunks-extract](https://github.com/hughsk/png-chunks-extract)
* [png-chunks-encode](https://github.com/hughsk/png-chunks-encode)

## License

MIT, see [LICENSE.md](http://github.com/hughsk/png-chunk-text/blob/master/LICENSE.md) for details.
