# png-chunks-extract

[![stable](http://badges.github.io/stability-badges/dist/stable.svg)](http://github.com/badges/stability-badges)

Extract the data chunks from a PNG file.

Useful for reading the metadata of a PNG image, or as the base of a more complete PNG parser.

## Usage

[![NPM](https://nodei.co/npm/png-chunks-extract.png)](https://www.npmjs.com/package/png-chunks-extract)

### `chunks = extract(data)`

Takes the raw image file `data` as a `Uint8Array` or Node.js `Buffer`, and returns an array of chunks. Each chunk has a name and data buffer:

``` javascript
[
  { name: 'IHDR', data: Uint8Array([...]) },
  { name: 'IDAT', data: Uint8Array([...]) },
  { name: 'IDAT', data: Uint8Array([...]) },
  { name: 'IDAT', data: Uint8Array([...]) },
  { name: 'IDAT', data: Uint8Array([...]) },
  { name: 'IEND', data: Uint8Array([]) }
]
```

## License

MIT, see [LICENSE.md](http://github.com/hughsk/png-chunks-extract/blob/master/LICENSE.md) for details.
